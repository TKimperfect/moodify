import { getRecommendations } from '../services/recommendation.service.js';

export async function postRecommendations(req, res) {
  const result = await getRecommendations(req.valid.body, req.db ?? null);
  res.json({ ...result, personalised: Boolean(req.user) });
}
