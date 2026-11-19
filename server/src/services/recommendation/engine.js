// The rule-based recommendation engine.
// It needs no AI service and no internet connection, so MOODIFY always works.
import { WEIGHTS, ALTERNATIVE_EFFECT, EFFECTS } from '../../data/taxonomy.js';
import { scoreSong, buildTaste } from './scoring.js';
import { explain } from './explain.js';

const MAX_PER_ARTIST = 2;
const ALTERNATIVE_SIZE = 5;

// Songs shown recently are pushed down so the list does not repeat itself.
// "recent" is ordered newest first.
function repeatPenalty(songId, recent) {
  const position = recent.indexOf(songId);
  if (position === -1) return 0;
  return position < 10 ? 0.25 : 0.12;
}

function rank(profile, songs, taste, recent, fill = new Set()) {
  return songs
    .map((song) => {
      const { parts, total } = scoreSong(profile, song, taste);
      const fillPenalty = fill.has(song.id) ? 0.2 : 0;
      return { song, parts, total, adjusted: total - repeatPenalty(song.id, recent) - fillPenalty };
    })
    .sort((a, b) => b.adjusted - a.adjusted || b.song.popularity - a.song.popularity);
}

// Takes songs from the top of the ranking, at most two per artist.
function pickDiverse(ranked, count) {
  const perArtist = new Map();
  const picked = [];
  const passedOver = [];
  for (const entry of ranked) {
    const used = perArtist.get(entry.song.artist) ?? 0;
    if (picked.length < count && used < MAX_PER_ARTIST) {
      perArtist.set(entry.song.artist, used + 1);
      picked.push(entry);
    } else {
      passedOver.push(entry);
    }
  }
  return { picked, passedOver };
}

const percent = (value) => Math.round(value * 100);

function present(profile, entry) {
  return {
    song: entry.song,
    match: percent(entry.total),
    breakdown: Object.fromEntries(Object.entries(entry.parts).map(([key, value]) => [key, percent(value)])),
    reasons: explain(profile, entry.song, entry.parts),
  };
}

/**
 * @param profile   the structured mood profile
 * @param songs     the whole catalogue
 * @param feedback  { liked: [ids], rejected: [ids], skipped: [ids], recent: [ids, newest first] }
 * @param limit     how many main recommendations to return
 */
export function recommend({ profile, songs, feedback = {}, limit = 10 }) {
  const liked = new Set(feedback.liked ?? []);
  const rejected = new Set(feedback.rejected ?? []);
  const recent = feedback.recent ?? [];
  const skipped = new Set((feedback.skipped ?? []).filter((id) => !liked.has(id)));

  const taste = buildTaste(
    songs.filter((song) => liked.has(song.id)),
    songs.filter((song) => rejected.has(song.id)),
    songs.filter((song) => skipped.has(song.id)),
  );

  // Rejected songs are never recommended again.
  let candidates = songs.filter((song) => !rejected.has(song.id));

  // Languages: only songs sung in the chosen languages. If there are too few
  // for a full list, instrumental songs (no singing) fill the gap, ranked lower.
  const languages = profile.languages ?? [];
  let fill = new Set();
  if (languages.length > 0) {
    const sung = candidates.filter((song) => languages.includes(song.language));
    if (sung.length < limit * 2) {
      const instrumental = candidates.filter((song) => song.language === 'instrumental');
      fill = new Set(instrumental.map((song) => song.id));
      candidates = [...sung, ...instrumental];
    } else {
      candidates = sung;
    }
  }

  const ranked = rank(profile, candidates, taste, recent, fill);
  const { picked, passedOver } = pickDiverse(ranked, limit);

  // "A different direction": same person, contrasting wish.
  const altEffect = ALTERNATIVE_EFFECT[profile.desired_effect];
  const altProfile = { ...profile, desired_effect: altEffect };
  const mainIds = new Set(picked.map((entry) => entry.song.id));
  const altRanked = rank(altProfile, candidates.filter((song) => !mainIds.has(song.id)), taste, recent, fill);
  const altPicked = pickDiverse(altRanked, ALTERNATIVE_SIZE).picked;

  return {
    source: 'rule-based',
    profile,
    recommendations: picked.map((entry) => present(profile, entry)),
    // Spare songs the screen can pull in when the user rejects one.
    reserve: passedOver.slice(0, limit).map((entry) => present(profile, entry)),
    alternative: {
      desired_effect: altEffect,
      label: EFFECTS[altEffect].label,
      recommendations: altPicked.map((entry) => present(altProfile, entry)),
    },
    meta: {
      catalogue_size: songs.length,
      languages,
      instrumental_fill: picked.some((entry) => fill.has(entry.song.id)),
      weights: WEIGHTS,
      learned_from: taste.samples,
    },
  };
}
