import { Link } from 'react-router-dom';
import Window from '../components/ui/Window.jsx';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
      <Window title="error.log" status="404">
        <div className="p-6 sm:p-8">
          <h1 className="chrome-text font-display text-5xl tracking-wider">404</h1>
          <p className="mt-4 text-silver">This page does not exist.</p>
          <Link to="/" className="btn-ghost mt-8">
            Back to home
          </Link>
        </div>
      </Window>
    </div>
  );
}
