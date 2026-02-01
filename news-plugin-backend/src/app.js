import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { errorMiddleware } from './middleware/error.js';
import { notFoundMiddleware } from './middleware/notFound.js';

import { healthRouter } from './routes/health.js';
import { searchRouter } from './routes/search.js';
import { analyzeRouter } from './routes/analyze.js';

export function createApp() {
  dotenv.config();

  const app = express();

  // Behind reverse proxies (deployments), this helps rate-limit & IP.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  // Basic rate limit (tune as needed)
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  // CORS
  const originsRaw = process.env.CORS_ORIGINS || '*';
  const origins = originsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: origins.includes('*') ? true : origins,
      credentials: true
    })
  );

  // Routes
  app.use('/health', healthRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/analyze', analyzeRouter);

  // 404 + error
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
