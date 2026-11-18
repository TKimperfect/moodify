import Hero from '../components/home/Hero.jsx';
import MoodGrid from '../components/home/MoodGrid.jsx';
import AssistantEntry from '../components/home/AssistantEntry.jsx';
import FeaturedTracks from '../components/home/FeaturedTracks.jsx';
import SpectrumPanel from '../components/mood/SpectrumPanel.jsx';
import ExperiencePanel from '../components/mood/ExperiencePanel.jsx';
import ProfilePanel from '../components/mood/ProfilePanel.jsx';
import { useMoodProfile } from '../context/MoodProfileContext.jsx';

export default function Home() {
  const { draft, setMoods } = useMoodProfile();

  return (
    <>
      <Hero />
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
        <div className="space-y-5">
          {/* Step 01 (moods) next to the AI assistant shortcut */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <MoodGrid selected={draft.moods} onChange={setMoods} />
            <AssistantEntry />
          </div>
          {/* Steps 02 and 03 side by side on wide screens */}
          <div className="grid gap-5 lg:grid-cols-2">
            <SpectrumPanel />
            <ExperiencePanel />
          </div>
          {/* Step 04: the resulting profile */}
          <ProfilePanel />
        </div>
        <FeaturedTracks />
      </div>
    </>
  );
}
