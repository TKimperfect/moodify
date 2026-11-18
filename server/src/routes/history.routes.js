import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { historyCreateSchema, historyListSchema, songIdParamsSchema } from '../validation/schemas.js';
import * as controller from '../controllers/history.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate('query', historyListSchema), controller.getHistory);
router.post('/', validate('body', historyCreateSchema), controller.postHistory);
router.delete('/rejections', controller.deleteRejections);
router.delete('/rejections/:songId', validate('params', songIdParamsSchema), controller.deleteRejection);

export default router;
