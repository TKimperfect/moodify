import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { assistantMessageSchema, assistantAnalyzeSchema } from '../validation/schemas.js';
import { postMessage, postAnalyze } from '../controllers/assistant.controller.js';

const router = Router();

// AI replies can cost money: at most 30 messages per minute per address.
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { message: 'You are sending messages very quickly. Please wait a moment' } },
  }),
);

// POST /api/assistant/message  - one turn of the mood conversation
router.post('/message', validate('body', assistantMessageSchema), postMessage);
// POST /api/assistant/analyze  - read the mood in a single piece of text
router.post('/analyze', validate('body', assistantAnalyzeSchema), postAnalyze);

export default router;
