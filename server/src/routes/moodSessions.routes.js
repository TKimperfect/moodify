import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { moodSessionCreateSchema, listLimitSchema, uuidParamsSchema } from '../validation/schemas.js';
import * as controller from '../controllers/moodSessions.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate('query', listLimitSchema), controller.getMoodSessions);
router.post('/', validate('body', moodSessionCreateSchema), controller.postMoodSession);
router.delete('/:id', validate('params', uuidParamsSchema), controller.deleteMoodSession);

export default router;
