import { Router } from 'express';
import { z } from 'zod';

import { ddgSearch } from '../services/ddg.js';
import { normalizeQuery } from '../utils/query.js';

export const searchRouter = Router();

const SearchBody = z.object({
  query: z.string().min(1, 'query is required').max(200),
  count: z.number().int().min(1).max(50).optional(),
  region: z.string().optional(),
  freshness: z.string().optional()
});

searchRouter.post('/', async (req, res, next) => {
  try {
    const body = SearchBody.parse(req.body);
    const normalizedQuery = normalizeQuery(body.query);
    if (!normalizedQuery) {
      return res.status(400).json({
        code: 400,
        message: 'query is required'
      });
    }
    const count = body.count ?? Number(process.env.BOCHA_COUNT || 20);
    let results = [];
    try {
      results = await ddgSearch({ query: normalizedQuery, count, region: body.region });
    } catch (err) {
      console.warn('[search] ddgSearch failed, returning empty results', err?.message || err);
      results = [];
    }

    if (!results.length) {
      return res.json({
        code: 200,
        data: {
          query: normalizedQuery,
          results: []
        }
      });
    }

    res.json({
      code: 200,
      data: {
        query: normalizedQuery,
        results
      }
    });
  } catch (err) {
    next(err);
  }
});
