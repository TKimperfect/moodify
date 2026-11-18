import { useNavigate } from 'react-router-dom';
import Window from '../ui/Window.jsx';
import ProfileReadout from './ProfileReadout.jsx';
import { useMoodProfile } from '../../context/MoodProfileContext.jsx';

// Step 04: live result of steps 01-03 and the button that saves it.
export default function ProfilePanel() {
  const { profile, missing, saveProfile, resetDraft } = useMoodProfile();
  const navigate = useNavigate();

  function handleSave() {
    if (saveProfile()) navigate('/recommendations');
  }

  return (
    <Window title="04 // mood_profile.json" status={profile ? 'ready' : 'incomplete'} aria-labelledby="profile-heading">
      <div className="p-4 sm:p-6">
        <h2 id="profile-heading" className="font-display text-lg tracking-wider text-frost">
          Your mood profile
        </h2>

        <div className="mt-4" aria-live="polite">
          {profile ? (
            <ProfileReadout profile={profile} />
          ) : (
            <ul className="space-y-2 text-sm text-silver">
              {missing.map((step) => (
                <li key={step} className="flex items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 border border-rose" aria-hidden="true" />
                  {step}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-void/60 px-4 py-3 sm:px-6">
        <button type="button" className="btn-ghost" onClick={resetDraft}>
          Start over
        </button>
        <button type="button" className="btn-chrome" onClick={handleSave} disabled={!profile}>
          Lock in profile
        </button>
      </div>
    </Window>
  );
}
