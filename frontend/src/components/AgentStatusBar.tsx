/**
 * @file AgentStatusBar.tsx
 *
 * A fixed bottom status bar that appears whenever the AI agent is active
 * (running, completed, or errored). It gives the user a persistent, at-a-glance
 * view of what the agent is doing:
 *
 *  - While RUNNING:  shows a spinner, the persona name, and a live "fields filled" counter.
 *  - When DONE:      shows a "Download & Return Home" button so the user can save
 *                    the completed form as JSON and go back to the dashboard.
 *  - On ERROR:       shows a truncated error message next to the status badge.
 *
 * The bar uses a slide-up animation when it first appears and colour-codes
 * itself based on the agent status (blue for running, green for done, red for error).
 */

import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useForm } from '../context/FormContext';

/**
 * STATUS_CONFIG maps each possible agent status to visual settings.
 *
 * - label: text shown next to the status dot (e.g. "Running").
 * - bg:    background colour for the entire status bar.
 * - dot:   colour of the small circular status indicator.
 *
 * These colours follow a traffic-light convention: blue = active,
 * green = success, red = failure, grey = idle.
 */
const STATUS_CONFIG = {
  idle: { label: 'Idle', bg: '#64748b', dot: '#94a3b8' },
  running: { label: 'Running', bg: '#1e40af', dot: '#60a5fa' },
  done: { label: 'Complete', bg: '#15803d', dot: '#4ade80' },
  error: { label: 'Error', bg: '#b91c1c', dot: '#f87171' },
};

/**
 * Spinner -- a tiny CSS-only loading spinner (rotating circle).
 * Displayed inside the status bar while the agent is running to provide
 * visual feedback that work is in progress.
 *
 * @returns A small spinning circle element.
 */
function Spinner() {
  return (
    <div style={{
      width: '16px',
      height: '16px',
      /* The trick: a circle with a semi-transparent border on 3 sides
         and a white border on top, then rotated via CSS animation. */
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

/**
 * Saves the completed persona result to localStorage and triggers a
 * JSON file download so the user has a local copy of the filled-in form.
 *
 * Why localStorage? It allows the Dashboard page to show which personas
 * have already been completed and what scores they received, even after
 * a page refresh.
 *
 * @param persona     - Internal persona key (e.g. "john_doe").
 * @param displayName - Human-readable persona name (e.g. "John Doe").
 * @param scorePct    - The agent's accuracy score (0-100), or null if unavailable.
 * @param formData    - The complete form data object to persist and download.
 */
function saveAndGoHome(persona: string, displayName: string, scorePct: number | null, formData: Record<string, unknown>) {
  // ---------- 1. Persist to localStorage ----------
  try {
    // Read any previously completed personas from storage
    const existing = JSON.parse(localStorage.getItem('completedPersonas') || '[]');
    // Remove the current persona if it was already saved (handles re-runs)
    const filtered = existing.filter((c: { persona: string }) => c.persona !== persona);
    // Append the new result with a rounded score and today's date
    filtered.push({
      persona,
      displayName,
      score: scorePct != null ? Math.round(scorePct * 10) / 10 : null,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      formData,
    });
    localStorage.setItem('completedPersonas', JSON.stringify(filtered));
  } catch { /* ignore -- localStorage might be full or disabled */ }

  // ---------- 2. Download the form data as a JSON file ----------
  // Create a Blob (binary large object) containing the pretty-printed JSON
  const blob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
  // Create a temporary object URL pointing to the blob
  const url = URL.createObjectURL(blob);
  // Programmatically create an <a> element, set it to download, and click it
  const a = document.createElement('a');
  a.href = url;
  a.download = `zh-tax-filing-${persona}.json`;
  a.click();
  // Free the memory used by the object URL since the download has started
  URL.revokeObjectURL(url);
}

/**
 * AgentStatusBar -- the fixed bar that sticks to the bottom of the viewport
 * and reports real-time agent progress.
 *
 * Visibility rule: the bar is completely hidden when the agent is idle
 * (i.e., no persona has been started yet). It becomes visible as soon as
 * the agent starts running and stays visible through completion or error.
 *
 * @returns A fixed-position bar element, or null when idle.
 */
export default function AgentStatusBar() {
  // Pull session-level state from SessionContext
  const { agentStatus, persona, fieldsFilledCount, errorMessage, scorePercent, resetSession } = useSession();
  // Pull the full form data so we can download it when the agent is done
  const { data } = useForm();
  const navigate = useNavigate();

  // If the agent hasn't started, render nothing at all
  if (agentStatus === 'idle') return null;

  // Look up the colour scheme for the current status
  const cfg = STATUS_CONFIG[agentStatus];

  // Convert the internal persona key (e.g. "john_doe") into a display-friendly
  // name (e.g. "John Doe") by replacing underscores and capitalising each word.
  const displayName = persona
    ? persona.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : '';

  /**
   * Called when the user clicks "Download & Return Home".
   * Saves the result to localStorage, triggers a JSON download, resets the
   * session state, and navigates back to the dashboard.
   */
  const handleReturnHome = () => {
    if (persona) {
      saveAndGoHome(persona, displayName, scorePercent, data as unknown as Record<string, unknown>);
    }
    resetSession();
    navigate('/dashboard');
  };

  return (
    /* The bar is fixed to the bottom of the viewport and sits above all
       other content (z-index 100). It slides up into view via animation. */
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: cfg.bg,
      color: '#fff',
      padding: '10px 28px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
      animation: 'statusbar-slide-up 0.3s ease-out',
    }}>
      {/* ----- Robot avatar icon ----- */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        flexShrink: 0,
      }}>
        🤖
      </div>

      {/* ----- Persona name block ----- */}
      <div>
        <div style={{ fontSize: '0.75rem', opacity: 0.7, lineHeight: 1 }}>Persona</div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.4 }}>{displayName}</div>
      </div>

      {/* Vertical divider line between sections */}
      <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.2)' }} />

      {/* ----- Status badge with coloured dot ----- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* The dot pulses (grows/shrinks) while the agent is running
            to draw attention, and stays static otherwise. */}
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: cfg.dot,
          animation: agentStatus === 'running' ? 'pulse-dot 1.5s infinite' : 'none',
        }} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{cfg.label}</span>
      </div>

      {/* ----- Running-specific UI: field counter + spinner ----- */}
      {agentStatus === 'running' && (
        <>
          {/* Vertical divider */}
          <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.2)' }} />

          {/* Live counter showing how many form fields the agent has filled so far */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Fields filled</span>
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '12px',
              padding: '2px 10px',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}>{fieldsFilledCount}</span>
          </div>

          {/* Spinner pushed to the far right via marginLeft: auto */}
          <div style={{ marginLeft: 'auto' }}>
            <Spinner />
          </div>
        </>
      )}

      {/* ----- Done-specific UI: download button ----- */}
      {agentStatus === 'done' && (
        <button
          onClick={handleReturnHome}
          style={{
            marginLeft: 'auto',
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            padding: '6px 18px',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Download & Return Home
        </button>
      )}

      {/* ----- Error-specific UI: truncated error message ----- */}
      {/* Show at most 120 characters of the error to keep the bar readable */}
      {agentStatus === 'error' && errorMessage && (
        <span style={{ fontSize: '0.8125rem', opacity: 0.9, marginLeft: '8px' }}>
          {errorMessage.length > 120 ? errorMessage.slice(0, 120) + '…' : errorMessage}
        </span>
      )}

      {/* ----- CSS keyframe animations (injected inline) ----- */}
      {/* spin:              rotates the Spinner component 360 degrees.
          pulse-dot:         makes the status dot grow/shrink while running.
          statusbar-slide-up: the bar slides up from the bottom when it first appears. */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
        @keyframes statusbar-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
