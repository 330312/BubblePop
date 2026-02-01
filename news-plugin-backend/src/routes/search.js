import { Router } from 'express';
import { z } from 'zod';

import { bochaSearch } from '../services/bing.js';
import { AppError } from '../utils/error.js';

export const searchRouter = Router();

const SearchBody = z.object({
  query: z.string().min(1, 'query is required').max(200),
  count: z.number().int().min(1).max(50).optional(),
  freshness: z.string().optional()
});

searchRouter.post('/', async (req, res, next) => {
  try {
    const body = SearchBody.parse(req.body);
    const count = body.count ?? Number(process.env.BOCHA_COUNT || 20);
    const freshness = body.freshness ?? process.env.BOCHA_FRESHNESS ?? 'noLimit';

    const results = await bochaSearch({ query: body.query, count, freshness });

    if (!results.length) {
      throw new AppError(502, 'No results from Bocha (or parsing failed)');
    }

    res.json({
      code: 200,
      data: {
        query: body.query,
        results
      }
    });
  } catch (err) {
    next(err);
  }
});
