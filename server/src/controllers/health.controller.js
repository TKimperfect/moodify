// Controllers translate between HTTP (requests/responses) and services.
// They contain no business logic of their own.
import { getHealthStatus } from '../services/health.service.js';

export async function getHealth(req, res) {
  res.json(await getHealthStatus());
}
