import * as sessions from '../services/moodSessions.service.js';

export async function getMoodSessions(req, res) {
  const items = await sessions.listMoodSessions(req.db, req.valid.query);
  res.json({ mood_sessions: items, count: items.length });
}

export async function postMoodSession(req, res) {
  res.status(201).json({ mood_session: await sessions.saveMoodSession(req.db, req.user.id, req.valid.body) });
}

export async function deleteMoodSession(req, res) {
  await sessions.deleteMoodSession(req.db, req.valid.params.id);
  res.status(204).end();
}
