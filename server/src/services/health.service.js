// Reports that the server is alive and where its data comes from.
import { readFileSync } from 'node:fs';
import { env } from '../config/env.js';
import { songRepository } from '../repositories/song.repository.js';
import { assistantStatus } from './assistant.service.js';
import { providersStatus } from './music/music.service.js';

const startedAt = Date.now();
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

export async function getHealthStatus() {
  const database = await songRepository.status();
  return {
    status: 'ok',
    service: 'moodify-api',
    version,
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
      by_language: database.by_language,
      // Shown on the status page so setup problems are easy to spot.
      note: database.configured ? database.problem : 'Supabase is not configured; using built-in sample songs',
    },
  };
}
