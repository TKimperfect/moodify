import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { songIdParamsSchema } from '../validation/schemas.js';
import * as controller from '../controllers/favorites.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', controller.getFavorites);
router.put('/:songId', validate('params', songIdParamsSchema), controller.putFavorite);
router.delete('/:songId', validate('params', songIdParamsSchema), controller.deleteFavorite);

export default router;
