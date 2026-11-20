import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../../data/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';

// Top navigation bar. On phones the links collapse into a "Menu" button.
export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, status, available } = useAuth();

  // Close the phone menu whenever the page changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const linkClass = ({ isActive }) =>
    `pixel-label rounded px-3 py-2 transition-colors ${
      isActive ? 'bg-orchid/15 text-orchid' : 'text-silver hover:text-frost'
    }`;

  return (
    <header data-site-header className="sticky top-0 z-50 border-b border-line bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="MOODIFY home">
          <span className="grid h-6 w-6 grid-cols-2 gap-0.5" aria-hidden="true">
            <span className="bg-orchid" />
            <span className="bg-chrome" />
            <span className="bg-chrome" />
            <span className="bg-rose" />
          </span>
          <span className="chrome-text font-display text-base tracking-[0.18em]">MOODIFY</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {status !== 'loading' && available && (
            user ? (
              <Link to="/profile" className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-sm text-chrome hover:border-orchid" aria-label={`Your profile (${user.display_name})`}>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-orchid to-rose font-display text-xs text-ink" aria-hidden="true">
                  {user.display_name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[8rem] truncate sm:inline">{user.display_name}</span>
              </Link>
            ) : (
              <Link to="/login" state={{ from: pathname }} className="btn-ghost">
                Log in
              </Link>
            )
          )}
        <button
          type="button"
          className="btn-ghost lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" className="border-t border-line px-4 py-3 sm:px-6 lg:hidden" aria-label="Main">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-1 sm:grid-cols-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'} className={(state) => `block ${linkClass(state)}`}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
