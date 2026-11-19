import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { audioParamsSchema, externalSearchSchema, deezerAudioParamsSchema, youtubeLookupSchema } from '../validation/schemas.js';
import { getSampleAudio, getProviders, getExternalSearch, getDeezerAudio, getYouTubeVideo } from '../controllers/music.controller.js';

export const audioRouter = Router();
// GET /api/audio/sample/static-lullaby.wav  - original generated audio
audioRouter.get('/sample/:file', validate('params', audioParamsSchema), getSampleAudio);
// GET /api/audio/deezer/3135556           - redirects to a fresh Deezer preview
audioRouter.get('/deezer/:id', validate('params', deezerAudioParamsSchema), getDeezerAudio);

export const musicRouter = Router();
// GET /api/music/providers           - which music providers are switched on
musicRouter.get('/providers', getProviders);
// GET /api/music/search?q=...&source=deezer|jamendo|spotify - search real songs
musicRouter.get('/search', validate('query', externalSearchSchema), getExternalSearch);

// GET /api/music/youtube?song_id=...    - the YouTube video for a song (full playback)
// Each new song costs YouTube quota, so lookups are limited per visitor.
musicRouter.get(
  '/youtube',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { message: 'Too many full-song requests. Please wait a minute' } },
  }),
  validate('query', youtubeLookupSchema),
  getYouTubeVideo,
);
