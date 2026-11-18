import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Window from '../components/ui/Window.jsx';
import ChatMessage from '../components/assistant/ChatMessage.jsx';
import ReadingPanel from '../components/assistant/ReadingPanel.jsx';
import { useAssistant } from '../context/AssistantContext.jsx';
import { useMoodProfile } from '../context/MoodProfileContext.jsx';

const MAX_LENGTH = 1000;

export default function Assistant() {
  const { messages, state, profile, source, status, error, send, retry, reset } = useAssistant();
  const { applyProfile, loadIntoEditor } = useMoodProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [text, setText] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const sending = status === 'sending';

  // A sentence handed over from the homepage examples starts the chat.
  // (The ref stops React's development double-run from sending it twice.)
  const prefill = location.state?.prefill;
  const prefillSent = useRef(null);
  useEffect(() => {
    if (typeof prefill === 'string' && prefill.trim() && prefillSent.current !== location.key) {
      prefillSent.current = location.key;
      navigate(location.pathname, { replace: true, state: null });
      send(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  // Keep the newest message in view (inside the chat box, not the page).
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages.length, status]);

  function submit(event) {
    event.preventDefault();
    if (sending || !text.trim()) return;
    send(text);
    setText('');
  }

  function onKeyDown(event) {
    // Enter sends; Shift+Enter makes a new line.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  }

  function showSongs() {
    if (applyProfile(profile)) navigate('/recommendations');
  }

  function fineTune() {
    loadIntoEditor(profile);
    navigate('/');
  }

  function startOver() {
    reset();
    setText('');
    inputRef.current?.focus();
  }

  const last = messages.at(-1);
  const options = !sending && last?.role === 'assistant' ? (last.followUp?.options ?? []) : [];
  const lastNotes = [...messages].reverse().find((message) => message.role === 'assistant' && message.interpretation)?.interpretation;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <p className="pixel-label text-rose">Mood assistant</p>
        <h1 className="chrome-text mt-2 font-display text-[clamp(1.5rem,6vw,2.25rem)] tracking-wider">Talk it through</h1>
        <p className="mt-3 max-w-xl text-silver">
          Describe how you feel in your own words. MOODIFY is a music companion, not a therapist: it doesn't diagnose
          anything, it just looks for music that fits.
        </p>
      </header>

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Window title="assistant.chat" status={sending ? 'thinking' : 'online'} className="flex flex-col">
          <ol
            ref={listRef}
            className="h-[min(60vh,32rem)] space-y-4 overflow-y-auto p-4 sm:p-5"
            aria-label="Conversation"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {sending && (
              <li className="pixel-label pl-10 text-silver" role="status">
                thinking
                <span className="ml-1 inline-block h-[0.9em] w-[0.5em] translate-y-[0.1em] animate-blink bg-orchid" aria-hidden="true" />
              </li>
            )}
          </ol>

          {options.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3 sm:px-5" role="group" aria-label="Quick answers">
              {options.map((option) => (
                <button key={option.label} type="button" className="btn-ghost normal-case" onClick={() => send(option.label, option.choice ?? null)}>
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rose/40 bg-rose/10 px-4 py-3 text-sm sm:px-5" role="alert">
              <span className="text-chrome">{error}. Your message was not lost.</span>
              <button type="button" className="btn-ghost" onClick={retry}>
                Try again
              </button>
            </div>
          )}

          <form onSubmit={submit} className="border-t border-line bg-void/60 p-3 sm:p-4">
            <label htmlFor="chat-input" className="sr-only">
              Your message
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              rows={2}
              value={text}
              maxLength={MAX_LENGTH}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="e.g. I feel flat and I don't want to be cheered up"
              className="block w-full resize-none rounded-md border border-line bg-ink/70 px-3 py-2.5 text-frost placeholder:text-silver/70 focus:border-orchid focus:outline-none"
            />
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <span className="pixel-label text-silver">
                Enter to send · {text.length}/{MAX_LENGTH}
              </span>
              <button type="submit" className="btn-chrome" disabled={sending || !text.trim()}>
                Send
              </button>
            </div>
          </form>
        </Window>

        <ReadingPanel
          state={state}
          profile={profile}
          notes={lastNotes}
          source={source}
          onShowSongs={showSongs}
          onFineTune={fineTune}
          onReset={startOver}
        />
      </div>
    </div>
  );
}
