// Reads settings from the ".env" file and exposes them in one place.
// Every other file imports settings from here instead of reading
// process.env directly, so there is a single source of truth.
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error(`PORT must be a number between 0 and 65535, got "${process.env.PORT}"`);
}

const read = (...names) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
};

const supabaseUrl = read('SUPABASE_URL').replace(/\/+$/, '');
if (supabaseUrl && !/^https?:\/\/.+/.test(supabaseUrl)) {
  throw new Error('SUPABASE_URL must look like https://your-project.supabase.co');
}

// One or more frontend addresses, separated by commas, e.g.
// "https://moodify.vercel.app,http://localhost:5173". The first one is used
// in links (for example in confirmation emails).
const clientOrigins = (read('CLIENT_ORIGIN') || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
for (const origin of clientOrigins) {
  if (!/^https?:\/\/[^/\s]+$/.test(origin)) throw new Error(`CLIENT_ORIGIN must be addresses like https://moodify.vercel.app, got "${origin}"`);
}

const nodeEnv = read('NODE_ENV') || 'development';

export const env = {
  port,
  nodeEnv,
  isProduction: nodeEnv === 'production',
  clientOrigin: clientOrigins[0],
  clientOrigins,
  // Hosting platforms put a proxy in front of the app; trusting one hop lets
  // rate limits see the real visitor address. Set TRUST_PROXY=0 to turn off.
  trustProxy: read('TRUST_PROXY') ? Number(read('TRUST_PROXY')) : nodeEnv === 'production' ? 1 : 0,
  supabase: {
    url: supabaseUrl,
    // The older key names (anon / service_role) are accepted too.
    publishableKey: read('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'),
    secretKey: read('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'),
  },
  jamendo: {
    // Optional. Free Creative Commons songs (non-commercial use).
    clientId: read('JAMENDO_CLIENT_ID'),
    apiBase: read('JAMENDO_API_BASE') || 'https://api.jamendo.com',
  },
  deezer: {
    // Public search with 30-second previews; needs no key. Set DEEZER_ENABLED=false to switch off.
    enabled: read('DEEZER_ENABLED').toLowerCase() !== 'false',
    apiBase: read('DEEZER_API_BASE') || 'https://api.deezer.com',
    requestGapMs: Number(read('DEEZER_REQUEST_GAP_MS') || 150),
    // MuSe import: how many songs are looked up at the same time.
    lookupWorkers: Math.min(8, Math.max(1, Number(read('DEEZER_LOOKUP_WORKERS') || 4))),
  },
  datasets: {
    // Where the research datasets are downloaded from (changeable for tests or mirrors).
    mtgUrl: read('MTG_JAMENDO_URL'),
    museUrl: read('MUSE_URL'),
  },
  youtube: {
    // Optional. Full songs through YouTube's embedded player.
    apiKey: read('YOUTUBE_API_KEY'),
    apiBase: read('YOUTUBE_API_BASE') || 'https://www.googleapis.com',
  },
  spotify: {
    // Optional. Song information and links from Spotify.
    clientId: read('SPOTIFY_CLIENT_ID'),
    clientSecret: read('SPOTIFY_CLIENT_SECRET'),
    market: read('SPOTIFY_MARKET'),
    apiBase: read('SPOTIFY_API_BASE') || 'https://api.spotify.com',
    accountsBase: read('SPOTIFY_ACCOUNTS_BASE') || 'https://accounts.spotify.com',
  },
  anthropic: {
    // Optional. Without a key the assistant uses the free rule-based engine.
    apiKey: read('ANTHROPIC_API_KEY'),
    model: read('ANTHROPIC_MODEL') || 'claude-opus-5-5',
    baseURL: read('ANTHROPIC_BASE_URL'),
  },
};
