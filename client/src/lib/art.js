// Generates cover art settings for a song that has no real image.
// The same song always gets the same colours.
const PALETTES = [
  ['#6a4dd0', '#15122a'],
  ['#d8a3be', '#3a2a66'],
  ['#8f8ea6', '#111019'],
  ['#2a1d5e', '#b6a0ff'],
  ['#b98aa6', '#1a1530'],
  ['#e9e8f5', '#6a4dd0'],
  ['#4b3a9c', '#d8a3be'],
  ['#1b1730', '#8f8ea6'],
];

function hash(text) {
  let value = 0;
  for (const char of text) value = (value * 31 + char.codePointAt(0)) >>> 0;
  return value;
}

export function artFor(song) {
  const seed = hash(song.id);
  const [from, to] = PALETTES[seed % PALETTES.length];
  return { from, to, angle: (seed >> 3) % 360, glyph: song.moods[0] };
}
