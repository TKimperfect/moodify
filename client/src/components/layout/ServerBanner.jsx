import { useEffect, useState } from 'react';

// A small notice while the server is asleep and waking up (free hosting).
export default function ServerBanner() {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let timer;
    const onChange = (event) => {
      clearTimeout(timer);
      // Only show it if waiting lasts more than a moment.
      if (event.detail.waiting) timer = setTimeout(() => setWaiting(true), 800);
      else setWaiting(false);
    };
    window.addEventListener('moodify:server', onChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('moodify:server', onChange);
    };
  }, []);

  if (!waiting) return null;
  return (
    <div className="border-b border-orchid/40 bg-violet/25 px-4 py-2 text-center text-sm text-frost" role="status">
      <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-orchid" aria-hidden="true" />
      Connecting to the MOODIFY server. If it was asleep this can take up to a minute.
    </div>
  );
}
