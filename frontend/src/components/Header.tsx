/**
 * @file Header.tsx
 *
 * The top-level header bar that appears at the very top of every page in the
 * application. It contains:
 *   - The Canton of Zurich logo and the app title ("AgenTekki").
 *   - An optional agent-status badge on the right side that shows the
 *     currently active persona name and the agent's status (Running / Done /
 *     Error) with a colour-coded dot.
 *
 * The header uses a dark background (styled via the CSS class "app-header")
 * and the status badge only appears once a persona has been selected and the
 * agent is no longer idle.
 */

import zurichLogo from '../assets/ZurichLogo-white.png';
import { useSession } from '../context/SessionContext';

/**
 * Header -- the persistent top bar with branding and live agent status.
 *
 * @returns A <header> element spanning the full width of the viewport.
 */
export default function Header() {
  const { persona, agentStatus } = useSession();

  // Convert the internal persona key (e.g. "anna_mueller") to a display-friendly
  // name (e.g. "Anna Mueller"). Returns null if no persona is active yet.
  const displayName = persona
    ? persona.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null;

  // Map the current agent status to a coloured dot configuration.
  // - Blue + pulsing = agent is actively running.
  // - Green = agent finished successfully.
  // - Red = agent encountered an error.
  // - null = agent is idle, so no badge is shown.
  const statusDot = agentStatus === 'running'
    ? { color: '#60a5fa', label: 'Running', pulse: true }
    : agentStatus === 'done'
    ? { color: '#4ade80', label: 'Done', pulse: false }
    : agentStatus === 'error'
    ? { color: '#f87171', label: 'Error', pulse: false }
    : null;

  return (
    <header className="app-header">
      {/* ----- Left side: logo + app title ----- */}
      <div className="app-header-left">
        <img className="app-header-logo" src={zurichLogo} alt="Canton of Zurich" />
        <div>
          <span className="app-header-title">
            <strong>AgenTekki</strong>
            {/* Dot separator between the app name and subtitle */}
            <span style={{ opacity: 0.6, margin: '0 8px' }}>·</span>
            <span style={{ opacity: 0.85, fontWeight: 400 }}>Agentic Tax Filler — Zurich 2025</span>
          </span>
        </div>
      </div>

      {/* ----- Right side: agent status badge (only when a persona is active) ----- */}
      <div className="app-header-right">
        {/* The badge only renders when both a persona name and a non-idle
            status are available. */}
        {displayName && statusDot && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            padding: '6px 14px',
          }}>
            {/* Small coloured dot that pulses while the agent is running */}
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: statusDot.color,
              flexShrink: 0,
              animation: statusDot.pulse ? 'header-pulse 1.5s infinite' : 'none',
            }} />
            {/* Persona display name */}
            <span style={{ color: '#fff', fontSize: '0.8125rem', fontWeight: 500 }}>
              {displayName}
            </span>
            {/* Status label text (Running / Done / Error) */}
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
              {statusDot.label}
            </span>
          </div>
        )}
      </div>

      {/* Inline CSS animation for the pulsing status dot */}
      <style>{`
        @keyframes header-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </header>
  );
}
