// Optional AI provider: Claude, through the official Anthropic SDK.
// Only used when ANTHROPIC_API_KEY is set in server/.env. Any problem
// (no key, network, timeout, refusal, malformed answer) makes it throw,
// and the assistant service then answers with the rule-based engine.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { MOOD_IDS, EFFECTS, EFFECT_IDS, GENRE_IDS, LANGUAGES, LANGUAGE_IDS } from '../../data/taxonomy.js';

export const isLlmConfigured = Boolean(env.anthropic.apiKey);

let client = null;
function getClient() {
  client ??= new Anthropic({
    apiKey: env.anthropic.apiKey,
    baseURL: env.anthropic.baseURL || undefined,
    timeout: 25_000, // milliseconds; the rule-based engine takes over after this
    maxRetries: 1,
  });
  return client;
}

// The exact shape Claude must answer in. Structured outputs guarantee it.
const AssistantTurn = z.object({
  reply: z.string().describe('What to say to the person: 1-3 short, warm sentences.'),
  moods: z.array(z.enum(MOOD_IDS)).describe('Up to 3 moods the person currently feels, most important first. Empty if unknown.'),
  desired_effect: z.enum(EFFECT_IDS).nullable().describe('What they want the music to do, or null if they have not said.'),
  energy: z.number().int().nullable().describe('Their energy right now, 0-100, or null if unknown.'),
  intensity: z.number().int().nullable().describe('How strongly they feel it, 0-100, or null if unknown.'),
  tempo: z.enum(['slow', 'medium', 'fast', 'any']).nullable(),
  genres: z.array(z.enum(GENRE_IDS)),
  languages: z.array(z.enum(LANGUAGE_IDS)).describe('Languages the songs should be sung in, if the person asked for any. Empty otherwise.'),
  ready: z.boolean().describe('True once at least one mood and the desired effect are known.'),
  follow_up: z
    .object({
      slot: z.enum(['moods', 'effect', 'energy', 'other']),
      options: z.array(z.string()).describe('2-5 short answers the person can tap.'),
    })
    .nullable()
    .describe('Set when the reply ends with a question; null otherwise.'),
});

const effectLines = Object.entries(EFFECTS)
  .map(([id, effect]) => `- ${id} ("${effect.label}"): ${effect.because}`)
  .join('\n');

const SYSTEM_PROMPT = `You are the mood assistant inside MOODIFY, a music recommendation app. People tell you how they feel; you work out what kind of music they need right now and hand a structured mood profile to the recommendation engine.

The core idea of the app: a feeling does not dictate the music. Someone who is sad may want comfort, or may want songs that stay inside the sadness with them. Someone angry may want release, or calm. Never assume which; when the person hasn't said what they want from the music, ask.

How to talk:
- Short replies (one to three sentences), warm and plain. At most one question per turn.
- Only ask about things that change the music: how they feel, what they want the music to do, their energy, tempo or genre. Don't ask about the causes of their feelings or personal details.
- Don't diagnose, name conditions, or give psychological advice. You are a music companion, not a therapist.
- Reply in the language the person writes in. The structured fields always use the English ids below.

Structured fields:
- moods (up to 3): ${MOOD_IDS.join(', ')}
- desired_effect, what the music should do:
${effectLines}
- energy 0-100: how much physical or mental energy they have now. intensity 0-100: how strongly they feel it.
- tempo: slow, medium, fast or any. genres: ${GENRE_IDS.join(', ')}.
- languages the songs should be sung in, only if the person asks: ${Object.entries(LANGUAGES).map(([id, name]) => `${id} (${name})`).join(', ')}. Don't infer the song language from the language the person writes in.

Keep everything you already know (it is given to you as current_understanding) unless the person changes it. Set ready to true once you know at least one mood and the desired effect; when ready, fill energy and intensity with your best estimate, and use the reply to sum up what you heard in a sentence, inviting corrections. When your reply asks a question, set follow_up with 2-5 short answers the person can tap.`;

function buildMessages(history, message, state) {
  const turns = history
    .slice(-12)
    .filter((entry) => entry.content.trim())
    .map((entry) => ({ role: entry.role, content: entry.content }));
  while (turns.length && turns[0].role !== 'user') turns.shift();

  const understanding = {
    moods: state.moods,
    desired_effect: state.desired_effect,
    energy: state.energy,
    intensity: state.intensity,
    tempo: state.tempo,
    genres: state.genres,
    languages: state.languages,
    questions_already_asked: state.asked,
  };
  turns.push({
    role: 'user',
    content: `<current_understanding>${JSON.stringify(understanding)}</current_understanding>\n\n${message}`,
  });
  return turns;
}

export async function askClaude({ history, message, state }) {
  const response = await getClient().beta.messages.parse({
    model: env.anthropic.model,
    max_tokens: 16000,
    // Short conversational turns: low effort keeps replies quick and cheap.
    output_config: { effort: 'low', format: betaZodOutputFormat(AssistantTurn) },
    // If a safety classifier declines, retry on Anthropic's recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    messages: buildMessages(history, message, state),
  });

  if (response.stop_reason === 'refusal') throw new Error('The AI declined this request');
  if (response.stop_reason === 'max_tokens') throw new Error('The AI answer was cut off');
  if (!response.parsed_output) throw new Error('The AI answer could not be read');
  return response.parsed_output;
}
