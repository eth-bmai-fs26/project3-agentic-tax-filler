import zurichLogo from '../assets/ZurichLogo-white.png';
import { useSession } from '../context/SessionContext';

export default function Header() {
  const { persona, agentStatus } = useSession();

  const displayName = persona
    ? persona.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null;

  const statusDot = agentStatus === 'running'
    ? { color: '#60a5fa', label: 'Running', pulse: true }
    : agentStatus === 'done'
    ? { color: '#4ade80', label: 'Done', pulse: false }
    : agentStatus === 'error'
    ? { color: '#f87171', label: 'Error', pulse: false }
    : null;

  return (
    <header className="app-header">
      <div className="app-header-left">
        <img className="app-header-logo" src={zurichLogo} alt="Canton of Zurich" />
        <div>
          <span className="app-header-title">
            <strong>AgenTekki</strong>
            <span style={{ opacity: 0.6, margin: '0 8px' }}>·</span>
            <span style={{ opacity: 0.85, fontWeight: 400 }}>Agentic Tax Filler — Zurich 2025</span>
          </span>
        </div>
      </div>

      <div className="app-header-right">
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
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: statusDot.color,
              flexShrink: 0,
              animation: statusDot.pulse ? 'header-pulse 1.5s infinite' : 'none',
            }} />
            <span style={{ color: '#fff', fontSize: '0.8125rem', fontWeight: 500 }}>
              {displayName}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
              {statusDot.label}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes header-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </header>
  );
}
