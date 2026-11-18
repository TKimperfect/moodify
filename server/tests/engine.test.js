// Checks for the recommendation engine. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS } from '../src/data/songs.js';
import { WEIGHTS, MOOD_IDS, EFFECT_IDS, GENRE_IDS } from '../src/data/taxonomy.js';
import { recommend } from '../src/services/recommendation/engine.js';
import { scoreSong, buildTaste, historyScore } from '../src/services/recommendation/scoring.js';

const sadComfort = { moods: ['sad', 'lonely'], energy: 20, intensity: 85, genres: ['indie', 'alternative'], desired_effect: 'comfort', tempo: 'slow' };
const titles = (result) => result.recommendations.map((item) => item.song.id);
const run = (profile, feedback) => recommend({ profile, songs: SONGS, feedback });

test('catalogue is well formed', () => {
  assert.ok(SONGS.length >= 60);
  assert.equal(new Set(SONGS.map((song) => song.id)).size, SONGS.length);
  for (const song of SONGS) {
    assert.ok(song.moods.every((mood) => MOOD_IDS.includes(mood)), song.id);
    assert.ok(song.effects.every((effect) => EFFECT_IDS.includes(effect)), song.id);
    assert.ok(song.genres.every((genre) => GENRE_IDS.includes(genre)), song.id);
  }
});

test('weights are 30/25/20/15/10 and add up to 100%', () => {
  assert.deepEqual(WEIGHTS, { mood: 0.3, effect: 0.25, genre: 0.2, tempo_energy: 0.15, history: 0.1 });
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0).toFixed(6), '1.000000');
});

test('a perfect song scores 100% and the total follows the weights', () => {
  const song = { id: 'x', artist: 'A', moods: ['sad'], effects: ['comfort'], genres: ['indie'], energy: 15, intensity: 85, tempo: 'slow', bpm: 70 };
  const liked = buildTaste([song], []);
  const { total } = scoreSong({ ...sadComfort, moods: ['sad'] }, song, liked);
  assert.equal(total.toFixed(4), '1.0000');
});

test('every mood and every desired effect yields at least 10 explained songs', () => {
  for (const mood of MOOD_IDS) {
    for (const effect of EFFECT_IDS) {
      const result = run({ moods: [mood], energy: 50, intensity: 50, genres: [], desired_effect: effect, tempo: 'any' });
      assert.equal(result.recommendations.length, 10, `${mood}/${effect}`);
      assert.ok(result.recommendations.every((item) => item.reasons.length > 0));
      assert.equal(new Set(titles(result)).size, 10);
    }
  }
});

test('the same mood with a different wish gives different music', () => {
  const base = { moods: ['sad'], energy: 25, intensity: 70, genres: [], tempo: 'any' };
  const comfort = run({ ...base, desired_effect: 'comfort' });
  const release = run({ ...base, desired_effect: 'release' });
  assert.notDeepEqual(titles(comfort).slice(0, 4), titles(release).slice(0, 4));
  assert.ok(comfort.recommendations[0].song.effects.includes('comfort'));
  assert.ok(release.recommendations[0].song.effects.includes('release'));
  // Sad + comfort must not turn into "cheer up" music.
  assert.ok(!comfort.recommendations.slice(0, 5).some((item) => item.song.moods.includes('happy')));
});

test('results are sorted, best match first', () => {
  const matches = run(sadComfort).recommendations.map((item) => item.match);
  assert.deepEqual(matches, [...matches].sort((a, b) => b - a));
});

test('multiple moods are all represented', () => {
  const top = run(sadComfort).recommendations.slice(0, 6).flatMap((item) => item.song.moods);
  assert.ok(top.includes('sad') && top.includes('lonely'));
});

test('no more than two songs per artist', () => {
  const counts = {};
  for (const item of run(sadComfort).recommendations) counts[item.song.artist] = (counts[item.song.artist] ?? 0) + 1;
  assert.ok(Math.max(...Object.values(counts)) <= 2);
});

test('rejected songs never come back, in any list', () => {
  const first = run(sadComfort);
  const rejected = titles(first).slice(0, 3);
  const second = run(sadComfort, { rejected });
  const everything = [...second.recommendations, ...second.reserve, ...second.alternative.recommendations].map((item) => item.song.id);
  assert.ok(rejected.every((id) => !everything.includes(id)));
  assert.equal(second.recommendations.length, 10);
});

test('recently shown songs are pushed down so lists do not repeat', () => {
  const first = titles(run(sadComfort));
  const second = titles(run(sadComfort, { recent: first }));
  const repeated = second.filter((id) => first.includes(id));
  assert.ok(repeated.length <= 5, `too many repeats: ${repeated.length}`);
});

test('likes and rejections shift the history score', () => {
  const jazz = SONGS.find((song) => song.genres.includes('jazz'));
  const otherJazz = SONGS.find((song) => song.genres.includes('jazz') && song.id !== jazz.id);
  assert.equal(historyScore(otherJazz, buildTaste([], [])), 0.5);
  assert.ok(historyScore(otherJazz, buildTaste([jazz], [])) > 0.5);
  assert.ok(historyScore(otherJazz, buildTaste([], [jazz])) < 0.5);
});

test('alternative offers a different direction without duplicates', () => {
  const result = run(sadComfort);
  assert.equal(result.alternative.desired_effect, 'embrace');
  assert.equal(result.alternative.recommendations.length, 5);
  const main = titles(result);
  assert.ok(result.alternative.recommendations.every((item) => !main.includes(item.song.id)));
});

test('reserve holds spare songs that are not in the main list', () => {
  const result = run(sadComfort);
  const main = titles(result);
  assert.ok(result.reserve.length >= 5);
  assert.ok(result.reserve.every((item) => !main.includes(item.song.id)));
});
