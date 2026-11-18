import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { songSearchSchema, songParamsSchema } from '../validation/schemas.js';
import { listSongs, showSong, showDiscover } from '../controllers/songs.controller.js';

const router = Router();

// GET /api/songs?q=&mood=&genre=&limit=   - search / browse
router.get('/', validate('query', songSearchSchema), listSongs);
// GET /api/songs/discover                 - data for the Discover page
router.get('/discover', showDiscover);
// GET /api/songs/:id                      - one song
router.get('/:id', validate('params', songParamsSchema), showSong);

export default router;
