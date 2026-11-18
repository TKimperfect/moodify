import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../lib/api.js';
import Window from '../components/ui/Window.jsx';

// Diagnostic page: shows whether the frontend can reach the backend.
export default function SystemCheck() {
  const [state, setState] = useState({ phase: 'loading', data: null, error: null });

  const check = useCallback(async () => {
    setState({ phase: 'loading', data: null, error: null });
    try {
      const data = await apiGet('/health');
      setState({ phase: 'ok', data, error: null });
    } catch (error) {
      setState({ phase: 'error', data: null, error: error.message });
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const database = state.data?.database;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
      <Window title="system_status.exe" status={state.phase}>
        <div className="p-6 sm:p-8" aria-live="polite">
          <h1 className="font-display text-xl tracking-wider text-frost">System status</h1>

          <div className="mt-5">
            <StatusRow label="Frontend (React + Vite)" phase="ok" detail="running" />
            <StatusRow
              label="Backend (Express API)"
              phase={state.phase}
              detail={
                state.phase === 'ok'
                  ? `connected · ${state.data.environment}`
                  : state.phase === 'loading'
                    ? 'checking…'
                    : 'not reachable'
              }
            />
            {database && (
              <>
                <StatusRow
                  label="Database (Supabase)"
                  phase={database.connected ? 'ok' : database.configured ? 'error' : 'idle'}
                  detail={database.connected ? 'connected' : database.configured ? 'problem' : 'not configured'}
                />
                <StatusRow
                  label="Song catalogue"
                  phase="ok"
                  detail={`${database.songs} songs · ${database.song_source === 'supabase' ? 'from database' : 'local'}${database.by_provider?.jamendo ? ` · ${database.by_provider.jamendo} from Jamendo` : ''}`}
                />
              </>
            )}
          </div>

          {state.data?.music && (
            <div className="-mt-px">
              <StatusRow
                label="Music sources"
                phase="ok"
                detail={Object.entries(state.data.music)
                  .filter(([, enabled]) => enabled)
                  .map(([id]) => id)
                  .join(' · ')}
              />
            </div>
          )}

          {state.data?.assistant && (
            <div className="-mt-px">
              <StatusRow
                label="Mood assistant"
                phase="ok"
                detail={state.data.assistant.provider === 'anthropic' ? 'AI · Claude' : 'built-in (free)'}
              />
            </div>
          )}

          {database?.note && <p className="mt-4 text-sm text-silver">{database.note}.</p>}

          {state.phase === 'error' && (
            <p className="mt-4 text-sm text-rose">
              {state.error}. Make sure the backend is running, then try again.
            </p>
          )}

          <button type="button" onClick={check} disabled={state.phase === 'loading'} className="btn-ghost mt-6">
            Check again
          </button>
        </div>
      </Window>
    </div>
  );
}

const DOT = {
  ok: 'bg-emerald-400',
  loading: 'bg-chrome animate-pulse',
  error: 'bg-rose',
  idle: 'border border-silver',
};

function StatusRow({ label, phase, detail }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 text-sm last:border-b-0">
      <span className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[phase]}`} aria-hidden="true" />
        {label}
      </span>
      <span className="pixel-label text-right text-silver">{detail}</span>
    </div>
  );
}
