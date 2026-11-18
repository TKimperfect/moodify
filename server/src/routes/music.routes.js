import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { audioParamsSchema, externalSearchSchema } from '../validation/schemas.js';
import { getSampleAudio, getProviders, getExternalSearch } from '../controllers/music.controller.js';

export const audioRouter = Router();
// GET /api/audio/sample/static-lullaby.wav  - original generated audio
audioRouter.get('/sample/:file', validate('params', audioParamsSchema), getSampleAudio);

export const musicRouter = Router();
// GET /api/music/providers           - which music providers are switched on
musicRouter.get('/providers', getProviders);
// GET /api/music/search?q=...&source=deezer|jamendo|spotify - search real songs
musicRouter.get('/search', validate('query', externalSearchSchema), getExternalSearch);
