// Entry point: starts the backend server.
import { createApp } from './app.js';
import { env } from './config/env.js';
import { isSupabaseConfigured } from './lib/supabase.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`MOODIFY API running at http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`Health check:        http://localhost:${env.port}/api/health`);
  console.log(`Allowed frontends:   ${env.clientOrigins.join(', ')}`);
  console.log(
    isSupabaseConfigured
      ? 'Database:            Supabase configured'
      : 'Database:            not configured (using built-in sample songs; accounts disabled)',
  );
});

// Hosting platforms stop the app with SIGTERM when they restart or redeploy:
// finish the requests in progress, then exit.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
