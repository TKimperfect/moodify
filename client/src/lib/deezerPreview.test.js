import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deezerTrackId, deezerPreview, loadJsonp } from './deezerPreview.js';

test('only Deezer songs have a Deezer track id', () => {
  assert.equal(deezerTrackId({ id: 'deezer-10308117', playback: { source: 'deezer' } }), '10308117');
  assert.equal(deezerTrackId({ id: 'jamendo-5', playback: { source: 'jamendo' } }), null);
  assert.equal(deezerTrackId({ id: 'deezer-abc', playback: { source: 'deezer' } }), null);
  assert.equal(deezerTrackId(null), null);
});

test('the preview is asked from the browser and kept for a while', async () => {
  const asked = [];
  const jsonp = async (url) => {
    asked.push(url);
    return { id: 1, preview: 'https://cdnt-preview.dzcdn.net/a.mp3' };
  };
  let clock = 1000;
  const now = () => clock;
  assert.equal(await deezerPreview('111', { jsonp, now }), 'https://cdnt-preview.dzcdn.net/a.mp3');
  assert.equal(await deezerPreview('111', { jsonp, now }), 'https://cdnt-preview.dzcdn.net/a.mp3');
  assert.deepEqual(asked, ['https://api.deezer.com/track/111']);
  clock += 16 * 60 * 1000; // links expire: ask again
  await deezerPreview('111', { jsonp, now });
  assert.equal(asked.length, 2);
});

test('no preview in this country gives null', async () => {
  assert.equal(await deezerPreview('222', { jsonp: async () => ({ id: 2, readable: false, preview: '' }) }), null);
  assert.equal(await deezerPreview('333', { jsonp: async () => ({ error: { type: 'DataException' } }) }), null);
});

test('JSONP: adds a script, resolves with its data and cleans up', async () => {
  const added = [];
  const win = {};
  const doc = {
    createElement: () => ({ remove() { added.splice(added.indexOf(this), 1); } }),
    head: { appendChild: (script) => added.push(script) },
  };
  const promise = loadJsonp('https://api.deezer.com/track/9', { doc, win });
  const script = added[0];
  const name = /callback=([\w]+)/.exec(script.src)[1];
  assert.match(script.src, /^https:\/\/api\.deezer\.com\/track\/9\?output=jsonp&callback=/);
  win[name]({ preview: 'https://x/y.mp3' });
  assert.deepEqual(await promise, { preview: 'https://x/y.mp3' });
  assert.equal(win[name], undefined);
  assert.equal(added.length, 0);
});
