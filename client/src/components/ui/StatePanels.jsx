// Shared "loading" and "something went wrong" panels.
export function LoadingPanel({ label = 'Loading' }) {
  return (
    <div className="window p-6" role="status">
      <p className="pixel-label text-silver">
        &gt; {label}
        <span className="ml-1 inline-block h-[0.9em] w-[0.5em] translate-y-[0.1em] animate-blink bg-orchid" aria-hidden="true" />
      </p>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }) {
  return (
    <div className="window p-6" role="alert">
      <p className="pixel-label text-rose">Connection problem</p>
      <p className="mt-3 text-chrome">{message}.</p>
      <p className="mt-1 text-sm text-silver">
        {import.meta.env.DEV
          ? 'Check that the backend is running (npm run dev), then try again.'
          : 'Please try again in a moment.'}
      </p>
      {onRetry && (
        <button type="button" className="btn-ghost mt-5" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
