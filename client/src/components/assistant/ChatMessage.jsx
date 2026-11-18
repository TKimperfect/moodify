import PixelGlyph from '../ui/PixelGlyph.jsx';

const FACE = ['.#####.', '#.....#', '#.#.#.#', '#.....#', '#.###.#', '#.....#', '.#####.'];

// One message in the conversation.
export default function ChatMessage({ message }) {
  if (message.role === 'user') {
    return (
      <li className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm border border-orchid/40 bg-violet/25 px-3.5 py-2.5 text-frost">
          <span className="sr-only">You: </span>
          {message.content}
        </p>
      </li>
    );
  }

  const support = message.safety === 'support';
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line bg-void text-orchid" aria-hidden="true">
        <PixelGlyph rows={FACE} className="h-4 w-4" />
      </span>
      <p
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg rounded-bl-sm border px-3.5 py-2.5 ${
          support ? 'border-rose bg-rose/10 text-frost' : 'border-line bg-void/80 text-chrome'
        }`}
      >
        <span className="sr-only">Assistant: </span>
        {message.content}
      </p>
    </li>
  );
}
