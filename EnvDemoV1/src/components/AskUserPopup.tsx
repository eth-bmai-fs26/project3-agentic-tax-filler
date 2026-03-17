/**
 * AskUserPopup — floating chat notification that appears when the tax agent
 * asks the simulated taxpayer (NPC) a question.
 *
 * Listens for the custom `taxportal:askuser` window event emitted by
 * `window.TaxPortal.notifyAskUser(question, answer)` in index.html.
 *
 * Shows the last 3 exchanges as chat bubbles (blue = question, green = answer).
 * Each entry auto-dismisses after 10 seconds.
 */

import { useEffect, useState } from 'react';

interface AskUserEntry {
  id: number;
  question: string;
  answer: string;
  timestamp: number;
  dismissAt: number;
}

const AUTO_DISMISS_MS = 10_000;
const MAX_VISIBLE = 3;

export default function AskUserPopup() {
  const [entries, setEntries] = useState<AskUserEntry[]>([]);

  useEffect(() => {
    function handleAskUser(e: Event) {
      const detail = (e as CustomEvent<{ question: string; answer: string; timestamp: number }>).detail;
      const now = Date.now();
      const newEntry: AskUserEntry = {
        id: now,
        question: detail.question,
        answer: detail.answer,
        timestamp: detail.timestamp || now,
        dismissAt: now + AUTO_DISMISS_MS,
      };
      setEntries(prev => {
        const next = [newEntry, ...prev];
        // Keep only the last MAX_VISIBLE entries
        return next.slice(0, MAX_VISIBLE);
      });
    }

    window.addEventListener('taxportal:askuser', handleAskUser);
    return () => window.removeEventListener('taxportal:askuser', handleAskUser);
  }, []);

  // Auto-dismiss entries after their dismissAt time
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
        <span style={styles.headerIcon}>🤖</span>
        <span style={styles.headerTitle}>Agent asks taxpayer</span>
      </div>
      {entries.map(entry => (
        <div key={entry.id} style={styles.exchangeBlock}>
          {/* Question bubble — blue */}
          <div style={styles.questionRow}>
            <div style={styles.questionBubble}>
              <span style={styles.roleLabel}>Tax Agent:</span>
              <span style={styles.questionText}>{entry.question}</span>
            </div>
          </div>
          {/* Answer bubble — green */}
          <div style={styles.answerRow}>
            <div style={styles.answerBubble}>
              <span style={styles.roleLabel}>Taxpayer:</span>
              <span style={styles.answerText}>{entry.answer}</span>
            </div>
          </div>
          {/* Dismiss button */}
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
    top: '24px',
    right: '24px',
    width: '380px',
    maxWidth: 'calc(100vw - 48px)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    background: 'rgba(30, 41, 59, 0.9)',
    borderRadius: '8px 8px 0 0',
    color: '#e2e8f0',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  headerIcon: {
    fontSize: '14px',
  },
  headerTitle: {
    flex: 1,
  },
  exchangeBlock: {
    position: 'relative',
    background: 'rgba(255, 255, 255, 0.97)',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    padding: '12px 12px 10px 12px',
    border: '1px solid rgba(0,0,0,0.08)',
    animation: 'slideIn 0.2s ease-out',
  },
  questionRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: '8px',
  },
  questionBubble: {
    background: '#dbeafe',
    border: '1px solid #93c5fd',
    borderRadius: '12px 12px 12px 2px',
    padding: '8px 12px',
    maxWidth: '90%',
    fontSize: '13px',
    color: '#1e3a5f',
    lineHeight: 1.4,
  },
  answerRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  answerBubble: {
    background: '#dcfce7',
    border: '1px solid #86efac',
    borderRadius: '12px 12px 2px 12px',
    padding: '8px 12px',
    maxWidth: '90%',
    fontSize: '13px',
    color: '#14532d',
    lineHeight: 1.4,
  },
  roleLabel: {
    fontWeight: 700,
    marginRight: '6px',
    display: 'block',
    fontSize: '11px',
    opacity: 0.7,
    marginBottom: '2px',
  },
  questionText: {
    display: 'block',
  },
  answerText: {
    display: 'block',
  },
  dismissBtn: {
    position: 'absolute',
    top: '6px',
    right: '8px',
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 4px',
    lineHeight: 1,
    borderRadius: '4px',
  },
};
