import { Link, useLocation } from 'react-router-dom';
import Window from '../ui/Window.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

// Shown in place of pages or sections that need an account.
export default function RequireLogin({ what = 'this' }) {
  const { available, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <p className="pixel-label text-silver">&gt; checking your session…</p>;
  return (
    <Window title="access.log" status="login needed">
      <div className="p-5 sm:p-6">
        {available ? (
          <>
            <p className="text-frost">Log in to see {what}.</p>
            <p className="mt-1 text-sm text-silver">An account keeps your favourites, playlists and moods on every device.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/login" state={{ from: location.pathname + location.search }} className="btn-chrome">
                Log in
              </Link>
              <Link to="/register" state={{ from: location.pathname + location.search }} className="btn-ghost">
                Create account
              </Link>
            </div>
          </>
        ) : (
          <p className="text-silver">Accounts are switched off because this server has no database.</p>
        )}
      </div>
    </Window>
  );
}
