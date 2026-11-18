// Catches any error thrown inside a route so the server answers with
// clean JSON instead of crashing or leaking internal details.
import { env } from '../config/env.js';

// Express recognises an error handler by its four arguments.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = Number.isInteger(err.status ?? err.statusCode) ? (err.status ?? err.statusCode) : 500;

  if (status >= 500) {
    console.error(err);
  }

  const message =
    status >= 500 && status !== 503 && env.nodeEnv === 'production' ? 'Internal server error' : err.message;

  res.status(status).json({ error: { message } });
}
