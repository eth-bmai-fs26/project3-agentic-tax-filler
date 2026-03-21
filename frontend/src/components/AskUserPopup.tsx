/**
 * AskUserPopup — shows NPC chat exchanges driven by SSE ask_user events.
 * Two-phase: Phase 1 shows typing indicator (answer=""), Phase 2 shows full answer.
 * Auto-dismisses after a few seconds following Phase 2.
 */

import { useEffect, useState, useRef } from 'react';

interface AskUserEvent {
  question: string;
  answer: string;
  timestamp: number;
}

interface ChatMessage {
  question: string;
  answer: string;
  phase: 'typing' | 'complete';
  id: number;
}

let idCounter = 0;

export default function AskUserPopup() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [visible, setVisible] = useState(false);
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AskUserEvent>).detail;

      if (!detail.answer) {
        // Phase 1: show typing indicator
        const msg: ChatMessage = {
          question: detail.question,
          answer: '',
          phase: 'typing',
          id: ++idCounter,
        };
        setMessages([msg]);
        setDisplayedAnswer('');
        setVisible(true);
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
      } else {
        // Phase 2: typewriter animation for the answer
        if (typeTimer.current) clearInterval(typeTimer.current);
        setMessages(prev =>
          prev.map(m =>
            m.phase === 'typing' ? { ...m, answer: detail.answer, phase: 'complete' } : m,
          ),
        );

        let i = 0;
        const text = detail.answer;
        setDisplayedAnswer('');
        typeTimer.current = setInterval(() => {
          i++;
          setDisplayedAnswer(text.slice(0, i));
          if (i >= text.length) {
            clearInterval(typeTimer.current!);
            typeTimer.current = null;
            // Auto-dismiss after 4 seconds
            dismissTimer.current = setTimeout(() => {
              setVisible(false);
              setMessages([]);
            }, 4000);
          }
        }, 18);
      }
    };

    window.addEventListener('taxportal:askuser', handler);
    return () => {
      window.removeEventListener('taxportal:askuser', handler);
      if (typeTimer.current) clearInterval(typeTimer.current);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  if (!visible || messages.length === 0) return null;

  const msg = messages[messages.length - 1];

  return (
    <div className="fixed top-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]" style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 999,
      width: '20rem',
      maxWidth: 'calc(100vw - 2rem)',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        animation: 'askuser-slide-in 0.3s ease-out',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
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

        {/* Content */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Question bubble */}
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

          {/* Answer bubble */}
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
              <div style={{ fontSize: '0.8125rem', color: '#166534', lineHeight: 1.5 }}>
                {displayedAnswer}
                <span style={{ animation: 'cursor-blink 0.7s infinite', marginLeft: '1px' }}>|</span>
              </div>
            )}
          </div>
        </div>
      </div>

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
