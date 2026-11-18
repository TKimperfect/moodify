import { summarizeProfile } from '../../lib/moodProfile.js';

// Shows a finished mood profile: a sentence, plus the structured data
// exactly as the recommendation engine will receive it.
export default function ProfileReadout({ profile }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <p className="text-lg leading-relaxed text-frost">{summarizeProfile(profile)}</p>
      <pre className="overflow-x-auto rounded-md border border-line bg-ink/70 p-4 font-mono text-xs leading-relaxed text-chrome" aria-label="Structured mood profile">
        {JSON.stringify(profile, null, 2)}
      </pre>
    </div>
  );
}
