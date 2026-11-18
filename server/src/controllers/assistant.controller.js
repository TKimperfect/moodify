import { respond, analyze } from '../services/assistant.service.js';

export async function postMessage(req, res) {
  const { message, choice, history, state } = req.valid.body;
  const result = await respond({ message, choice: choice ?? null, history, state: state ?? null });
  res.json({
    reply: result.reply,
    follow_up: result.followUp,
    state: result.state,
    profile: result.profile,
    interpretation: result.interpretation,
    safety: result.safety,
    source: result.source,
    ai_error: result.ai_error ?? false,
  });
}

export async function postAnalyze(req, res) {
  res.json(await analyze(req.valid.body));
}
