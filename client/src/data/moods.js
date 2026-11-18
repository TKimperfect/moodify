// The ten moods a user can pick. "glyph" is a 7x7 pixel drawing:
// "#" is a filled pixel and "." is an empty one.
export const MOODS = [
  {
    id: 'happy',
    label: 'Happy',
    hint: 'light, open',
    glyph: ['...#...', '.#...#.', '..###..', '#.###.#', '..###..', '.#...#.', '...#...'],
  },
  {
    id: 'sad',
    label: 'Sad',
    hint: 'heavy, tender',
    glyph: ['...#...', '...#...', '..###..', '..###..', '.#####.', '.#####.', '..###..'],
  },
  {
    id: 'lonely',
    label: 'Lonely',
    hint: 'far from people',
    glyph: ['##...##', '#.....#', '.......', '...#...', '.......', '#.....#', '##...##'],
  },
  {
    id: 'angry',
    label: 'Angry',
    hint: 'pressure building',
    glyph: ['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'],
  },
  {
    id: 'anxious',
    label: 'Anxious',
    hint: 'restless, wired',
    glyph: ['.......', '#...#..', '.#.#.#.', '..#...#', '#...#..', '.#.#.#.', '..#...#'],
  },
  {
    id: 'calm',
    label: 'Calm',
    hint: 'still, settled',
    glyph: ['.......', '.##..##', '#..##..', '.......', '.##..##', '#..##..', '.......'],
  },
  {
    id: 'nostalgic',
    label: 'Nostalgic',
    hint: 'somewhere back then',
    glyph: ['#######', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#####.', '#######'],
  },
  {
    id: 'motivated',
    label: 'Motivated',
    hint: 'ready to move',
    glyph: ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..'],
  },
  {
    id: 'empty',
    label: 'Empty',
    hint: 'nothing much at all',
    glyph: ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'],
  },
  {
    id: 'romantic',
    label: 'Romantic',
    hint: 'soft on someone',
    glyph: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
  },
];

// How many moods can be picked at once.
export const MAX_MOODS = 3;
