// The rule-based mood assistant: zero cost, works offline.
// It keeps a small "state" (what it knows so far), asks one question at a
// time about what is still missing, and never assumes that a mood decides
// the music: when the person has not said what they want, it asks.
import { EFFECTS, GENRES, MOOD_HINTS, MOOD_LABELS, ENERGY_WORDS } from '../../data/taxonomy.js';
import { analyzeText } from './analyze.js';

export const MAX_MOODS = 3;

export const EMPTY_STATE = Object.freeze({
  moods: [],
  energy: null,
  intensity: null,
  genres: [],
  desired_effect: null,
  tempo: null,
  asked: [],
  turns: 0,
});

const clamp = (value) => Math.min(100, Math.max(0, Math.round(value)));
const round5 = (value) => Math.round(value / 5) * 5;
const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);

function list(words) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

export function suggestedEffects(moods) {
  return [...new Set(moods.flatMap((mood) => MOOD_HINTS[mood]?.effects ?? []))];
}

function estimate(moods, key) {
  const hints = moods.map((mood) => MOOD_HINTS[mood]).filter(Boolean);
  if (hints.length === 0) return 50;
  return round5(hints.reduce((sum, hint) => sum + hint[key], 0) / hints.length);
}

// ---- Questions (with tappable answers) ------------------------------------

const MOOD_OPTIONS = Object.entries(MOOD_LABELS).map(([value, label]) => ({ label, choice: { slot: 'moods', value } }));

const EFFECT_QUESTION = {
  sad: 'Do you want music that comforts you, or music that stays in the sadness with you?',
  lonely: 'Would you like music that keeps you company, or something that helps you sit with being alone?',
  angry: 'Do you want to let it out with something loud, or bring it down a bit?',
  anxious: 'Should the music help you settle, or just give your mind somewhere to go?',
  empty: 'Would you like something atmospheric that asks nothing of you, or something that feels like company?',
  calm: 'Do you want to keep this calm going, or gently lift it?',
  happy: 'Do you want to ride the good mood, or turn it up even more?',
  nostalgic: 'Do you want to go back to those memories, or stay in the warm feeling of them?',
  motivated: 'Want something to keep you moving, or something steady to focus to?',
  romantic: 'Do you want to stay in the feeling, or drift back through memories?',
};

function effectQuestion(moods) {
  const first = moods[0];
  const ordered = [...suggestedEffects(moods), ...Object.keys(EFFECTS)];
  const options = [...new Set(ordered)].slice(0, 4).map((value) => ({ label: EFFECTS[value].label, choice: { slot: 'effect', value } }));
  options.push({ label: 'Not sure', choice: { slot: 'effect', value: 'unsure' } });
  return {
    slot: 'effect',
    question: EFFECT_QUESTION[first] ?? 'What do you want the music to do for you right now?',
    options,
  };
}

const ENERGY_QUESTION = {
  slot: 'energy',
  question: 'How much energy do you have right now?',
  options: [
    { label: 'Running on empty', choice: { slot: 'energy', value: 'low' } },
    { label: 'Somewhere in the middle', choice: { slot: 'energy', value: 'medium' } },
    { label: 'Lots of it', choice: { slot: 'energy', value: 'high' } },
    { label: 'Skip', choice: { slot: 'energy', value: 'skip' } },
  ],
};

const MOODS_QUESTION = {
  slot: 'moods',
  question: 'Which of these is closest to how you feel? You can also just describe it.',
  options: MOOD_OPTIONS,
};

const ENERGY_VALUES = { low: 20, medium: 50, high: 80 };

// ---- Acknowledgements (empathetic, no diagnosis) --------------------------

const ACKNOWLEDGE = {
  sad: 'That sounds heavy.',
  lonely: 'Feeling alone is hard.',
  angry: "That's a lot of heat to carry.",
  anxious: 'That restless feeling is exhausting.',
  empty: "Sometimes there's just nothing there, and that's okay.",
  calm: 'A quiet moment. Nice.',
  happy: 'Love that.',
  nostalgic: 'Memory lane, then.',
  motivated: "Let's use that.",
  romantic: "Someone's on your mind.",
};

// ---- Merging what was said into the state ---------------------------------

function applyChoice(state, choice, notes) {
  if (!choice) return;
  if (choice.slot === 'moods' && MOOD_LABELS[choice.value]) {
    if (!state.moods.includes(choice.value) && state.moods.length < MAX_MOODS) state.moods.push(choice.value);
    notes.push(`Mood: ${choice.value}`);
  } else if (choice.slot === 'effect') {
    if (EFFECTS[choice.value]) {
      state.desired_effect = choice.value;
      notes.push(`Wants music to: ${lower(EFFECTS[choice.value].label)}`);
    } else {
      state.unsure = true;
    }
  } else if (choice.slot === 'energy') {
    if (ENERGY_VALUES[choice.value] !== undefined) {
      state.energy = ENERGY_VALUES[choice.value];
      notes.push(`Energy: ${choice.value}`);
    }
  }
}

function applyAnalysis(state, analysis, notes) {
  for (const mood of analysis.moods) {
    if (!state.moods.includes(mood.id) && state.moods.length < MAX_MOODS) {
      state.moods.push(mood.id);
      notes.push(`Heard ${mood.id} in “${mood.words.join('”, “')}”`);
    }
  }
  if (analysis.effect) {
    state.desired_effect = analysis.effect.id;
    notes.push(`“${analysis.effect.words[0]}” → ${lower(EFFECTS[analysis.effect.id].label)}`);
  }
  if (analysis.energy) {
    state.energy = analysis.energy.value;
    notes.push(`Energy cue: “${analysis.energy.words[0]}”`);
  }
  if (analysis.energyShift) {
    const base = state.energy ?? estimate(state.moods, 'energy');
    state.energy = clamp(base + analysis.energyShift);
    notes.push(analysis.energyShift > 0 ? 'Asked for more energy' : 'Asked for something calmer');
  }
  if (analysis.intensityShift) {
    const base = state.intensity ?? estimate(state.moods, 'intensity');
    state.intensity = clamp(base + analysis.intensityShift);
    notes.push(analysis.intensityShift > 0 ? 'Strong feelings' : 'Milder feelings');
  }
  if (analysis.tempo) {
    state.tempo = analysis.tempo;
    notes.push(`Tempo: ${analysis.tempo}`);
  }
  for (const genre of analysis.genres) {
    if (!state.genres.includes(genre)) {
      state.genres.push(genre);
      notes.push(`Genre: ${GENRES[genre]}`);
    }
  }
  if (analysis.unsure) state.unsure = true;
}

// ---- Deciding what happens next -------------------------------------------

// What is still needed. Shared by the rule-based and the AI assistant.
export function decide(state) {
  if (state.moods.length === 0) return { type: 'ask', slot: 'moods' };
  if (!state.desired_effect && !state.asked.includes('effect')) return { type: 'ask', slot: 'effect' };
  if (state.energy === null && !state.asked.includes('energy') && state.asked.length > 0) {
    return { type: 'ask', slot: 'energy' };
  }
  return { type: 'complete' };
}

export function questionFor(slot, state) {
  if (slot === 'moods') return MOODS_QUESTION;
  if (slot === 'effect') return effectQuestion(state.moods);
  return ENERGY_QUESTION;
}

// Fills the remaining gaps with sensible estimates and builds the profile
// the recommendation engine expects.
export function finalize(state) {
  const notes = [];
  if (!state.desired_effect) {
    state.desired_effect = suggestedEffects(state.moods)[0] ?? 'embrace';
    notes.push(`No preference given, starting with “${lower(EFFECTS[state.desired_effect].label)}”`);
  }
  if (state.energy === null) state.energy = estimate(state.moods, 'energy');
  if (state.intensity === null) state.intensity = estimate(state.moods, 'intensity');
  return {
    profile: {
      moods: state.moods.slice(0, MAX_MOODS),
      energy: clamp(state.energy),
      intensity: clamp(state.intensity),
      genres: state.genres,
      desired_effect: state.desired_effect,
      tempo: state.tempo ?? 'any',
    },
    notes,
  };
}

export function summarize(profile) {
  const effect = lower(EFFECTS[profile.desired_effect].label);
  const energyWord = ENERGY_WORDS[Math.min(4, Math.floor(profile.energy / 20))];
  let text = `Here's what I'm hearing: ${list(profile.moods)}, ${energyWord} energy, and you'd like the music to “${effect}”`;
  if (profile.tempo !== 'any') text += `, ${profile.tempo} tempo`;
  if (profile.genres.length) text += `, leaning ${list(profile.genres.map((genre) => GENRES[genre]))}`;
  return `${text}. If anything's off, just tell me.`;
}

// ---- Safety ----------------------------------------------------------------

export const SUPPORT_MESSAGE =
  "I'm really glad you told me. I'm a music app, so I'm not the right help for this, but you deserve support from a real person right now. " +
  'If you might act on these thoughts or are in danger, please contact your local emergency number. ' +
  'You can find a free, confidential helpline for your country at findahelpline.com. ' +
  "If you'd like, I can still find something gentle to listen to while you reach out.";

// ---- One conversational turn ----------------------------------------------

export function cleanState(input) {
  const state = structuredClone({ ...EMPTY_STATE, ...(input ?? {}) });
  state.asked = [...new Set(state.asked)];
  delete state.unsure;
  return state;
}

export function respondRuleBased({ message, choice, state: previous }) {
  const state = cleanState(previous);
  state.turns += 1;
  const before = JSON.stringify({ ...state, turns: 0 });
  const notes = [];

  // A tapped answer button carries its meaning in "choice"; its label is not
  // analysed as free text ("Running on empty" is an energy level, not a mood).
  const analysis = choice ? analyzeText('') : analyzeText(message);
  if (analyzeText(message).crisis) {
    return { reply: SUPPORT_MESSAGE, followUp: null, state, profile: null, interpretation: [], safety: 'support' };
  }

  const hadMoods = state.moods.length > 0;
  applyChoice(state, choice, notes);
  applyAnalysis(state, analysis, notes);
  const unsure = state.unsure === true;
  delete state.unsure;

  // "Not sure" to the experience question: pick a starting point and say so.
  let unsureLead = '';
  if (unsure && !state.desired_effect && state.asked.includes('effect')) {
    state.desired_effect = suggestedEffects(state.moods)[0] ?? 'embrace';
    const label = lower(EFFECTS[state.desired_effect].label);
    notes.push(`Not sure → starting with “${label}”`);
    unsureLead = `No problem, I'll start with “${label}”. The results also include a different direction to try.`;
  }
  // "Skip" for energy.
  if (choice?.slot === 'energy' && choice.value === 'skip') state.asked.push('energy');

  const changed = JSON.stringify({ ...state, turns: 0 }) !== before;
  const acknowledgement = !hadMoods && state.moods.length > 0 ? ACKNOWLEDGE[state.moods[0]] : '';
  const decision = decide(state);

  if (decision.type === 'ask') {
    const followUp = questionFor(decision.slot, state);
    if (!state.asked.includes(decision.slot)) state.asked.push(decision.slot);
    let lead = [acknowledgement, unsureLead].filter(Boolean).join(' ');
    if (decision.slot === 'moods' && state.turns > 1 && !changed) {
      lead = "I didn't quite catch a feeling in that.";
    }
    return {
      reply: [lead, followUp.question].filter(Boolean).join(' '),
      followUp,
      state,
      profile: null,
      interpretation: notes,
      safety: null,
    };
  }

  const { profile, notes: finalNotes } = finalize(state);
  const wasComplete = previous && decide(cleanState(previous)).type === 'complete' && cleanState(previous).moods.length > 0 && !changed;
  const reply = wasComplete
    ? "Your songs are ready. Tap “Show my songs”, or tell me if you'd like something different."
    : [acknowledgement, unsureLead, summarize(profile)].filter(Boolean).join(' ');

  return { reply, followUp: null, state, profile, interpretation: [...notes, ...finalNotes], safety: null };
}
