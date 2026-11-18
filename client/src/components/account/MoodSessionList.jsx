import { useNavigate } from 'react-router-dom';
import { summarizeProfile } from '../../lib/moodProfile.js';
import { timeAgo } from '../../lib/time.js';
import { useMoodProfile } from '../../context/MoodProfileContext.jsx';
import { MOODS } from '../../data/moods.js';

const moodLabel = (id) => MOODS.find((mood) => mood.id === id)?.label ?? id;

// A list of saved mood profiles with "Use again" and "Delete".
export default function MoodSessionList({ sessions, onDelete }) {
  const { applyProfile } = useMoodProfile();
  const navigate = useNavigate();

  function useAgain(session) {
    const { id, created_at: createdAt, source, ...profile } = session;
    if (applyProfile(profile, 'history')) navigate('/recommendations');
  }

  return (
    <ul className="space-y-3">
      {sessions.map((session) => (
        <li key={session.id} className="window p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {session.moods.map((mood) => (
                <span key={mood} className="tag tag-mood">
                  {moodLabel(mood)}
                </span>
              ))}
            </div>
            <span className="pixel-label text-silver">
              {timeAgo(session.created_at)} · {session.source === 'assistant' ? 'assistant' : 'mood picker'}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-chrome">{summarizeProfile(session)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="icon-btn" onClick={() => useAgain(session)}>
              ▶ Use again
            </button>
            {onDelete && (
              <button type="button" className="icon-btn" onClick={() => onDelete(session)} aria-label={`Delete mood from ${timeAgo(session.created_at)}`}>
                ✕ Delete
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
