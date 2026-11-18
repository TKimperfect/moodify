// Scrolling ticker text. The text is repeated so the loop looks endless.
// Screen readers get the sentence once; the moving copies are hidden from them.
export default function Marquee({ text }) {
  const copies = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div className="overflow-hidden border-y border-line bg-void/70 py-2.5">
      <p className="sr-only">{text}</p>
      <div className="flex w-max animate-marquee" aria-hidden="true">
        {copies.map((i) => (
          <span key={i} className="pixel-label flex items-center whitespace-nowrap text-silver">
            <span className="px-6">{text}</span>
            <span className="h-1.5 w-1.5 bg-rose" />
          </span>
        ))}
      </div>
    </div>
  );
}
