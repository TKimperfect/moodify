// Checks the Claude-powered assistant against a pretend Anthropic API
// (started inside this test, so no real key or money is involved).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let nextAnswer; // what the pretend API returns next
const requests = [];

const fake = http.createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  requests.push({ path: req.url, headers: req.headers, body: JSON.parse(raw) });
  const answer = typeof nextAnswer === 'function' ? nextAnswer() : nextAnswer;
  if (answer.status) {
    res.writeHead(answer.status, { 'Content-Type': 'application/json', 'x-should-retry': 'false' });
    return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'boom' } }));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: answer.text === undefined ? [] : [{ type: 'text', text: answer.text }],
      stop_reason: answer.stop_reason ?? 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    }),
  );
});

const turn = (fields) =>
  JSON.stringify({
    reply: 'ok',
    moods: [],
    desired_effect: null,
    energy: null,
    intensity: null,
    tempo: null,
    genres: [],
    languages: [],
    ready: false,
    follow_up: null,
    ...fields,
  });

let respond;
before(async () => {
  await new Promise((resolve) => fake.listen(0, resolve));
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
  process.env.ANTHROPIC_MODEL = '';
  ({ respond } = await import('../src/services/assistant.service.js'));
});
after(() => fake.close());

test('uses Claude with the documented request shape', async () => {
  nextAnswer = { text: turn({ reply: 'Te escucho. ¿Quieres consuelo o quedarte en ese sentimiento?', moods: ['sad'], follow_up: { slot: 'effect', options: ['Consuelo', 'Quedarme ahí'] } }) };
  requests.length = 0;
  const result = await respond({ message: 'estoy triste', choice: null, history: [], state: null });

  assert.equal(result.source, 'ai');
  assert.equal(result.profile, null);
  assert.deepEqual(result.state.moods, ['sad']);
  assert.deepEqual(result.followUp.options.map((option) => option.label), ['Consuelo', 'Quedarme ahí']);
  assert.ok(result.state.asked.includes('effect'));

  const { body, headers, path } = requests[0];
  assert.match(path, /\/v1\/messages/);
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.output_config.effort, 'low');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.equal(body.fallbacks, 'default');
  assert.match(headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(headers.authorization, 'Bearer test-key');
  assert.ok(!('thinking' in body) && !('temperature' in body));
  assert.match(body.messages.at(-1).content, /<current_understanding>/);
});

test('a ready answer from Claude becomes a profile', async () => {
  nextAnswer = { text: turn({ reply: 'Got it: sad, and you want company.', moods: ['sad', 'lonely'], desired_effect: 'companionship', energy: 22, intensity: 140, ready: true }) };
  const result = await respond({ message: 'I want company', choice: null, history: [], state: { moods: ['sad'], asked: ['effect'], turns: 1 } });
  assert.equal(result.source, 'ai');
  assert.deepEqual(result.profile, { moods: ['sad', 'lonely'], energy: 22, intensity: 100, genres: [], desired_effect: 'companionship', tempo: 'any', languages: [] });
  assert.equal(result.reply, 'Got it: sad, and you want company.');
});

test('"ready" without a desired effect is not trusted: the assistant asks', async () => {
  nextAnswer = { text: turn({ reply: 'Okay.', moods: ['angry'], ready: true }) };
  const result = await respond({ message: 'so angry', choice: null, history: [], state: null });
  assert.equal(result.profile, null);
  assert.equal(result.followUp.slot, 'effect');
});

test('falls back to the rule-based engine on errors, refusals and bad answers', async () => {
  for (const answer of [{ status: 500 }, { status: 401 }, { text: 'not json at all' }, { text: '', stop_reason: 'refusal' }]) {
    nextAnswer = answer;
    const result = await respond({ message: "I'm sad and don't want to be cheered up", choice: null, history: [], state: null });
    assert.equal(result.source, 'rule-based', JSON.stringify(answer));
    assert.equal(result.ai_error, true);
    assert.equal(result.profile.desired_effect, 'embrace');
  }
});

test('crisis messages never go to the AI', async () => {
  requests.length = 0;
  const result = await respond({ message: 'I want to end my life', choice: null, history: [], state: null });
  assert.equal(result.safety, 'support');
  assert.equal(requests.length, 0);
});

test('only valid ids from Claude are kept', async () => {
  nextAnswer = { text: turn({ moods: ['sad'], genres: ['indie'], desired_effect: 'comfort', ready: true }) };
  const result = await respond({ message: 'x', choice: null, history: [{ role: 'assistant', content: 'Hi!' }, { role: 'user', content: 'hello' }], state: null });
  assert.deepEqual(result.profile.genres, ['indie']);
  // History sent to Claude must start with a user message.
  assert.equal(requests.at(-1).body.messages[0].role, 'user');
});

test('languages from Claude are kept and passed on', async () => {
  nextAnswer = { text: turn({ moods: ['sad'], desired_effect: 'embrace', languages: ['zh'], ready: true }) };
  const result = await respond({ message: '想听粤语歌', choice: null, history: [], state: null });
  assert.deepEqual(result.profile.languages, ['zh']);
});
