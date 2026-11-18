import Marquee from '../ui/Marquee.jsx';

export default function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-20">
        <p className="pixel-label animate-rise text-rose">
          Emotional music discovery <span className="text-silver">// est. 2026</span>
        </p>

        <p
          className="chrome-text mt-5 animate-rise font-display text-[clamp(2.4rem,11vw,7.5rem)] leading-none tracking-[0.06em]"
          style={{ animationDelay: '80ms' }}
          aria-hidden="true"
        >
          MOODIFY
        </p>

        <div
          className="mt-6 flex animate-rise flex-col gap-4 sm:mt-8 md:flex-row md:items-end md:justify-between"
          style={{ animationDelay: '160ms' }}
        >
          <h1 className="text-3xl font-medium tracking-tight text-frost sm:text-4xl md:text-5xl">
            How are you feeling today
            <span className="text-orchid">?</span>
            <span className="ml-1 inline-block h-[0.8em] w-[0.45em] translate-y-[0.08em] animate-blink bg-orchid" aria-hidden="true" />
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-silver md:text-right">
            Tell MOODIFY where you are right now. It finds music that meets you there, whether you want
            comfort, release, or just company.
          </p>
        </div>
      </div>

      <Marquee text="Not every sad person wants happy music. Sometimes people just want music that understands them." />
    </section>
  );
}
