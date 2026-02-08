import { Router } from 'express';
import { z } from 'zod';
import axios from 'axios';

import { ddgSearch } from '../services/ddg.js';
import { gdeltSearch } from '../services/gdelt.js';
import { agentAnalyze, agentFilter, agentSelect, agentStrategy, isAgentConfigured } from '../services/agent.js';
import { buildFallbackAnalysis } from '../utils/fallbackAnalyze.js';
import { normalizeQuery } from '../utils/query.js';

export const analyzeRouter = Router();

const AnalyzeBody = z.object({
  query: z.string().min(1, 'query is required').max(200),
  region: z.string().optional(),
  context: z
    .object({
      currentUrl: z.string().url().optional(),
      timestamp: z.string().datetime().optional()
    })
    .optional(),
  snippets: z
    .array(
      z.object({
        title: z.string().optional(),
        snippet: z.string().optional(),
        url: z.string().optional(),
        sourceName: z.string().optional(),
        datePublished: z.string().optional()
      })
    )
    .optional()
});

const AnalyzeOutput = z.object({
  summary: z.string(),
  timeline: z.array(
    z.object({
      date: z.string(),
      title: z.string(),
      snippet: z.string(),
      sourceName: z.string().optional().default(''),
      url: z.string().url(),
      tags: z.array(z.string()).optional().default([]),
      isReversal: z.boolean().optional()
    })
  ),
  stances: z.array(
    z.object({
      party: z.string(),
      viewpoint: z.string(),
      stance: z.string().optional()
    }).passthrough()
  ),
  relatedEvents: z.array(
    z.object({
      eventName: z.string(),
      reason: z.string()
    })
  ),
  sources: z.array(
    z.object({
      title: z.string().optional().default(''),
      snippet: z.string().optional().default(''),
      url: z.string().optional().default(''),
      sourceName: z.string().optional().default(''),
      datePublished: z.string().optional().default('')
    })
  ).optional().default([])
});

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    return `${u.host}${u.pathname}`.toLowerCase();
  } catch {
    return '';
  }
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\p{P}\p{S}]/gu, '')
    .trim();
}

function buildBigrams(text) {
  const s = String(text || '');
  const grams = new Set();
  if (s.length < 2) return grams;
  for (let i = 0; i < s.length - 1; i += 1) {
    grams.add(s.slice(i, i + 2));
  }
  return grams;
}

function textSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const minLen = Math.min(a.length, b.length);
    if (minLen >= 6) return 0.95;
  }
  const aGrams = buildBigrams(a);
  const bGrams = buildBigrams(b);
  if (!aGrams.size || !bGrams.size) return 0;
  let inter = 0;
  for (const g of aGrams) {
    if (bGrams.has(g)) inter += 1;
  }
  const union = aGrams.size + bGrams.size - inter;
  return union ? inter / union : 0;
}

function normalizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

function buildQueryTerms(queries) {
  const terms = new Set();
  for (const q of queries || []) {
    const cjk = String(q || '').match(/[\u4e00-\u9fff]{2,}/g) || [];
    const latin = String(q || '').toLowerCase().match(/[a-z0-9]{3,}/g) || [];
    cjk.forEach((t) => terms.add(normalizeForMatch(t)));
    latin.forEach((t) => terms.add(t));
  }
  return Array.from(terms);
}

// Intentionally keep filtering minimal; rely on agent selection to judge quality.

function scoreCandidate(item, terms) {
  let score = 0;
  const text = normalizeForMatch(`${item.title} ${item.snippet}`);
  let termHits = 0;
  for (const t of terms) {
    if (!t) continue;
    if (text.includes(t)) termHits += 1;
  }
  score += Math.min(termHits, 6);

  const ts = Date.parse(item.datePublished || '');
  if (!Number.isNaN(ts)) {
    const days = (Date.now() - ts) / 86400000;
    if (days <= 3) score += 3;
    else if (days <= 7) score += 2;
    else if (days <= 30) score += 1;
  }
  return score;
}

function rankCandidates(items, terms) {
  return [...items].sort((a, b) => {
    const scoreA = scoreCandidate(a, terms);
    const scoreB = scoreCandidate(b, terms);
    if (scoreA !== scoreB) return scoreB - scoreA;
    const dateA = Date.parse(a.datePublished || '') || 0;
    const dateB = Date.parse(b.datePublished || '') || 0;
    return dateB - dateA;
  });
}

function parseTimelineDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return { ts: NaN, isBackground: false };
  if (/背景信息|背景/.test(raw)) return { ts: Number.NEGATIVE_INFINITY, isBackground: true };
  if (/未知/.test(raw)) return { ts: NaN, isBackground: false };

  const now = Date.now();
  const hourAgo = raw.match(/(\d+)\s*(hours? ago|小时(?:前)?)/i);
  if (hourAgo) {
    const hours = Number(hourAgo[1]) || 0;
    return { ts: now - hours * 3600000, isBackground: false };
  }
  const dayAgo = raw.match(/(\d+)\s*(days? ago|天(?:前)?)/i);
  if (dayAgo) {
    const days = Number(dayAgo[1]) || 0;
    return { ts: now - days * 86400000, isBackground: false };
  }

  const ymd = raw.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]) - 1;
    const d = Number(ymd[3]);
    return { ts: Date.UTC(y, m, d), isBackground: false };
  }

  const ymdZh = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (ymdZh) {
    const y = Number(ymdZh[1]);
    const m = Number(ymdZh[2]) - 1;
    const d = Number(ymdZh[3]);
    return { ts: Date.UTC(y, m, d), isBackground: false };
  }

  const mdZh = raw.match(/(\d{1,2})月(\d{1,2})日/);
  if (mdZh) {
    const y = new Date().getFullYear();
    const m = Number(mdZh[1]) - 1;
    const d = Number(mdZh[2]);
    return { ts: Date.UTC(y, m, d), isBackground: false };
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return { ts: parsed, isBackground: false };
  return { ts: NaN, isBackground: false };
}

function sortTimeline(items) {
  if (!Array.isArray(items)) return items;
  return items
    .map((item, idx) => {
      const meta = parseTimelineDate(item?.date);
      return { item, idx, meta };
    })
    .sort((a, b) => {
      if (a.meta.isBackground && !b.meta.isBackground) return -1;
      if (!a.meta.isBackground && b.meta.isBackground) return 1;

      const aValid = !Number.isNaN(a.meta.ts);
      const bValid = !Number.isNaN(b.meta.ts);
      if (aValid && bValid) return a.meta.ts - b.meta.ts;
      if (aValid && !bValid) return -1;
      if (!aValid && bValid) return 1;
      return a.idx - b.idx;
    })
    .map((x) => x.item);
}

function containsCjk(text = '') {
  return /[\u4e00-\u9fff]/.test(text);
}

function isShortProperNoun(text = '') {
  return /^[A-Za-z0-9.\-]+$/.test(text) && text.length <= 10;
}

function ensureChinese(text = '', fallback = '') {
  const s = String(text || '').trim();
  if (!s) return '';
  if (containsCjk(s) || isShortProperNoun(s)) return s;
  return fallback || '未翻译内容';
}

function enforceChineseAnalysis(analysis) {
  if (!analysis) return analysis;
  analysis.summary = ensureChinese(analysis.summary, '摘要（未翻译）');

  if (Array.isArray(analysis.timeline)) {
    analysis.timeline = analysis.timeline.map((item) => {
      const next = { ...item };
      next.title = ensureChinese(next.title, '英文标题（未翻译）');
      next.snippet = ensureChinese(next.snippet, '英文摘要（未翻译）');
      if (Array.isArray(next.tags)) {
        const tags = next.tags.filter((t) => containsCjk(String(t || '')));
        next.tags = tags.length ? tags : ['其他'];
      }
      return next;
    });
  }

  if (Array.isArray(analysis.stances)) {
    analysis.stances = analysis.stances.map((s) => ({
      ...s,
      party: ensureChinese(s.party, '相关方'),
      stance: s.stance ? ensureChinese(s.stance, '未说明') : s.stance,
      viewpoint: ensureChinese(s.viewpoint, '观点（未翻译）')
    }));
  }

  if (Array.isArray(analysis.relatedEvents)) {
    analysis.relatedEvents = analysis.relatedEvents.map((e) => ({
      ...e,
      eventName: ensureChinese(e.eventName, '相关事件（未翻译）'),
      reason: ensureChinese(e.reason, '关联原因（未翻译）')
    }));
  }

  return analysis;
}

function dedupeCandidates(items) {
  const seenUrl = new Set();
  const seenTitle = [];
  const out = [];
  for (const item of items) {
    if (!item?.url || !/^https?:\/\//i.test(item.url)) continue;
    const urlKey = normalizeUrl(item.url);
    const titleKey = normalizeTitle(item.title || '');
    const contentKey =
      normalizeForMatch(`${item.title || ''} ${item.snippet || ''}`) || titleKey;
    const domain = extractDomain(item.url);
    if (urlKey && seenUrl.has(urlKey)) continue;
    if (titleKey) {
      let dup = false;
      for (const prev of seenTitle) {
        if (prev.key === titleKey) {
          dup = true;
          break;
        }
        if (titleKey.length >= 6 && prev.key.length >= 6) {
          if (textSimilarity(titleKey, prev.key) >= 0.88) {
            dup = true;
            break;
          }
        }
        if (contentKey && prev.contentKey) {
          const sim = textSimilarity(contentKey, prev.contentKey);
          if (sim >= 0.8) {
            dup = true;
            break;
          }
          if (domain && prev.domain && domain === prev.domain && sim >= 0.6) {
            dup = true;
            break;
          }
        }
      }
      if (dup) continue;
    }
    if (urlKey) seenUrl.add(urlKey);
    if (titleKey) seenTitle.push({ key: titleKey, contentKey, domain });
    out.push(item);
  }
  return out;
}

function extractTitleFromHtml(html) {
  if (typeof html !== 'string') return '';
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return m[1]
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

function htmlToPlainText(html) {
  if (typeof html !== 'string') return '';
  let s = html;
  // Remove scripts/styles/noscript
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  // Keep some structure
  s = s.replace(/<\s*br\s*\/?>/gi, '\n');
  s = s.replace(/<\s*\/p\s*>/gi, '\n');
  s = s.replace(/<\s*\/h\d\s*>/gi, '\n');
  // Strip tags
  s = s.replace(/<[^>]+>/g, ' ');
  // Basic entity decode
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"');
  // Normalize whitespace
  s = s.replace(/\r/g, '');
  s = s.replace(/\n\s+\n/g, '\n\n');
  s = s.replace(/[\t\f\v ]{2,}/g, ' ');
  return s.trim();
}

function extractMainTextFromHtml(html) {
  if (typeof html !== 'string') return '';

  // Prefer <article> when present.
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch?.[1]) {
    const t = htmlToPlainText(articleMatch[1]);
    if (t.length) return t;
  }

  // Fallback: use body.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    const t = htmlToPlainText(bodyMatch[1]);
    if (t.length) return t;
  }

  return htmlToPlainText(html);
}

async function fetchArticleForContext(currentUrl) {
  if (!currentUrl) return { title: '', text: '' };

  const timeout = Number(process.env.ARTICLE_FETCH_TIMEOUT_MS || 8000);
  const maxChars = Number(process.env.ARTICLE_MAX_CHARS || 6000);

  try {
    const resp = await axios.get(currentUrl, {
      timeout,
      responseType: 'text',
      maxContentLength: 2_000_000,
      headers: {
        // Some news sites block requests without a UA.
        'User-Agent':
          process.env.ARTICLE_USER_AGENT ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml'
      },
      validateStatus: (s) => s >= 200 && s < 400
    });

    const html = resp.data;
    const title = extractTitleFromHtml(html);
    const text = extractMainTextFromHtml(html).slice(0, maxChars);

    return { title, text };
  } catch {
    // If fetch/extract fails, don't break the whole request; just proceed with snippets.
    return { title: '', text: '' };
  }
}

function buildRawText({ query, context, snippets, article }) {
  // The python Agent.py expects a single text blob.
  const parts = [];
  parts.push(`QUERY: ${query}`);
  if (context?.currentUrl) parts.push(`CURRENT_URL: ${context.currentUrl}`);
  if (context?.timestamp) parts.push(`TIMESTAMP: ${context.timestamp}`);

   parts.push('SNIPPETS:');
   snippets.forEach((s, idx) => {
     parts.push(
       [
         `#${idx + 1}`,
         s.datePublished ? `DATE: ${s.datePublished}` : null,
         s.sourceName ? `SOURCE: ${s.sourceName}` : null,
         s.title ? `TITLE: ${s.title}` : null,
         s.snippet ? `SNIPPET: ${s.snippet}` : null,
         s.url ? `URL: ${s.url}` : null
       ]
         .filter(Boolean)
         .join('\n')
     );
     parts.push('');
   });

   // Put article after snippets so truncation still retains snippets.
   if (article?.title) parts.push(`ARTICLE_TITLE: ${article.title}`);
   if (article?.text) {
     parts.push('ARTICLE_TEXT:');
     parts.push(article.text);
   }
   return parts.join('\n');
}


analyzeRouter.post('/', async (req, res, next) => {
  try {
    const body = AnalyzeBody.parse(req.body);
    const normalizedQuery = normalizeQuery(body.query);
    if (!normalizedQuery) {
      return res.status(400).json({
        code: 400,
        message: 'query is required'
      });
    }

    const count = Number(process.env.BOCHA_COUNT || 20);
    const maxQueries = Number(process.env.ANALYZE_MAX_QUERIES || 4);
    const maxPerQuery = Number(process.env.ANALYZE_MAX_PER_QUERY || 8);
    const maxSnippets = Number(process.env.ANALYZE_MAX_SNIPPETS || 10);
    const agentUrl = req.headers['x-agent-url'];
    const agentApiKey = req.headers['x-agent-key'];
    const articlePromise = fetchArticleForContext(body.context?.currentUrl);
    let snippets = [];
    let ddgOk = true;
    let ddgMsg = 'DDG 搜索成功';
    let gdeltOk = true;
    let gdeltMsg = 'GDELT 搜索成功';

    if (body.snippets && body.snippets.length > 0) {
      snippets = body.snippets;
      ddgMsg = '使用前端提供的 snippets';
      gdeltMsg = '使用前端提供的 snippets';
    } else {
      try {
        const hasAgentKey = typeof agentApiKey === 'string' && agentApiKey.trim().length > 0;
        const useProcessAgent = !agentUrl && !process.env.AGENT_URL;
        let searchQueries = [];
        let queryObjs = [];

        if (useProcessAgent && (hasAgentKey || isAgentConfigured())) {
          try {
            const strategy = await agentStrategy({
              selection: normalizedQuery,
              pageTitle: '',
              pageUrl: body.context?.currentUrl,
              maxQueries,
              apiKey: hasAgentKey ? agentApiKey.trim() : undefined
            });
            const rawQueries = Array.isArray(strategy?.queries) ? strategy.queries : [];
            queryObjs = rawQueries
              .map((q) => ({
                q: normalizeQuery(q?.q || ''),
                lang: (q?.lang || '').toString().toLowerCase() || undefined
              }))
              .filter((q) => q.q)
              .slice(0, maxQueries);
            searchQueries = queryObjs.map((q) => q.q);
          } catch (err) {
            console.warn('[analyze] agentStrategy failed, fallback to normalized query', err?.message || err);
          }
        }

        if (!searchQueries.length) {
          searchQueries = [normalizedQuery];
          queryObjs = [{ q: normalizedQuery, lang: 'mixed' }];
        }

        const queryTerms = buildQueryTerms(searchQueries);
        const ddgErrors = [];
        const gdeltErrors = [];
        let ddgSuccess = 0;
        let gdeltSuccess = 0;
        let ddgEmpty = 0;
        let gdeltEmpty = 0;

        const searchTasks = searchQueries.map((q, idx) =>
          Promise.allSettled([
            ddgSearch({ query: q, count: maxPerQuery, region: body.region }),
            gdeltSearch({ query: q, maxrecords: maxPerQuery })
          ]).then((results) => {
            const out = [];
            const qLang = queryObjs[idx]?.lang || 'mixed';
            const ddgRes = results[0];
            if (ddgRes.status === 'fulfilled') {
              ddgSuccess += 1;
              if (!ddgRes.value.length) ddgEmpty += 1;
              out.push(...ddgRes.value.map((r) => ({ ...r, engine: 'ddg', queryUsed: q, queryLang: qLang })));
            } else {
              ddgErrors.push(ddgRes.reason?.message || ddgRes.reason);
            }

            const gdeltRes = results[1];
            if (gdeltRes.status === 'fulfilled') {
              gdeltSuccess += 1;
              if (!gdeltRes.value.length) gdeltEmpty += 1;
              out.push(...gdeltRes.value.map((r) => ({ ...r, engine: 'gdelt', queryUsed: q, queryLang: qLang })));
            } else {
              gdeltErrors.push(gdeltRes.reason?.message || gdeltRes.reason);
            }

            return out;
          })
        );

        const candidatesNested = await Promise.all(searchTasks);
        const candidates = dedupeCandidates(candidatesNested.flat()).slice(0, 250);

        ddgOk = ddgSuccess > 0;
        gdeltOk = gdeltSuccess > 0;
        ddgMsg = ddgOk
          ? `DDG 搜索成功${ddgEmpty ? `（${ddgEmpty} 次无结果）` : ''}`
          : `DDG 搜索失败${ddgErrors.length ? `: ${ddgErrors[0]}` : ''}`;
        gdeltMsg = gdeltOk
          ? `GDELT 搜索成功${gdeltEmpty ? `（${gdeltEmpty} 次无结果）` : ''}`
          : `GDELT 搜索失败${gdeltErrors.length ? `: ${gdeltErrors[0]}` : ''}`;

        if (!candidates.length) {
          snippets = [];
        } else {
          const candidatePool = candidates;
          const candidatesWithId = candidatePool.map((c, idx) => ({
            id: `${c.engine}:${idx + 1}`,
            hasDate: Boolean(c.datePublished),
            hasSourceName: Boolean(c.sourceName),
            titleLen: String(c.title || '').length,
            snippetLen: String(c.snippet || '').length,
            urlDepth: String(c.url || '').replace(/^https?:\/\//, '').split('/').length - 1,
            urlHasDate: /\b(20\d{2}|19\d{2})[-_/]?\d{1,2}[-_/]?\d{1,2}\b/.test(c.url || ''),
            ...c
          }));

          let filteredCandidates = candidatesWithId;
          if (useProcessAgent && (hasAgentKey || isAgentConfigured())) {
            try {
              const filterRes = await agentFilter({
                candidates: candidatesWithId,
                apiKey: hasAgentKey ? agentApiKey.trim() : undefined
              });
              const newsIds = Array.isArray(filterRes?.news_ids) ? filterRes.news_ids : [];
              const bgIds = Array.isArray(filterRes?.background_ids)
                ? filterRes.background_ids.slice(0, 1)
                : [];
              const keepIds = [...newsIds, ...bgIds];
              if (keepIds.length) {
                const keepSet = new Set(keepIds);
                filteredCandidates = candidatesWithId.filter((c) => keepSet.has(c.id));
              }
            } catch (err) {
              console.warn('[analyze] agentFilter failed, fallback to unfiltered candidates', err?.message || err);
            }
          }

          let selected = filteredCandidates;
          let usedAgentSelect = false;
          if (useProcessAgent && (hasAgentKey || isAgentConfigured())) {
            try {
              const selection = await agentSelect({
                candidates: filteredCandidates,
                maxOutput: maxSnippets,
                apiKey: hasAgentKey ? agentApiKey.trim() : undefined
              });
              const selectedIds = Array.isArray(selection?.selected_ids)
                ? selection.selected_ids
                : [];
              if (selectedIds.length) {
                const selectedSet = new Set(selectedIds);
                selected = filteredCandidates.filter((c) => selectedSet.has(c.id));
                usedAgentSelect = true;
              }
            } catch (err) {
              console.warn('[analyze] agentSelect failed, fallback to heuristic ranking', err?.message || err);
            }
          }

          if (!usedAgentSelect) {
            selected = rankCandidates(filteredCandidates, queryTerms);
          }

          snippets = selected.slice(0, maxSnippets).map((c) => ({
            title: c.title || '',
            snippet: c.snippet || '',
            url: c.url || '',
            sourceName: c.sourceName || c.engine || '',
            datePublished: c.datePublished || ''
          }));
        }
      } catch (err) {
        ddgOk = false;
        gdeltOk = false;
        ddgMsg = err?.message || 'DDG 搜索失败';
        gdeltMsg = err?.message || 'GDELT 搜索失败';
        console.warn('[analyze] search failed, fallback to empty snippets', err?.message || err);
        snippets = [];
      }
    }

    const article = await articlePromise;

    let analysis;
    let agentOk = true;
    let agentMsg = 'Agent 分析成功';
    let agentUsed = false;
    const hasAgentKey = typeof agentApiKey === 'string' && agentApiKey.trim().length > 0;
    if (agentUrl || hasAgentKey || isAgentConfigured()) {
      const rawText = buildRawText({
        query: normalizedQuery,
        context: body.context ?? {},
        snippets,
        article
      });

      try {
        const agentOut = await agentAnalyze({
          query: normalizedQuery,
          context: body.context ?? {},
          snippets,
          rawText,
          agentUrl,
          apiKey: hasAgentKey ? agentApiKey.trim() : undefined
        });
        analysis = AnalyzeOutput.parse(agentOut);
        agentUsed = true;
      } catch (err) {
        agentOk = false;
        agentMsg = err?.message || 'Agent 分析失败';
        analysis = buildFallbackAnalysis({ query: normalizedQuery, snippets });
      }
    } else {
      agentOk = false;
      agentMsg = '未配置 Agent API Key';
      analysis = buildFallbackAnalysis({ query: normalizedQuery, snippets });
    }
    analysis.timeline = sortTimeline(analysis.timeline);
    analysis = enforceChineseAnalysis(analysis);
    analysis.sources = snippets;
    analysis.meta = {
      ddg: { ok: ddgOk, message: `DDG: ${ddgMsg}; GDELT: ${gdeltMsg}` },
      agent: { ok: agentOk, message: agentMsg, used: agentUsed }
    };

    res.json({
      code: 200,
      data: analysis
    });
  } catch (err) {
    next(err);
  }
});
