/**
 * @file AskUserPopup.tsx
 *
 * A floating popup that simulates a chat exchange between the AI agent and the
 * "taxpayer" (an NPC persona). When the agent needs information from the
 * taxpayer, it fires a custom browser event called "taxportal:askuser". This
 * component listens for that event and displays the question/answer pair in a
 * chat-bubble UI in the top-right corner of the screen.
 *
 * The interaction has two phases:
 *   Phase 1 -- The question is shown with animated "typing" dots in the answer
 *              bubble, indicating the taxpayer is composing a reply.
 *   Phase 2 -- The answer text is revealed character by character (typewriter
 *              effect), then the popup automatically dismisses after 4 seconds.
 *
 * This gives the user a visual sense that the agent is actively communicating
 * with the taxpayer persona behind the scenes.
 */

import { useEffect, useState, useRef } from 'react';

/**
 * Shape of the data payload carried by the custom "taxportal:askuser" event.
 *
 * @property question  - The question the agent is asking the taxpayer.
 * @property answer    - The taxpayer's reply. Empty string ("") during Phase 1,
 *                       filled in during Phase 2.
 * @property timestamp - Unix timestamp of when the event was generated.
 */
interface AskUserEvent {
  question: string;
  answer: string;
  timestamp: number;
}

/**
 * Internal representation of a single chat message shown in the popup.
 *
 * @property question - The agent's question text.
 * @property answer   - The taxpayer's answer (empty while still "typing").
 * @property phase    - "typing" while waiting for the answer, "complete" once
 *                      the answer has been received.
 * @property id       - A unique numeric id to help React track the message.
 */
interface ChatMessage {
  question: string;
  answer: string;
  phase: 'typing' | 'complete';
  id: number;
}

/**
 * Module-level counter used to assign unique IDs to each ChatMessage.
 * It lives outside the component so it persists across re-renders without
 * needing React state.
 */
let idCounter = 0;

/**
 * AskUserPopup -- renders a floating chat popup in the top-right corner that
 * shows agent-to-taxpayer Q&A interactions in real time.
 *
 * The component listens for browser CustomEvents (fired from the SSE stream
 * handler) and manages its own visibility. It auto-dismisses a few seconds
 * after the typewriter animation finishes.
 *
 * @returns The popup JSX when a message is active, or null when hidden.
 */
export default function AskUserPopup() {
  // The list of chat messages currently being displayed (usually just one)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Controls whether the popup is shown at all
  const [visible, setVisible] = useState(false);
  // The portion of the answer string revealed so far by the typewriter effect
  const [displayedAnswer, setDisplayedAnswer] = useState('');

  // Refs for timers so we can cancel them on cleanup or when a new event arrives.
  // We use refs instead of state because changing a timer should NOT trigger re-renders.
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    /**
     * Event handler for "taxportal:askuser" custom events.
     * Decides whether we are in Phase 1 (typing) or Phase 2 (answer ready)
     * based on whether `detail.answer` is empty or not.
     */
    const handler = (e: Event) => {
      // Cast the generic Event to a CustomEvent to access `.detail`
      const detail = (e as CustomEvent<AskUserEvent>).detail;

      if (!detail.answer) {
        // ---- Phase 1: question received, answer not yet available ----
        // Show the question bubble with animated typing dots in the answer area.
        const msg: ChatMessage = {
          question: detail.question,
          answer: '',
          phase: 'typing',
          id: ++idCounter,
        };
        setMessages([msg]);
        setDisplayedAnswer('');
        setVisible(true);
        // Cancel any pending auto-dismiss from a previous message
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
      } else {
        // ---- Phase 2: answer received, start typewriter reveal ----
        // Clear any previous typewriter interval that might still be running
        if (typeTimer.current) clearInterval(typeTimer.current);

        // Update the message's phase from "typing" to "complete"
        setMessages(prev =>
          prev.map(m =>
            m.phase === 'typing' ? { ...m, answer: detail.answer, phase: 'complete' } : m,
          ),
        );

        // Typewriter effect: reveal one character every 18ms
        let i = 0;
        const text = detail.answer;
        setDisplayedAnswer('');
        typeTimer.current = setInterval(() => {
          i++;
          // Show characters from the start up to index i
          setDisplayedAnswer(text.slice(0, i));
          if (i >= text.length) {
            // All characters revealed -- stop the interval
            clearInterval(typeTimer.current!);
            typeTimer.current = null;
            // Auto-dismiss the popup 4 seconds after the answer is fully shown
            dismissTimer.current = setTimeout(() => {
              setVisible(false);
              setMessages([]);
            }, 4000);
          }
        }, 18);
      }
    };

    // Register the event listener on the global window object
    window.addEventListener('taxportal:askuser', handler);

    // Cleanup: remove listener and cancel any running timers when the
    // component unmounts (prevents memory leaks and stale state updates).
    return () => {
      window.removeEventListener('taxportal:askuser', handler);
      if (typeTimer.current) clearInterval(typeTimer.current);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []); // Empty dependency array = runs once on mount

  // Don't render anything if there is no active message or the popup was dismissed
  if (!visible || messages.length === 0) return null;

  // We always show the most recent message (the last one in the array)
  const msg = messages[messages.length - 1];

  return (
    /* Outer container -- positioned fixed in the top-right corner,
       above everything else (z-index 999). */
    <div className="fixed top-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]" style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 999,
      width: '20rem',
      maxWidth: 'calc(100vw - 2rem)',
    }}>
      {/* Card wrapper with frosted-glass backdrop and slide-in animation */}
      <div style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        animation: 'askuser-slide-in 0.3s ease-out',
      }}>
        {/* ----- Header bar (blue gradient) ----- */}
        <div style={{
          background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {/* Robot avatar */}
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
          }}>🤖</div>
          <span style={{ color: '#fff', fontSize: '0.8125rem', fontWeight: 600 }}>
            Agent Question
          </span>
          {/* Close button -- lets the user manually dismiss the popup early */}
          <button
            onClick={() => { setVisible(false); setMessages([]); }}
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* ----- Chat content area ----- */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Question bubble -- styled like a chat message from the agent.
              The asymmetric border-radius (small bottom-left corner) makes
              it look like a speech bubble pointing to the left. */}
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '10px 10px 10px 2px',
            padding: '10px 14px',
          }}>
            <div style={{ fontSize: '0.6875rem', color: '#3b82f6', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Question
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#1e3a8a', lineHeight: 1.5 }}>
              {msg.question}
            </div>
          </div>

          {/* Answer bubble -- styled like a reply from the taxpayer.
              The asymmetric border-radius (small bottom-right corner) makes
              it look like a speech bubble pointing to the right. */}
          <div style={{
            background: msg.phase === 'typing' ? '#f0fdf4' : '#f0fdf4',
            border: `1px solid ${msg.phase === 'typing' ? '#bbf7d0' : '#86efac'}`,
            borderRadius: '10px 10px 2px 10px',
            padding: '10px 14px',
            minHeight: '48px',
          }}>
            <div style={{ fontSize: '0.6875rem', color: '#16a34a', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Taxpayer
            </div>
            {msg.phase === 'typing' ? (
              /* Phase 1: Three animated dots that bounce in sequence to
                 indicate the taxpayer is "typing" a response.
                 Each dot gets a staggered animation-delay (0s, 0.2s, 0.4s). */
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '20px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#16a34a',
                    animation: `typing-dot 1.2s ${i * 0.2}s infinite ease-in-out`,
                  }} />
                ))}
              </div>
            ) : (
              /* Phase 2: The answer text revealed character-by-character,
                 with a blinking cursor ("|") at the end for realism. */
              <div style={{ fontSize: '0.8125rem', color: '#166534', lineHeight: 1.5 }}>
                {displayedAnswer}
                <span style={{ animation: 'cursor-blink 0.7s infinite', marginLeft: '1px' }}>|</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ----- CSS keyframe animations ----- */}
      {/* askuser-slide-in: the popup slides in from the right on appearance.
          typing-dot:       each dot scales up and down in a staggered loop.
          cursor-blink:     the text cursor blinks on and off. */}
      <style>{`
        @keyframes askuser-slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes typing-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
