// Builds the Express application (but does not start it).
// Keeping this separate from index.js lets tests use the app
// without opening a real network port.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { accessLog } from './middleware/accessLog.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);
  if (env.isProduction) app.use(accessLog);
  app.use(helmet()); // safer default HTTP headers
  app.use(cors({ origin: env.clientOrigins, maxAge: 600 }));
  app.use(express.json({ limit: '100kb' }));

  // General protection against floods: 300 requests per minute per address.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: { message: 'Too many requests. Please slow down' } },
    }),
  );

  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
