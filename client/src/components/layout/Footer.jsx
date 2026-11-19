import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="pixel-label mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-silver sm:px-6">
        <span>Moodify · build 1.2</span>
        <span className="flex gap-4">
          <Link to="/credits" className="underline decoration-line underline-offset-4 hover:text-orchid">
            Credits
          </Link>
          <Link to="/status" className="underline decoration-line underline-offset-4 hover:text-orchid">
            System status
          </Link>
        </span>
      </div>
    </footer>
  );
}
