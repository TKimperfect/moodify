// The AI mood assistant. Uses Claude when it is configured and working,
// and the rule-based engine otherwise, so the conversation never breaks.
import {
  respondRuleBased,
  cleanState,
  decide,
  questionFor,
  finalize,
  summarize,
  MAX_MOODS,
} from './assistant/dialogue.js';
import { analyzeText } from './assistant/analyze.js';
import { askClaude, isLlmConfigured } from './assistant/llm.js';
import { EFFECT_IDS, GENRE_IDS, MOOD_IDS, LANGUAGE_IDS, withoutRetired } from '../data/taxonomy.js';

const MAX_TURNS = 5; // after this many turns the assistant stops asking and recommends

export function assistantStatus() {
  return { provider: isLlmConfigured ? 'anthropic' : 'rule-based' };
}

const clampOrNull = (value) => (Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null);

// Copies Claude's understanding into the state, keeping only allowed values.
function mergeAi(state, ai) {
  const moods = [...new Set(ai.moods.filter((mood) => MOOD_IDS.includes(mood)))].slice(0, MAX_MOODS);
  if (moods.length) state.moods = moods;
  if (EFFECT_IDS.includes(ai.desired_effect)) state.desired_effect = ai.desired_effect;
  state.energy = clampOrNull(ai.energy) ?? state.energy;
  state.intensity = clampOrNull(ai.intensity) ?? state.intensity;
  if (ai.tempo) state.tempo = ai.tempo;
  const genres = ai.genres.filter((genre) => GENRE_IDS.includes(genre));
  if (genres.length) state.genres = [...new Set(genres)];
  const languages = withoutRetired(ai.languages ?? []).filter((language) => LANGUAGE_IDS.includes(language));
  if (languages.length) state.languages = [...new Set(languages)];
}

async function respondWithAi({ message, choice, history, state: previous }) {
  const state = cleanState(previous);
  state.turns += 1;
  const text = choice ? `${message} (${choice.slot}: ${choice.value})` : message;
  const ai = await askClaude({ history, message: text, state });
  mergeAi(state, ai);

  const decision = decide({ ...state, asked: [...state.asked, ...(ai.follow_up ? [ai.follow_up.slot] : [])] });
  const required = state.moods.length > 0 && Boolean(state.desired_effect);

  // 1. Claude asks something and we still have turns left: use its question.
  if (!ai.ready && ai.follow_up && state.turns < MAX_TURNS) {
    if (!state.asked.includes(ai.follow_up.slot)) state.asked.push(ai.follow_up.slot);
    const options = ai.follow_up.options.slice(0, 5).map((label) => ({ label: label.slice(0, 60), choice: null }));
    return { reply: ai.reply, followUp: { slot: ai.follow_up.slot, question: '', options }, state, profile: null, interpretation: [] };
  }

  // 2. Something required is missing: ask for it with the standard question.
  if (!required || (decision.type === 'ask' && decision.slot !== 'energy')) {
    const slot = state.moods.length === 0 ? 'moods' : 'effect';
    if (slot === 'effect' && state.asked.includes('effect') && state.turns >= MAX_TURNS) {
      // Asked already and still nothing: fall through to a default below.
    } else {
      const followUp = questionFor(slot, state);
      if (!state.asked.includes(slot)) state.asked.push(slot);
      const lead = ai.reply.trim().endsWith('?') ? '' : ai.reply.trim();
      return { reply: [lead, followUp.question].filter(Boolean).join(' '), followUp, state, profile: null, interpretation: [] };
    }
  }

  // 3. Ready: build the profile.
  if (state.moods.length === 0) throw new Error('No mood could be identified');
  const { profile, notes } = finalize(state);
  const reply = ai.ready ? ai.reply : `${ai.reply.trim()} ${summarize(profile)}`.trim();
  return { reply, followUp: null, state, profile, interpretation: notes };
}

export async function respond({ message, choice, history, state }) {
  // Safety first, and always deterministic: never leave this to chance.
  if (analyzeText(message).crisis) {
    return { ...respondRuleBased({ message, choice, state }), source: 'rule-based' };
  }

  if (isLlmConfigured) {
    try {
      const result = await respondWithAi({ message, choice, history, state });
      return { ...result, safety: null, source: 'ai' };
    } catch (error) {
      console.warn('[assistant] AI unavailable, using rule-based reply:', error.message);
      return { ...respondRuleBased({ message, choice, state }), source: 'rule-based', ai_error: true };
    }
  }
  return { ...respondRuleBased({ message, choice, state }), source: 'rule-based' };
}

// One-shot analysis of a piece of text (no conversation).
export async function analyze({ text }) {
  const result = await respond({ message: text, choice: null, history: [], state: null });
  return {
    source: result.source,
    understood: {
      moods: result.state.moods,
      desired_effect: result.state.desired_effect,
      energy: result.state.energy,
      intensity: result.state.intensity,
      tempo: result.state.tempo,
      genres: result.state.genres,
      languages: result.state.languages,
    },
    complete: Boolean(result.profile),
    profile: result.profile,
    follow_up: result.followUp?.question || (result.followUp ? result.reply : null),
    interpretation: result.interpretation,
    safety: result.safety,
  };
}
