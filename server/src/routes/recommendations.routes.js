import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { recommendationRequestSchema } from '../validation/schemas.js';
import { postRecommendations } from '../controllers/recommendations.controller.js';

const router = Router();

// POST /api/recommendations  - songs for a mood profile.
// Works without an account; logged-in users also get their saved
// favourites and rejections taken into account.
router.post('/', optionalAuth, validate('body', recommendationRequestSchema), postRecommendations);

export default router;
