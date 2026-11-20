// Describes exactly what each request is allowed to contain.
// Anything that does not match is rejected before it reaches the logic.
import { z } from 'zod';
import { MOOD_IDS, EFFECT_IDS, GENRE_IDS, TEMPO_IDS, LANGUAGE_IDS, SONG_LANGUAGE_IDS, withoutRetired } from '../data/taxonomy.js';

const songId = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, 'Invalid song id');
const idList = z.array(songId).max(300).default([]);
const unique = (items) => new Set(items).size === items.length;
const uuid = z.uuid();

// ---------- moods and recommendations ----------
export const moodProfileSchema = z.strictObject({
  moods: z.array(z.enum(MOOD_IDS)).min(1).max(3).refine(unique, 'Moods must not repeat'),
  energy: z.number().int().min(0).max(100),
  intensity: z.number().int().min(0).max(100),
  genres: z.array(z.enum(GENRE_IDS)).max(GENRE_IDS.length).refine(unique, 'Genres must not repeat').default([]),
  desired_effect: z.enum(EFFECT_IDS),
  tempo: z.enum(TEMPO_IDS).default('any'),
  languages: z.preprocess(withoutRetired, z.array(z.enum(LANGUAGE_IDS)).max(LANGUAGE_IDS.length).refine(unique, 'Languages must not repeat').default([])),
});

export const recommendationRequestSchema = z.strictObject({
  profile: moodProfileSchema,
  feedback: z
    .strictObject({ liked: idList, rejected: idList, recent: idList, skipped: idList })
    .default({ liked: [], rejected: [], recent: [], skipped: [] }),
  limit: z.number().int().min(1).max(20).default(10),
});

// ---------- songs ----------
export const songSearchSchema = z.strictObject({
  q: z.string().max(80).optional(),
  mood: z.enum(MOOD_IDS).optional(),
  genre: z.enum(GENRE_IDS).optional(),
  language: z.enum(SONG_LANGUAGE_IDS).optional(),
  ids: z
    .string()
    .max(4000)
    .transform((text) => text.split(',').filter(Boolean))
    .pipe(z.array(songId).max(50))
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  // "shuffle" mixes the matches in an order fixed by seed, so "Show more"
  // continues the same order; "popular" puts the most played first.
  sort: z.enum(['popular', 'shuffle']).default('popular'),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
});

export const songParamsSchema = z.strictObject({ id: songId });
export const songIdParamsSchema = z.strictObject({ songId });

// ---------- accounts ----------
const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'));
const displayName = z.string().trim().min(1).max(60);

export const registerSchema = z.strictObject({
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
  display_name: displayName.optional(),
});

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1).max(72),
});

export const deleteAccountSchema = z.strictObject({ confirm: z.literal('DELETE', { error: 'Type DELETE to confirm' }) });

export const refreshSchema = z.strictObject({ refresh_token: z.string().min(1).max(2000) });

export const profileUpdateSchema = z
  .strictObject({
    display_name: displayName.optional(),
    favorite_genres: z.array(z.enum(GENRE_IDS)).max(GENRE_IDS.length).refine(unique, 'Genres must not repeat').optional(),
    favorite_languages: z.preprocess(withoutRetired, z.array(z.enum(LANGUAGE_IDS)).max(LANGUAGE_IDS.length).refine(unique, 'Languages must not repeat').optional()),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

// ---------- mood sessions ----------
export const moodSessionCreateSchema = z.strictObject({
  profile: moodProfileSchema,
  source: z.enum(['manual', 'assistant']).default('manual'),
});

export const listLimitSchema = z.strictObject({ limit: z.coerce.number().int().min(1).max(100).default(50) });
export const uuidParamsSchema = z.strictObject({ id: uuid });

// ---------- playlists ----------
const playlistName = z.string().trim().min(1, 'Give the playlist a name').max(80);
const playlistDescription = z.string().trim().max(300);

export const playlistCreateSchema = z.strictObject({
  name: playlistName,
  description: playlistDescription.default(''),
  mood_session_id: uuid.nullish(),
  song_ids: z.array(songId).max(100).refine(unique, 'Songs must not repeat').default([]),
});

export const playlistUpdateSchema = z
  .strictObject({ name: playlistName.optional(), description: playlistDescription.optional() })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const playlistSongBodySchema = z.strictObject({ song_id: songId });
export const playlistSongParamsSchema = z.strictObject({ id: uuid, songId });

// ---------- listening history ----------
export const historyCreateSchema = z.strictObject({
  song_id: songId,
  event: z.enum(['played', 'skipped', 'rejected']),
  mood_session_id: uuid.nullish(),
});

export const historyListSchema = z.strictObject({
  event: z.enum(['played', 'skipped', 'rejected']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ---------- AI mood assistant ----------
const nullableLevel = z.number().int().min(0).max(100).nullable();

export const assistantStateSchema = z.strictObject({
  moods: z.array(z.enum(MOOD_IDS)).max(3).refine(unique, 'Moods must not repeat').default([]),
  energy: nullableLevel.default(null),
  intensity: nullableLevel.default(null),
  genres: z.array(z.enum(GENRE_IDS)).max(GENRE_IDS.length).refine(unique, 'Genres must not repeat').default([]),
  desired_effect: z.enum(EFFECT_IDS).nullable().default(null),
  tempo: z.enum(TEMPO_IDS).nullable().default(null),
  languages: z.preprocess(withoutRetired, z.array(z.enum(LANGUAGE_IDS)).max(LANGUAGE_IDS.length).default([])),
  asked: z.array(z.enum(['moods', 'effect', 'energy', 'other'])).max(20).default([]),
  turns: z.number().int().min(0).max(100).default(0),
});

export const assistantMessageSchema = z.strictObject({
  message: z.string().trim().min(1, 'Type a message first').max(1000, 'Please keep messages under 1000 characters'),
  choice: z
    .strictObject({ slot: z.enum(['moods', 'effect', 'energy']), value: z.string().min(1).max(40).regex(/^[a-z-]+$/) })
    .nullish(),
  history: z
    .array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) }))
    .max(40)
    .default([]),
  state: assistantStateSchema.nullish(),
});

export const assistantAnalyzeSchema = z.strictObject({
  text: z.string().trim().min(1).max(1000),
});

// ---------- music ----------
export const audioParamsSchema = z
  .strictObject({ file: z.string().regex(/^[a-z0-9-]{1,80}\.wav$/, 'Invalid audio file name') })
  .transform(({ file }) => ({ id: file.slice(0, -4) }));

export const externalSearchSchema = z.strictObject({
  q: z.string().trim().min(1, 'Type something to search').max(100),
  source: z.enum(['jamendo', 'deezer', 'spotify']).default('deezer'),
  limit: z.coerce.number().int().min(1).max(10).default(10),
});

export const deezerAudioParamsSchema = z.strictObject({ id: z.string().regex(/^\d{1,20}$/, 'Invalid Deezer track id') });

export const youtubeLookupSchema = z
  .strictObject({
    song_id: songId.optional(),
    title: z.string().trim().min(1).max(200).optional(),
    artist: z.string().trim().min(1).max(200).optional(),
  })
  .refine((value) => value.song_id || (value.title && value.artist), 'Give song_id, or title and artist');
