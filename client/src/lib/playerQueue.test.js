// Automated checks for the play queue. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queueReducer as reduce, EMPTY_QUEUE, currentSong, playOrder, restoreQueue } from './playerQueue.js';

const songs = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, title: id.toUpperCase() }));
const ids = (state) => playOrder(state).map((entry) => entry.song.id).join('');
const fixedRandom = () => 0; // makes shuffling predictable in tests

const start = (index = 0) => reduce(EMPTY_QUEUE, { type: 'PLAY_LIST', songs, startIndex: index });

test('play a list from any song', () => {
  const state = start(2);
  assert.equal(currentSong(state).id, 'c');
  assert.equal(ids(state), 'abcde');
});

test('next and previous, stopping at the ends when repeat is off', () => {
  let state = start(3);
  state = reduce(state, { type: 'NEXT' });
  assert.equal(currentSong(state).id, 'e');
  state = reduce(state, { type: 'NEXT', auto: true });
  assert.equal(state.ended, true);
  assert.equal(currentSong(state).id, 'e');
  state = reduce(start(0), { type: 'PREVIOUS' });
  assert.equal(currentSong(state).id, 'a');
});

test('repeat all wraps around in both directions; the cycle is off → all → one → off', () => {
  let state = reduce(start(4), { type: 'CYCLE_REPEAT' });
  assert.equal(state.repeat, 'all');
  state = reduce(state, { type: 'NEXT', auto: true });
  assert.equal(currentSong(state).id, 'a');
  state = reduce(state, { type: 'PREVIOUS' });
  assert.equal(currentSong(state).id, 'e');
  state = reduce(reduce(state, { type: 'CYCLE_REPEAT' }), { type: 'CYCLE_REPEAT' });
  assert.equal(state.repeat, 'off');
});

test('shuffle keeps the current song first and every song exactly once; turning it off restores the order', () => {
  let state = reduce(start(2), { type: 'TOGGLE_SHUFFLE', random: fixedRandom });
  assert.equal(currentSong(state).id, 'c');
  assert.equal(state.position, 0);
  assert.equal([...ids(state)].sort().join(''), 'abcde');
  assert.notEqual(ids(state), 'abcde');
  state = reduce(state, { type: 'TOGGLE_SHUFFLE' });
  assert.equal(ids(state), 'abcde');
  assert.equal(currentSong(state).id, 'c');
});

test('add to queue ignores duplicates; play next inserts after the current song', () => {
  let state = start(0);
  state = reduce(state, { type: 'ADD', song: songs[1] });
  assert.equal(state.queue.length, 5);
  state = reduce(state, { type: 'ADD', song: { id: 'x', title: 'X' } });
  assert.equal(ids(state), 'abcdex');
  state = reduce(state, { type: 'PLAY_NEXT', song: songs[4] });
  assert.equal(ids(state), 'aebcdx');
  state = reduce(state, { type: 'PLAY_NEXT', song: { id: 'y', title: 'Y' } });
  assert.equal(ids(state), 'ayebcdx');
  assert.equal(currentSong(state).id, 'a');
});

test('adding to an empty queue selects that song', () => {
  const state = reduce(EMPTY_QUEUE, { type: 'ADD', song: songs[0] });
  assert.equal(currentSong(state).id, 'a');
});

test('remove keeps playing the right song', () => {
  let state = start(2);
  state = reduce(state, { type: 'REMOVE', queueIndex: 0 });
  assert.equal(currentSong(state).id, 'c');
  assert.equal(ids(state), 'bcde');
  state = reduce(state, { type: 'REMOVE', queueIndex: 1 }); // the current song
  assert.equal(currentSong(state).id, 'd');
  state = reduce(reduce(reduce(state, { type: 'REMOVE', queueIndex: 2 }), { type: 'REMOVE', queueIndex: 1 }), { type: 'REMOVE', queueIndex: 0 });
  assert.equal(currentSong(state), null);
});

test('move reorders upcoming songs without changing what plays now', () => {
  let state = start(1);
  state = reduce(state, { type: 'MOVE', from: 4, to: 2 });
  assert.equal(ids(state), 'abecd');
  assert.equal(currentSong(state).id, 'b');
  state = reduce(state, { type: 'NEXT' });
  assert.equal(currentSong(state).id, 'e');
});

test('clear keeps the shuffle and repeat settings', () => {
  const state = reduce(reduce(start(), { type: 'CYCLE_REPEAT' }), { type: 'CLEAR' });
  assert.equal(state.queue.length, 0);
  assert.equal(state.repeat, 'all');
  assert.equal(currentSong(state), null);
});

test('restoring from storage repairs broken data', () => {
  assert.deepEqual(restoreQueue(null), EMPTY_QUEUE);
  const restored = restoreQueue({ queue: [...songs, { nope: 1 }], order: [9, 9], position: 50, repeat: 'sometimes' });
  assert.equal(restored.queue.length, 5);
  assert.equal(ids(restored), 'abcde');
  assert.equal(restored.position, 0);
  assert.equal(restored.repeat, 'off');
});
