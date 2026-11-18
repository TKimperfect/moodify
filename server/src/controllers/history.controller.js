import * as history from '../services/history.service.js';

export async function getHistory(req, res) {
  const entries = await history.listHistory(req.db, req.valid.query);
  res.json({ history: entries, count: entries.length });
}

export async function postHistory(req, res) {
  res.status(201).json({ entry: await history.addHistoryEvent(req.db, req.user.id, req.valid.body) });
}

export async function deleteRejections(req, res) {
  res.json({ removed: await history.clearRejections(req.db, req.user.id, null) });
}

export async function deleteRejection(req, res) {
  res.json({ removed: await history.clearRejections(req.db, req.user.id, req.valid.params.songId) });
}
