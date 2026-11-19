// Automated checks for the mood profile logic. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DRAFT,
  buildProfile,
  missingSteps,
  sanitizeProfile,
  suggestSpectrum,
  suggestedEffects,
  summarizeProfile,
  levelWord,
  draftFromProfile,
} from './moodProfile.js';
import { ENERGY_WORDS } from '../data/spectrum.js';

test('an untouched draft is incomplete and builds no profile', () => {
  assert.equal(missingSteps(DEFAULT_DRAFT).length, 2);
  assert.equal(buildProfile(DEFAULT_DRAFT), null);
});

test('builds the structured profile from the spec example', () => {
  const profile = buildProfile({
    moods: ['lonely', 'sad'],
    energy: 20,
    intensity: 85,
    tempo: 'slow',
    desiredEffect: 'comfort',
    genres: ['alternative', 'indie'],
    spectrumTouched: true,
  });
  assert.deepEqual(profile, {
    moods: ['sad', 'lonely'],
    energy: 20,
    intensity: 85,
    genres: ['indie', 'alternative'],
    desired_effect: 'comfort',
    tempo: 'slow',
    languages: [],
  });
});

test('languages are kept in a fixed order and unknown ones are dropped', () => {
  const profile = buildProfile({ ...DEFAULT_DRAFT, moods: ['sad'], desiredEffect: 'comfort', languages: ['ko', 'yue', 'xx'] });
  assert.deepEqual(profile.languages, ['yue', 'ko']);
  assert.deepEqual(sanitizeProfile({ ...profile, languages: ['ms', 'nope'] }).languages, ['ms']);
  assert.match(summarizeProfile({ ...profile, languages: ['yue', 'ko'] }), /sung in Cantonese and Korean\.$/);
});

test('the same mood can carry different desired effects', () => {
  const base = { ...DEFAULT_DRAFT, moods: ['sad'] };
  assert.equal(buildProfile({ ...base, desiredEffect: 'comfort' }).desired_effect, 'comfort');
  assert.equal(buildProfile({ ...base, desiredEffect: 'embrace' }).desired_effect, 'embrace');
});

test('slider values are clamped to 0-100', () => {
  const profile = buildProfile({ ...DEFAULT_DRAFT, moods: ['calm'], desiredEffect: 'atmosphere', energy: 500, intensity: -3 });
  assert.equal(profile.energy, 100);
  assert.equal(profile.intensity, 0);
});

test('suggestSpectrum averages mood hints and is neutral with no moods', () => {
  assert.deepEqual(suggestSpectrum([]), { energy: 50, intensity: 50 });
  assert.deepEqual(suggestSpectrum(['sad']), { energy: 25, intensity: 70 });
  assert.deepEqual(suggestSpectrum(['angry', 'empty']), { energy: 50, intensity: 65 });
});

test('suggestedEffects has no duplicates', () => {
  assert.deepEqual(suggestedEffects(['sad', 'lonely']), ['comfort', 'embrace', 'companionship']);
});

test('levelWord maps the ends of the scale', () => {
  assert.equal(levelWord(0, ENERGY_WORDS), 'drained');
  assert.equal(levelWord(100, ENERGY_WORDS), 'wired');
});

test('sanitizeProfile rejects bad data and cleans good data', () => {
  assert.equal(sanitizeProfile(null), null);
  assert.equal(sanitizeProfile({ moods: ['made-up'], desired_effect: 'comfort' }), null);
  assert.equal(sanitizeProfile({ moods: ['sad'], desired_effect: 'hack' }), null);
  assert.deepEqual(
    sanitizeProfile({ moods: ['sad', 'x'], desired_effect: 'comfort', energy: '30', intensity: 999, genres: ['indie', '<b>'], tempo: 'warp' }),
    { moods: ['sad'], energy: 30, intensity: 100, genres: ['indie'], desired_effect: 'comfort', tempo: 'any', languages: [] },
  );
});

test('a profile survives a round trip through the editor state', () => {
  const profile = { moods: ['nostalgic'], energy: 40, intensity: 55, genres: [], desired_effect: 'memories', tempo: 'medium', languages: ['ja'] };
  assert.deepEqual(buildProfile(draftFromProfile(profile)), profile);
});

test('summarizeProfile writes a readable sentence', () => {
  const text = summarizeProfile({ moods: ['sad', 'lonely'], energy: 20, intensity: 85, genres: ['indie', 'alternative'], desired_effect: 'comfort', tempo: 'slow' });
  assert.equal(text, 'Feeling sad and lonely, low energy, overwhelming intensity. Wants music to "comfort me", slow tempo, leaning indie and alternative.');
});
