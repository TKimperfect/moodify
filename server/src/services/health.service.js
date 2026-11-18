// Reports that the server is alive and where its data comes from.
import { env } from '../config/env.js';
import { songRepository } from '../repositories/song.repository.js';
import { assistantStatus } from './assistant.service.js';
import { providersStatus } from './music/music.service.js';

const startedAt = Date.now();

export async function getHealthStatus() {
  const database = await songRepository.status({ fresh: true });
  return {
    status: 'ok',
    service: 'moodify-api',
    version: '1.0.0',
    environment: env.nodeEnv,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    assistant: assistantStatus(),
    music: Object.fromEntries(Object.entries(providersStatus()).map(([id, value]) => [id, value.enabled])),
    database: {
      configured: database.configured,
      connected: database.source === 'supabase',
      song_source: database.source,
      songs: database.songs,
      by_provider: database.by_provider,
      // Shown on the status page so setup problems are easy to spot.
      note: database.configured ? database.problem : 'Supabase is not configured; using built-in sample songs',
    },
  };
}
