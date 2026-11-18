import { useCallback, useEffect, useState } from 'react';

// Small helper for pages that load data from the backend.
// "load" receives an AbortSignal and returns a promise with the data.
// Returns { status: 'loading' | 'ok' | 'error', data, error, reload }.
export function useApi(load, deps) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading', error: null }));
    load(controller.signal)
      .then((data) => setState({ status: 'ok', data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', data: null, error: error.message });
      });
    // If the page changes before the reply arrives, cancel the request.
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, reload };
}
