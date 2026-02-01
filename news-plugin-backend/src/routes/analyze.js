import { Router } from 'express';
import { z } from 'zod';
import axios from 'axios';

import { bochaSearch } from '../services/bing.js';
import { agentAnalyze, isAgentConfigured } from '../services/agent.js';
import { buildFallbackAnalysis } from '../utils/fallbackAnalyze.js';

export const analyzeRouter = Router();

const AnalyzeBody = z.object({
  query: z.string().min(1, 'query is required').max(200),
  context: z
    .object({
      currentUrl: z.string().url().optional(),
      timestamp: z.string().datetime().optional()
    })
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
  )
});

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

    const count = Number(process.env.BOCHA_COUNT || 20);
    const freshness = process.env.BOCHA_FRESHNESS || 'noLimit';

    const snippets = await bochaSearch({ query: body.query, count, freshness });

    const article = await fetchArticleForContext(body.context?.currentUrl);

    let analysis;
    if (isAgentConfigured()) {
      const rawText = buildRawText({
        query: body.query,
        context: body.context ?? {},
        snippets,
        article
      });

      const agentOut = await agentAnalyze({
        query: body.query,
        context: body.context ?? {},
        snippets,
        rawText
      });

      analysis = AnalyzeOutput.parse(agentOut);
    } else {
      analysis = buildFallbackAnalysis({ query: body.query, snippets });
    }

    res.json({
      code: 200,
      data: analysis
    });
  } catch (err) {
    next(err);
  }
});
