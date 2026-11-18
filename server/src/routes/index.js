// Collects every group of routes under the "/api" prefix.
import { Router } from 'express';
import healthRoutes from './health.routes.js';
import songsRoutes from './songs.routes.js';
import recommendationsRoutes from './recommendations.routes.js';
import authRoutes from './auth.routes.js';
import assistantRoutes from './assistant.routes.js';
import { audioRouter, musicRouter } from './music.routes.js';
import favoritesRoutes from './favorites.routes.js';
import playlistsRoutes from './playlists.routes.js';
import historyRoutes from './history.routes.js';
import moodSessionsRoutes from './moodSessions.routes.js';

const router = Router();

// Open to everyone
router.use('/health', healthRoutes);
router.use('/songs', songsRoutes);
router.use('/recommendations', recommendationsRoutes);
router.use('/auth', authRoutes);
router.use('/assistant', assistantRoutes);
router.use('/audio', audioRouter);
router.use('/music', musicRouter);

// Logged-in users only
router.use('/favorites', favoritesRoutes);
router.use('/playlists', playlistsRoutes);
router.use('/history', historyRoutes);
router.use('/mood-sessions', moodSessionsRoutes);

export default router;
