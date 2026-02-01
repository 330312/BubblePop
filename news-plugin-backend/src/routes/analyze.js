import { Router } from 'express';
import { z } from 'zod';

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

function buildRawText({ query, context, snippets }) {
  // The python Agent.py expects a single text blob.
  const parts = [];
  parts.push(`QUERY: ${query}`);
  if (context?.currentUrl) parts.push(`CURRENT_URL: ${context.currentUrl}`);
  if (context?.timestamp) parts.push(`TIMESTAMP: ${context.timestamp}`);
  parts.push('');
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
  return parts.join('\n');
}

analyzeRouter.post('/', async (req, res, next) => {
  try {
    const body = AnalyzeBody.parse(req.body);

    const count = Number(process.env.BOCHA_COUNT || 20);
    const freshness = process.env.BOCHA_FRESHNESS || 'noLimit';

    const snippets = await bochaSearch({ query: body.query, count, freshness });

    let analysis;
    if (isAgentConfigured()) {
      const rawText = buildRawText({ query: body.query, context: body.context ?? {}, snippets });

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
