// Turns the numbers from scoring.js into sentences a person can read:
// "why was this song recommended to me?"
import { EFFECTS, GENRES, ENERGY_WORDS, targetEnergy, moodAffinity, effectAffinity } from '../../data/taxonomy.js';

function list(words) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

const energyWord = (value) => ENERGY_WORDS[Math.min(4, Math.floor(value / 20))];

export function explain(profile, song, parts) {
  const reasons = [];

  // Mood
  const shared = profile.moods.filter((mood) => song.moods.includes(mood));
  if (shared.length > 0) {
    reasons.push(`Carries the ${list(shared)} feeling you picked.`);
  } else if (parts.mood > 0) {
    const [closest] = [...song.moods].sort(
      (a, b) =>
        Math.max(...profile.moods.map((mood) => moodAffinity(mood, b))) -
        Math.max(...profile.moods.map((mood) => moodAffinity(mood, a))),
    );
    reasons.push(`Not an exact mood match, but ${closest} sits close to ${list(profile.moods)}.`);
  }

  // Desired effect
  const wanted = EFFECTS[profile.desired_effect];
  if (song.effects.includes(profile.desired_effect)) {
    reasons.push(`You asked music to "${wanted.label.toLowerCase()}": this one ${wanted.because}.`);
  } else if (parts.effect > 0) {
    const [closest] = [...song.effects].sort(
      (a, b) => effectAffinity(profile.desired_effect, b) - effectAffinity(profile.desired_effect, a),
    );
    reasons.push(`Close to "${wanted.label.toLowerCase()}": this one ${EFFECTS[closest].because}.`);
  }

  // Tempo and energy
  if (parts.tempo_energy >= 0.7) {
    const aim = targetEnergy(profile);
    let fit = 'close to where you are';
    if (aim > profile.energy + 5) fit = 'a step above where you are, on purpose';
    else if (aim < profile.energy) fit = 'a touch below where you are, to leave you room';
    reasons.push(`${song.tempo[0].toUpperCase()}${song.tempo.slice(1)} tempo (${song.bpm} BPM) with ${energyWord(song.energy)} energy, ${fit}.`);
  }

  // Genre
  if (profile.genres.length > 0) {
    const asked = song.genres.filter((genre) => profile.genres.includes(genre));
    if (asked.length > 0) reasons.push(`${list(asked.map((genre) => GENRES[genre]))}, as you asked.`);
    else if (parts.genre > 0) reasons.push(`${GENRES[song.genres[0]]} is close to the genres you picked.`);
  }

  // History
  if (parts.history >= 0.65) reasons.push('Similar to songs you have liked.');

  if (reasons.length === 0) reasons.push('A loose match, included to give you enough to choose from.');
  return reasons;
}
