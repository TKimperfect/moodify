import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { registerSchema, loginSchema, refreshSchema, profileUpdateSchema, deleteAccountSchema } from '../validation/schemas.js';
import * as controller from '../controllers/auth.controller.js';

const router = Router();

// Slows down password guessing: 30 attempts per 15 minutes per address.
const attempts = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please wait a few minutes and try again' } },
});

router.post('/register', attempts, validate('body', registerSchema), controller.postRegister);
router.post('/login', attempts, validate('body', loginSchema), controller.postLogin);
router.post('/refresh', attempts, validate('body', refreshSchema), controller.postRefresh);
router.post('/logout', requireAuth, controller.postLogout);
router.get('/me', requireAuth, controller.getMe);
router.patch('/me', requireAuth, validate('body', profileUpdateSchema), controller.patchMe);
// Requires typing DELETE as confirmation, so it cannot happen by accident.
router.delete('/me', requireAuth, validate('body', deleteAccountSchema), controller.deleteMe);

export default router;
