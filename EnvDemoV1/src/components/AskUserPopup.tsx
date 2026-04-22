/**
 * AskUserPopup — floating chat widget that appears when the tax agent
 * asks the simulated taxpayer (NPC) a question.
 *
 * Two-phase flow:
 *   Phase 1: notifyAskUser(question, "")    → shows question + "typing..." dots
 *   Phase 2: notifyAskUser(question, answer) → replaces typing with typewriter answer
 *
 * Listens for `taxportal:askuser` window events dispatched by
 * `window.TaxPortal.notifyAskUser(question, answer)` in index.html.
 *
 * Shows up to 3 exchanges. Each auto-dismisses after 25 seconds.
 */

import { useEffect, useState, useRef, useCallback } from 'react';

interface AskUserEntry {
  id: number;
  question: string;
  answer: string;
  timestamp: number;
  dismissAt: number;
}

const AUTO_DISMISS_MS = 25_000;
const MAX_VISIBLE = 3;
const TYPING_DELAY_MS = 800;
const CHAR_INTERVAL_MS = 28;

/* ── Typewriter sub-component ────────────────────────────── */

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState<'waiting' | 'typing' | 'done'>('waiting');
  const idxRef = useRef(0);

  useEffect(() => {
    setPhase('waiting');
    setDisplayed('');
    idxRef.current = 0;
    const timer = setTimeout(() => setPhase('typing'), TYPING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (phase !== 'typing') return;
    idxRef.current = 0;

    const interval = setInterval(() => {
      idxRef.current += 1;
      if (idxRef.current >= text.length) {
        setDisplayed(text);
        setPhase('done');
        clearInterval(interval);
      } else {
        setDisplayed(text.slice(0, idxRef.current));
      }
    }, CHAR_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [phase, text]);

  if (phase === 'waiting') {
    return <span style={styles.typingDots}>typing<AnimatedDots /></span>;
  }

  return (
    <span style={styles.answerText}>
      {displayed}
      {phase === 'typing' && <span style={styles.cursor}>|</span>}
    </span>
  );
}

function AnimatedDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    let count = 0;
    const timer = setInterval(() => {
      count = (count + 1) % 4;
      setDots('.'.repeat(count));
    }, 400);
    return () => clearInterval(timer);
  }, []);
  return <span>{dots}</span>;
}

/* ── Waiting-for-answer indicator ────────────────────────── */

function WaitingIndicator() {
  return (
    <div style={styles.answerRow}>
      <div style={{ ...styles.answerBubble, ...styles.waitingBubble }}>
        <span style={styles.roleLabel}>🧑 Taxpayer:</span>
        <span style={styles.typingDots}>typing<AnimatedDots /></span>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */

export default function AskUserPopup() {
  const [entries, setEntries] = useState<AskUserEntry[]>([]);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Inject keyframes CSS once
  useEffect(() => {
    if (styleRef.current) return;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes askuser-slideIn {
        from { opacity: 0; transform: translateX(40px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes askuser-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
      @keyframes askuser-pulse {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    styleRef.current = style;
  }, []);

  const handleAskUser = useCallback((e: Event) => {
    const detail = (e as CustomEvent<{ question: string; answer: string; timestamp: number }>).detail;
    const now = Date.now();

    setEntries(prev => {
      // Check if we already have an entry with this question (phase-2 update)
      const existingIdx = prev.findIndex(
        entry => entry.question === detail.question && !entry.answer
      );

      if (existingIdx !== -1 && detail.answer) {
        // Phase 2: update existing entry with the answer
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          answer: detail.answer,
          dismissAt: now + AUTO_DISMISS_MS,
        };
        return updated;
      }

      // Phase 1 (or standalone): add new entry
      const newEntry: AskUserEntry = {
        id: now,
        question: detail.question,
        answer: detail.answer || '',
        timestamp: detail.timestamp || now,
        dismissAt: now + AUTO_DISMISS_MS,
      };
      return [newEntry, ...prev].slice(0, MAX_VISIBLE);
    });
  }, []);

  useEffect(() => {
    window.addEventListener('taxportal:askuser', handleAskUser);
    return () => window.removeEventListener('taxportal:askuser', handleAskUser);
  }, [handleAskUser]);

  // Auto-dismiss
  useEffect(() => {
    if (entries.length === 0) return;
    const nearest = Math.min(...entries.map(e => e.dismissAt));
    const delay = nearest - Date.now();
    if (delay <= 0) {
      setEntries(prev => prev.filter(e => e.dismissAt > Date.now()));
      return;
    }
    const timer = setTimeout(() => {
      setEntries(prev => prev.filter(e => e.dismissAt > Date.now()));
    }, delay);
    return () => clearTimeout(timer);
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>💬</span>
        <span style={styles.headerTitle}>Agent ↔ Taxpayer</span>
        <span style={styles.liveIndicator}>● LIVE</span>
      </div>
      {entries.map(entry => (
        <div key={entry.id} style={styles.exchangeBlock}>
          {/* Question bubble */}
          <div style={styles.questionRow}>
            <div style={styles.questionBubble}>
              <span style={styles.roleLabel}>🤖 Tax Agent:</span>
              <span style={styles.questionText}>{entry.question}</span>
            </div>
          </div>
          {/* Answer: typing indicator or typewriter */}
          {entry.answer ? (
            <div style={styles.answerRow}>
              <div style={styles.answerBubble}>
                <span style={styles.roleLabel}>🧑 Taxpayer:</span>
                <TypewriterText text={entry.answer} />
              </div>
            </div>
          ) : (
            <WaitingIndicator />
          )}
          <button
            style={styles.dismissBtn}
            onClick={() => setEntries(prev => prev.filter(e => e.id !== entry.id))}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '16px',
    right: '16px',
    width: '400px',
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    pointerEvents: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
    borderRadius: '10px 10px 0 0',
    color: '#e2e8f0',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  headerIcon: { fontSize: '16px' },
  headerTitle: { flex: 1 },
  liveIndicator: {
    color: '#4ade80',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    animation: 'askuser-pulse 2s ease-in-out infinite',
  },
  exchangeBlock: {
    position: 'relative',
    background: 'rgba(255, 255, 255, 0.98)',
    borderRadius: '10px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
    padding: '14px 14px 12px 14px',
    border: '1px solid rgba(0,0,0,0.06)',
    animation: 'askuser-slideIn 0.3s ease-out',
  },
  questionRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: '10px',
  },
  questionBubble: {
    background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
    border: '1px solid #93c5fd',
    borderRadius: '14px 14px 14px 2px',
    padding: '10px 14px',
    maxWidth: '92%',
    fontSize: '13px',
    color: '#1e3a5f',
    lineHeight: 1.5,
  },
  answerRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  answerBubble: {
    background: 'linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)',
    border: '1px solid #86efac',
    borderRadius: '14px 14px 2px 14px',
    padding: '10px 14px',
    maxWidth: '92%',
    fontSize: '13px',
    color: '#14532d',
    lineHeight: 1.5,
    minHeight: '36px',
  },
  waitingBubble: {
    background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
    border: '1px solid #d1d5db',
  },
  roleLabel: {
    fontWeight: 700,
    display: 'block',
    fontSize: '11px',
    opacity: 0.75,
    marginBottom: '3px',
  },
  questionText: { display: 'block' },
  answerText: { display: 'inline' },
  typingDots: {
    display: 'inline',
    color: '#6b7280',
    fontStyle: 'italic',
    fontSize: '13px',
  },
  cursor: {
    display: 'inline',
    animation: 'askuser-blink 0.7s step-end infinite',
    color: '#16a34a',
    fontWeight: 700,
    marginLeft: '1px',
  },
  dismissBtn: {
    position: 'absolute',
    top: '6px',
    right: '8px',
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 6px',
    lineHeight: 1,
    borderRadius: '4px',
  },
};
