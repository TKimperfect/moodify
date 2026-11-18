import { Link, useNavigate } from 'react-router-dom';
import Window from '../ui/Window.jsx';

const EXAMPLES = [
  "I feel flat today and I don't want to be cheered up.",
  'Missing someone. I want songs that sit with that.',
  'Angry at everything, need to let it out.',
];

// Entry point to the AI Mood Assistant. Tapping an example starts the chat with it.
export default function AssistantEntry() {
  const navigate = useNavigate();
  return (
    <Window title="assistant.chat" status="say it your way" className="flex flex-col" aria-labelledby="assistant-heading">
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <h2 id="assistant-heading" className="font-display text-lg tracking-wider text-frost">
          Hard to name it?
        </h2>
        <p className="mt-1.5 text-sm text-silver">
          Describe it in your own words. The assistant asks a question or two, then finds music for what you actually
          need. Tap an example to try it.
        </p>

        <ul className="mt-5 space-y-2">
          {EXAMPLES.map((line) => (
            <li key={line}>
              <button
                type="button"
                onClick={() => navigate('/assistant', { state: { prefill: line } })}
                className="w-full rounded-md rounded-bl-none border border-line bg-void/70 px-3 py-2 text-left text-sm text-chrome transition-colors hover:border-orchid hover:text-frost"
              >
                “{line}”
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-6">
          <Link to="/assistant" className="btn-chrome w-full">
            Talk to the assistant
          </Link>
        </div>
      </div>
    </Window>
  );
}
