import Window from '../ui/Window.jsx';
import Choice from '../ui/Choice.jsx';
import { useMoodProfile } from '../../context/MoodProfileContext.jsx';
import { suggestedEffects } from '../../lib/moodProfile.js';
import { DESIRED_EFFECTS, GENRES } from '../../data/spectrum.js';

// Step 03: what the music should do, plus optional genres.
export default function ExperiencePanel() {
  const { draft, setField, toggleGenre } = useMoodProfile();
  const suggested = suggestedEffects(draft.moods);

  return (
    <Window title="03 // experience.exe" status={draft.desiredEffect ? 'chosen' : 'required'} aria-labelledby="experience-heading">
      <div className="space-y-7 p-4 sm:p-6">
        <fieldset>
          <legend id="experience-heading" className="font-display text-lg tracking-wider text-frost">
            What should the music do?
          </legend>
          <p className="mt-1.5 text-sm text-silver">
            The same feeling can ask for different things. Nothing is assumed, you choose.
            {suggested.length > 0 && (
              <>
                {' '}
                <span className="inline-block h-1.5 w-1.5 -translate-y-px bg-rose" aria-hidden="true" /> marks what people often pick
                with your moods.
              </>
            )}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {DESIRED_EFFECTS.map((effect) => (
              <Choice
                key={effect.id}
                name="desired-effect"
                value={effect.id}
                label={effect.label}
                hint={effect.hint}
                suggested={suggested.includes(effect.id)}
                checked={draft.desiredEffect === effect.id}
                onChange={() => setField('desiredEffect', effect.id)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-medium text-frost">
            Genres <span className="text-sm font-normal text-silver">(optional, pick any)</span>
          </legend>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {GENRES.map((genre) => (
              <Choice
                key={genre.id}
                type="checkbox"
                name="genres"
                value={genre.id}
                label={genre.label}
                checked={draft.genres.includes(genre.id)}
                onChange={() => toggleGenre(genre.id)}
                className="choice-compact"
              />
            ))}
          </div>
        </fieldset>
      </div>
    </Window>
  );
}
