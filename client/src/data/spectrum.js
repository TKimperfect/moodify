// Options for the "emotional spectrum" step.

// What the user wants the music to DO for them.
// One mood can lead to very different wishes, so nothing here is pre-selected.
export const DESIRED_EFFECTS = [
  { id: 'comfort', label: 'Comfort me', hint: 'gentle and reassuring' },
  { id: 'embrace', label: 'Stay in it', hint: 'match the feeling fully' },
  { id: 'companionship', label: 'Keep me company', hint: 'voices that feel close' },
  { id: 'release', label: 'Let it out', hint: 'loud and cathartic' },
  { id: 'atmosphere', label: 'Fill the space', hint: 'ambient, no demands' },
  { id: 'memories', label: 'Take me back', hint: 'familiar and nostalgic' },
  { id: 'uplift', label: 'Lift me up', hint: 'slowly brighter' },
  { id: 'energize', label: 'Get me moving', hint: 'drive and momentum' },
];

export const TEMPOS = [
  { id: 'slow', label: 'Slow' },
  { id: 'medium', label: 'Medium' },
  { id: 'fast', label: 'Fast' },
  { id: 'any', label: 'No preference' },
];

export const GENRES = [
  { id: 'indie', label: 'Indie' },
  { id: 'alternative', label: 'Alternative' },
  { id: 'pop', label: 'Pop' },
  { id: 'rock', label: 'Rock' },
  { id: 'electronic', label: 'Electronic' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'lo-fi', label: 'Lo-fi' },
  { id: 'hip-hop', label: 'Hip-hop' },
  { id: 'r&b', label: 'R&B' },
  { id: 'jazz', label: 'Jazz' },
  { id: 'classical', label: 'Classical' },
  { id: 'folk', label: 'Folk' },
];

// Starting points per mood. They only move the sliders to a sensible first
// position and mark some experiences as "often chosen". The user always decides.
export const MOOD_HINTS = {
  happy: { energy: 70, intensity: 55, effects: ['embrace', 'uplift'] },
  sad: { energy: 25, intensity: 70, effects: ['comfort', 'embrace'] },
  lonely: { energy: 25, intensity: 65, effects: ['companionship', 'comfort'] },
  angry: { energy: 80, intensity: 85, effects: ['release', 'energize'] },
  anxious: { energy: 65, intensity: 75, effects: ['comfort', 'atmosphere'] },
  calm: { energy: 30, intensity: 30, effects: ['atmosphere', 'embrace'] },
  nostalgic: { energy: 40, intensity: 55, effects: ['memories', 'embrace'] },
  motivated: { energy: 85, intensity: 65, effects: ['energize', 'uplift'] },
  empty: { energy: 15, intensity: 40, effects: ['atmosphere', 'companionship'] },
  romantic: { energy: 45, intensity: 60, effects: ['embrace', 'memories'] },
};

// Words shown next to the slider numbers (one word per 20 points).
export const ENERGY_WORDS = ['drained', 'low', 'steady', 'charged', 'wired'];
export const INTENSITY_WORDS = ['faint', 'mild', 'present', 'strong', 'overwhelming'];
