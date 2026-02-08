import { Router } from 'express';
import { z } from 'zod';

import { ddgSearch } from '../services/ddg.js';
import { gdeltSearch } from '../services/gdelt.js';
import { normalizeQuery } from '../utils/query.js';
import { agentSelect, agentStrategy, agentSummarize } from '../services/agent.js';

export const newsRouter = Router();

const NewsBody = z.object({
  selection: z.string().min(1).max(600),
  pageTitle: z.string().optional(),
  pageUrl: z.string().optional(),
  region: z.string().optional(),
  maxQueries: z.number().int().min(1).max(8).optional(),
  maxPerQuery: z.number().int().min(5).max(30).optional(),
  maxOutput: z.number().int().min(5).max(20).optional()
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

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\p{P}\p{S}]/gu, '')
    .trim();
}

function dedupeCandidates(items) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const out = [];
  for (const item of items) {
    const urlKey = normalizeUrl(item.url);
    const titleKey = normalizeTitle(item.title);
    if (urlKey && seenUrl.has(urlKey)) continue;
    if (titleKey && seenTitle.has(titleKey)) continue;
    if (urlKey) seenUrl.add(urlKey);
    if (titleKey) seenTitle.add(titleKey);
    out.push(item);
  }
  return out;
}

newsRouter.post('/', async (req, res, next) => {
  try {
    const body = NewsBody.parse(req.body);
    const agentApiKey = req.headers['x-agent-key'];
    if (!agentApiKey || typeof agentApiKey !== 'string') {
      return res.status(400).json({
        code: 400,
        message: '缺少 Agent API Key'
      });
    }

    const maxQueries = body.maxQueries ?? 4;
    const maxPerQuery = body.maxPerQuery ?? 10;
    const maxOutput = body.maxOutput ?? 10;

    const strategy = await agentStrategy({
      selection: body.selection,
      pageTitle: body.pageTitle,
      pageUrl: body.pageUrl,
      maxQueries,
      apiKey: agentApiKey.trim()
    });

    const rawQueries = Array.isArray(strategy?.queries) ? strategy.queries : [];
    const normalizedQueries = rawQueries
      .map((q) => ({
        q: normalizeQuery(q?.q || ''),
        priority: Number(q?.priority || 999),
        angle: q?.angle || ''
      }))
      .filter((q) => q.q)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, maxQueries);

    if (!normalizedQueries.length) {
      return res.json({
        code: 200,
        data: {
          items: [],
          meta: { mode: 'news', queries: [] }
        }
      });
    }

    const searchTasks = normalizedQueries.map((queryObj) => {
      const q = queryObj.q;
      return Promise.allSettled([
        ddgSearch({ query: q, count: maxPerQuery, region: body.region }),
        gdeltSearch({ query: q, maxrecords: maxPerQuery })
      ]).then((results) => {
        const out = [];
        if (results[0].status === 'fulfilled') {
          out.push(...results[0].value.map((r) => ({ ...r, engine: 'ddg', queryUsed: q })));
        }
        if (results[1].status === 'fulfilled') {
          out.push(...results[1].value.map((r) => ({ ...r, engine: 'gdelt', queryUsed: q })));
        }
        return out;
      });
    });

    const candidatesNested = await Promise.all(searchTasks);
    const candidates = dedupeCandidates(candidatesNested.flat()).slice(0, 200);

    if (!candidates.length) {
      return res.json({
        code: 200,
        data: {
          items: [],
          meta: { mode: 'news', queries: normalizedQueries }
        }
      });
    }

    const candidatesWithId = candidates.map((c, idx) => ({
      id: `${c.engine}:${idx + 1}`,
      ...c
    }));

    const selection = await agentSelect({
      candidates: candidatesWithId,
      maxOutput,
      apiKey: agentApiKey.trim()
    });
    const selectedIds = Array.isArray(selection?.selected_ids) ? selection.selected_ids : [];
    const selectedSet = new Set(selectedIds);
    const selected = selectedIds.length
      ? candidatesWithId.filter((c) => selectedSet.has(c.id)).slice(0, maxOutput)
      : candidatesWithId.slice(0, maxOutput);

    const summaries = await agentSummarize({
      items: selected,
      apiKey: agentApiKey.trim()
    });
    const summaryMap = new Map(
      Array.isArray(summaries?.summaries)
        ? summaries.summaries.map((s) => [s.id, s.summary])
        : []
    );

    const items = selected.map((c) => ({
      title: c.title,
      source: c.sourceName || c.engine,
      url: c.url,
      summary: summaryMap.get(c.id) || c.snippet || c.title,
      date: c.datePublished || ''
    }));

    res.json({
      code: 200,
      data: {
        items,
        meta: {
          mode: 'news',
          queries: normalizedQueries
        }
      }
    });
  } catch (err) {
    next(err);
  }
});
