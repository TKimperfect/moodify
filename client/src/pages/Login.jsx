import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Window from '../components/ui/Window.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Log in and create an account (one page, two tabs).
export default function Login({ mode = 'login' }) {
  const { status, available, login, register, notice, clearNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const goTo = location.state?.from ?? '/library';
  const [form, setForm] = useState({ email: '', password: '', display_name: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmEmail, setConfirmEmail] = useState(null);
  const isRegister = mode === 'register';

  // Already logged in (for example after the email link): go on.
  useEffect(() => {
    if (status === 'user') navigate(goTo, { replace: true });
  }, [status, goTo, navigate]);

  const update = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    clearNotice();
    try {
      if (isRegister) {
        const result = await register(form);
        if (result.needs_email_confirmation) setConfirmEmail(form.email);
      } else {
        await login(form.email, form.password);
      }
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-20">
      <Window title={isRegister ? 'new_user.exe' : 'login.exe'} status={available ? 'secure' : 'offline'}>
        <div className="p-5 sm:p-7">
          <h1 className="chrome-text font-display text-2xl tracking-wider sm:text-3xl">{isRegister ? 'Create account' : 'Welcome back'}</h1>
          <p className="mt-2 text-sm text-silver">
            {isRegister
              ? 'Save favourites and playlists, and keep a history of your moods across devices.'
              : 'Log in to see your library, playlists and mood history.'}
          </p>

          {!available && (
            <p className="mt-5 rounded-md border border-rose/50 bg-rose/10 p-3 text-sm text-chrome" role="alert">
              Accounts are switched off because this server has no database. Everything else still works.
            </p>
          )}

          {notice && (
            <p className={`mt-5 rounded-md border p-3 text-sm ${notice.type === 'ok' ? 'border-orchid/50 bg-violet/20 text-frost' : 'border-rose/50 bg-rose/10 text-chrome'}`} role="status">
              {notice.text}
            </p>
          )}

          {confirmEmail ? (
            <div className="mt-6 space-y-3" role="status">
              <p className="text-frost">Almost there. We sent a confirmation link to {confirmEmail}.</p>
              <p className="text-sm text-silver">Open it on this device and you will be logged in. No email? Check the spam folder.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              {isRegister && (
                <Field label="Display name (optional)" id="display_name" value={form.display_name} onChange={update('display_name')} maxLength={60} autoComplete="nickname" />
              )}
              <Field label="Email" id="email" type="email" value={form.email} onChange={update('email')} required maxLength={254} autoComplete="email" />
              <Field
                label="Password"
                id="password"
                type="password"
                value={form.password}
                onChange={update('password')}
                required
                minLength={isRegister ? 8 : 1}
                maxLength={72}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                hint={isRegister ? 'At least 8 characters.' : undefined}
              />
              {error && (
                <p className="text-sm text-rose" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn-chrome w-full" disabled={busy || !available || !form.email || !form.password}>
                {busy ? 'One moment…' : isRegister ? 'Create account' : 'Log in'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-silver">
            {isRegister ? 'Already have an account? ' : 'New here? '}
            <Link to={isRegister ? '/login' : '/register'} state={location.state} className="text-orchid underline underline-offset-4 hover:text-frost">
              {isRegister ? 'Log in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </Window>
      <p className="mt-4 text-center text-xs text-silver">You can use MOODIFY without an account; it just won't remember you on other devices.</p>
    </div>
  );
}

function Field({ label, id, hint, ...input }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-frost">
        {label}
      </label>
      <input
        id={id}
        name={id}
        {...input}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1.5 block w-full rounded-md border border-line bg-ink/70 px-3 py-2.5 text-frost placeholder:text-silver/70 focus:border-orchid focus:outline-none"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-silver">
          {hint}
        </p>
      )}
    </div>
  );
}
