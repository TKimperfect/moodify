import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  playlistCreateSchema,
  playlistUpdateSchema,
  playlistSongBodySchema,
  playlistSongParamsSchema,
  uuidParamsSchema,
} from '../validation/schemas.js';
import * as controller from '../controllers/playlists.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', controller.getPlaylists);
router.post('/', validate('body', playlistCreateSchema), controller.postPlaylist);
router.get('/:id', validate('params', uuidParamsSchema), controller.getPlaylist);
router.patch('/:id', validate('params', uuidParamsSchema), validate('body', playlistUpdateSchema), controller.patchPlaylist);
router.delete('/:id', validate('params', uuidParamsSchema), controller.deletePlaylist);
router.post('/:id/songs', validate('params', uuidParamsSchema), validate('body', playlistSongBodySchema), controller.postPlaylistSong);
router.delete('/:id/songs/:songId', validate('params', playlistSongParamsSchema), controller.deletePlaylistSong);

export default router;
