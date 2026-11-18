import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiPost } from '../lib/api.js';
import { readJson, writeJson, removeKey } from '../lib/storage.js';

// Remembers the conversation with the mood assistant while the user moves
// between pages. Kept only for this browser tab (sessionStorage), so a
// private conversation does not linger on a shared computer.
const STORAGE_KEY = 'moodify.assistant.v1';
const AssistantContext = createContext(null);

const GREETING = {
  id: 'greeting',
  role: 'assistant',
  content: "Hey. How are you feeling right now? Say it however it comes out. I'll ask a question or two, then find music for it.",
  followUp: null,
};

const START = { messages: [GREETING], state: null, profile: null, source: null };

function load() {
  const stored = readJson(STORAGE_KEY, 'session');
  if (!stored || !Array.isArray(stored.messages) || stored.messages.length === 0) return START;
  const messages = stored.messages.filter(
    (message) => message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string',
  );
  return { messages: messages.length ? messages : [GREETING], state: stored.state ?? null, profile: stored.profile ?? null, source: stored.source ?? null };
}

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter += 1)}`;

export function AssistantProvider({ children }) {
  const [chat, setChat] = useState(load);
  const [status, setStatus] = useState('idle'); // idle | sending | error
  const [error, setError] = useState(null);
  const failed = useRef(null);
  const chatRef = useRef(chat);
  chatRef.current = chat;

  useEffect(() => {
    writeJson(STORAGE_KEY, chat, 'session');
  }, [chat]);

  const send = useCallback(async (text, choice = null) => {
    const message = text.trim();
    if (!message) return;
    const current = chatRef.current;
    const userMessage = { id: newId(), role: 'user', content: message.slice(0, 1000) };
    setChat({ ...current, messages: [...current.messages, userMessage] });
    setStatus('sending');
    setError(null);

    const history = current.messages
      .filter((entry) => entry.id !== 'greeting')
      .slice(-20)
      .map((entry) => ({ role: entry.role, content: entry.content.slice(0, 2000) }));

    try {
      const result = await apiPost('/assistant/message', { message: userMessage.content, choice, history, state: current.state });
      const reply = {
        id: newId(),
        role: 'assistant',
        content: result.reply,
        followUp: result.follow_up,
        interpretation: result.interpretation,
        safety: result.safety,
        source: result.source,
      };
      setChat((latest) => ({
        messages: [...latest.messages, reply],
        state: result.state,
        profile: result.profile,
        source: result.source,
      }));
      failed.current = null;
      setStatus('idle');
    } catch (problem) {
      // Keep what the user typed; "Try again" resends it.
      failed.current = { id: userMessage.id, text: message, choice };
      setError(problem.message);
      setStatus('error');
    }
  }, []);

  const retry = useCallback(() => {
    const last = failed.current;
    if (!last) return;
    setChat((current) => ({ ...current, messages: current.messages.filter((entry) => entry.id !== last.id) }));
    chatRef.current = { ...chatRef.current, messages: chatRef.current.messages.filter((entry) => entry.id !== last.id) };
    send(last.text, last.choice);
  }, [send]);

  const reset = useCallback(() => {
    removeKey(STORAGE_KEY, 'session');
    failed.current = null;
    setError(null);
    setStatus('idle');
    setChat(START);
  }, []);

  const value = useMemo(() => ({ ...chat, status, error, send, retry, reset }), [chat, status, error, send, retry, reset]);
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error('useAssistant must be used inside <AssistantProvider>');
  return context;
}
