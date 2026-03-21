import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useForm } from '../context/FormContext';

const STATUS_CONFIG = {
  idle: { label: 'Idle', bg: '#64748b', dot: '#94a3b8' },
  running: { label: 'Running', bg: '#1e40af', dot: '#60a5fa' },
  done: { label: 'Complete', bg: '#15803d', dot: '#4ade80' },
  error: { label: 'Error', bg: '#b91c1c', dot: '#f87171' },
};

function Spinner() {
  return (
    <div style={{
      width: '16px',
      height: '16px',
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

function saveAndGoHome(persona: string, displayName: string, scorePct: number | null, formData: Record<string, unknown>) {
  // Save to completed list in localStorage
  try {
    const existing = JSON.parse(localStorage.getItem('completedPersonas') || '[]');
    const filtered = existing.filter((c: { persona: string }) => c.persona !== persona);
    filtered.push({
      persona,
      displayName,
      score: scorePct != null ? Math.round(scorePct * 10) / 10 : null,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      formData,
    });
    localStorage.setItem('completedPersonas', JSON.stringify(filtered));
  } catch { /* ignore */ }

  // Download JSON
  const blob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zh-tax-filing-${persona}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AgentStatusBar() {
  const { agentStatus, persona, fieldsFilledCount, errorMessage, scorePercent, resetSession } = useSession();
  const { data } = useForm();
  const navigate = useNavigate();

  if (agentStatus === 'idle') return null;

  const cfg = STATUS_CONFIG[agentStatus];
  const displayName = persona
    ? persona.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : '';

  const handleReturnHome = () => {
    if (persona) {
      saveAndGoHome(persona, displayName, scorePercent, data as unknown as Record<string, unknown>);
    }
    resetSession();
    navigate('/dashboard');
  };

  return (
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
      {/* Avatar */}
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

      {/* Persona name */}
      <div>
        <div style={{ fontSize: '0.75rem', opacity: 0.7, lineHeight: 1 }}>Persona</div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.4 }}>{displayName}</div>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.2)' }} />

      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: cfg.dot,
          animation: agentStatus === 'running' ? 'pulse-dot 1.5s infinite' : 'none',
        }} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{cfg.label}</span>
      </div>

      {agentStatus === 'running' && (
        <>
          {/* Divider */}
          <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.2)' }} />

          {/* Fields filled */}
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

          {/* Spinner */}
          <div style={{ marginLeft: 'auto' }}>
            <Spinner />
          </div>
        </>
      )}

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

      {agentStatus === 'error' && errorMessage && (
        <span style={{ fontSize: '0.8125rem', opacity: 0.9, marginLeft: '8px' }}>
          {errorMessage.length > 120 ? errorMessage.slice(0, 120) + '…' : errorMessage}
        </span>
      )}

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
