// Pure logic for the play queue (no React, no audio), so it is easy to test.
//
// state = {
//   queue:    the songs, in the order they were added
//   order:    the play order, as positions in "queue" (shuffled or not)
//   position: where we are in "order" (-1 = nothing selected)
//   shuffle:  true / false
//   repeat:   'off' | 'all' | 'one'
//   ended:    true when the queue finished playing (repeat off)
// }
export const MAX_QUEUE = 200;

export const EMPTY_QUEUE = Object.freeze({ queue: [], order: [], position: -1, shuffle: false, repeat: 'off', ended: false });

export function currentSong(state) {
  return state.position >= 0 ? (state.queue[state.order[state.position]] ?? null) : null;
}

// The songs in play order, each with its queue index.
export function playOrder(state) {
  return state.order.map((queueIndex, position) => ({ song: state.queue[queueIndex], queueIndex, position }));
}

function shuffled(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const identity = (length) => Array.from({ length }, (_, i) => i);

function uniqueSongs(songs) {
  const seen = new Set();
  return songs.filter((song) => song?.id && !seen.has(song.id) && seen.add(song.id)).slice(0, MAX_QUEUE);
}

export function queueReducer(state, action) {
  const random = action.random ?? Math.random;

  switch (action.type) {
    case 'PLAY_LIST': {
      const queue = uniqueSongs(action.songs);
      if (queue.length === 0) return state;
      const start = Math.max(0, queue.findIndex((song) => song.id === action.songs[action.startIndex ?? 0]?.id));
      if (state.shuffle) {
        const rest = shuffled(identity(queue.length).filter((i) => i !== start), random);
        return { ...state, queue, order: [start, ...rest], position: 0, ended: false };
      }
      return { ...state, queue, order: identity(queue.length), position: start, ended: false };
    }

    case 'ADD': {
      if (state.queue.some((song) => song.id === action.song.id) || state.queue.length >= MAX_QUEUE) return state;
      const queue = [...state.queue, action.song];
      const order = [...state.order, queue.length - 1];
      return { ...state, queue, order, position: state.position === -1 ? 0 : state.position, ended: false };
    }

    case 'PLAY_NEXT': {
      let queue = state.queue;
      let index = queue.findIndex((song) => song.id === action.song.id);
      if (index === -1) {
        if (queue.length >= MAX_QUEUE) return state;
        queue = [...queue, action.song];
        index = queue.length - 1;
      }
      if (state.position !== -1 && state.order[state.position] === index) return { ...state, queue };
      const order = state.order.filter((i) => i !== index);
      const position = state.position === -1 ? -1 : order.indexOf(state.order[state.position]);
      order.splice(position + 1, 0, index);
      return { ...state, queue, order, position: position === -1 ? 0 : position, ended: false };
    }

    case 'REMOVE': {
      const removed = action.queueIndex;
      if (removed < 0 || removed >= state.queue.length) return state;
      const removedPosition = state.order.indexOf(removed);
      const queue = state.queue.filter((_, i) => i !== removed);
      const order = state.order.filter((i) => i !== removed).map((i) => (i > removed ? i - 1 : i));
      let position = state.position;
      if (removedPosition < position) position -= 1;
      if (position >= order.length) position = order.length - 1;
      return { ...state, queue, order, position };
    }

    case 'MOVE': {
      const { from, to } = action;
      if (from === to || from < 0 || to < 0 || from >= state.order.length || to >= state.order.length) return state;
      const playing = state.order[state.position];
      const order = [...state.order];
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      return { ...state, order, position: state.position === -1 ? -1 : order.indexOf(playing) };
    }

    case 'JUMP':
      if (action.position < 0 || action.position >= state.order.length) return state;
      return { ...state, position: action.position, ended: false };

    case 'NEXT': {
      if (state.order.length === 0) return state;
      if (state.position < state.order.length - 1) return { ...state, position: state.position + 1, ended: false };
      if (state.repeat === 'all' || !action.auto) {
        if (state.repeat !== 'all' && !action.auto) return { ...state, ended: true };
        const order = state.shuffle ? shuffled(state.order, random) : state.order;
        return { ...state, order, position: 0, ended: false };
      }
      return { ...state, ended: true };
    }

    case 'PREVIOUS': {
      if (state.order.length === 0) return state;
      if (state.position > 0) return { ...state, position: state.position - 1, ended: false };
      return { ...state, position: state.repeat === 'all' ? state.order.length - 1 : 0, ended: false };
    }

    case 'TOGGLE_SHUFFLE': {
      const playing = state.position === -1 ? -1 : state.order[state.position];
      if (state.shuffle) {
        return { ...state, shuffle: false, order: identity(state.queue.length), position: playing };
      }
      const rest = shuffled(identity(state.queue.length).filter((i) => i !== playing), random);
      const order = playing === -1 ? rest : [playing, ...rest];
      return { ...state, shuffle: true, order, position: playing === -1 ? -1 : 0 };
    }

    case 'CYCLE_REPEAT': {
      const next = { off: 'all', all: 'one', one: 'off' };
      return { ...state, repeat: next[state.repeat] ?? 'off' };
    }

    case 'CLEAR':
      return { ...EMPTY_QUEUE, shuffle: state.shuffle, repeat: state.repeat };

    default:
      return state;
  }
}

// Checks state restored from browser storage; returns a safe version.
export function restoreQueue(stored) {
  if (!stored || !Array.isArray(stored.queue) || !Array.isArray(stored.order)) return EMPTY_QUEUE;
  const queue = stored.queue.filter((song) => song && typeof song.id === 'string' && typeof song.title === 'string').slice(0, MAX_QUEUE);
  const valid = stored.order.length === queue.length && stored.order.every((i) => Number.isInteger(i) && i >= 0 && i < queue.length) && new Set(stored.order).size === queue.length;
  const order = valid ? stored.order : identity(queue.length);
  const position = Number.isInteger(stored.position) && stored.position < order.length ? stored.position : queue.length ? 0 : -1;
  return {
    queue,
    order,
    position,
    shuffle: stored.shuffle === true,
    repeat: ['off', 'all', 'one'].includes(stored.repeat) ? stored.repeat : 'off',
    ended: false,
  };
}
