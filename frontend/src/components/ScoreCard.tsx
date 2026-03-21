import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useForm } from '../context/FormContext';
import { getScore } from '../api/client';

interface ScoreResult {
  score_percent?: number;
  correct?: number;
  wrong?: number;
  missing?: number;
  extra?: number;
  errors?: Array<{ path: string; expected: unknown; got: unknown; cause?: string }>;
}

function CircleGauge({ percent }: { percent: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  const color = percent >= 80 ? '#16a34a' : percent >= 50 ? '#d97706' : '#dc2626';

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
      <circle
        cx="70" cy="70" r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease-out' }}
      />
      <text
        x="70" y="70"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: '70px 70px' }}
        fontSize="22"
        fontWeight="700"
        fill={color}
      >
        {percent}%
      </text>
    </svg>
  );
}

function saveCompleted(persona: string, displayName: string, scorePct: number | null, formData: Record<string, unknown>) {
  try {
    const existing = JSON.parse(localStorage.getItem('completedPersonas') || '[]');
    // Remove if already exists (re-run)
    const filtered = existing.filter((c: { persona: string }) => c.persona !== persona);
    filtered.push({
      persona,
      displayName,
      score: scorePct != null ? Math.round(scorePct * 10) / 10 : null,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      formData,
    });
    localStorage.setItem('completedPersonas', JSON.stringify(filtered));
  } catch {
    // localStorage may be full — ignore
  }
}

function downloadFormJSON(persona: string, formData: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zh-tax-filing-${persona}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ScoreCard() {
  const { agentStatus, sessionId, persona, resetSession } = useSession();
  const { data } = useForm();
  const navigate = useNavigate();
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (agentStatus === 'done' && sessionId) {
      getScore(sessionId)
        .then(data => setScore(data as ScoreResult))
        .catch(() => setScore({ score_percent: 0 }));
      setDismissed(false);
    }
  }, [agentStatus, sessionId]);

  if (agentStatus !== 'done' || !score || dismissed) return null;

  const pct = score.score_percent ?? 0;
  const errors = score.errors ?? [];

  const displayName = persona
    ? persona.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : '';

  const handleFinish = () => {
    // Save to completed list
    if (persona) {
      saveCompleted(persona, displayName, pct, data as unknown as Record<string, unknown>);
      downloadFormJSON(persona, data as unknown as Record<string, unknown>);
    }
    setDismissed(true);
    resetSession();
    navigate('/dashboard');
  };

  const handleViewForm = () => {
    setDismissed(true);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 500,
      background: 'rgba(15,23,42,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        width: '100%',
        maxWidth: '520px',
        overflow: 'hidden',
        animation: 'score-card-in 0.4s ease-out',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{ fontSize: '28px' }}>🏆</div>
          <div>
            <h2 style={{ color: '#fff', fontSize: '1.125rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Agent Complete
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: 0 }}>
              Tax form filled by AI agent
            </p>
          </div>
          <button
            onClick={handleViewForm}
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >✕</button>
        </div>

        {/* Score gauge */}
        <div style={{ padding: '32px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          <CircleGauge percent={Math.round(pct)} />

          {/* Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            width: '100%',
          }}>
            {[
              { label: 'Correct', value: score.correct ?? 0, color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Wrong', value: score.wrong ?? 0, color: '#d97706', bg: '#fffbeb' },
              { label: 'Missing', value: score.missing ?? 0, color: '#dc2626', bg: '#fef2f2' },
              { label: 'Extra', value: score.extra ?? 0, color: '#7c3aed', bg: '#faf5ff' },
            ].map(s => (
              <div key={s.label} style={{
                background: s.bg,
                borderRadius: '12px',
                padding: '14px 8px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Error list toggle */}
          {errors.length > 0 && (
            <div style={{ width: '100%' }}>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  width: '100%',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  color: '#64748b',
                  fontWeight: 500,
                }}
              >
                <span>View {errors.length} error{errors.length !== 1 ? 's' : ''}</span>
                <span>{expanded ? '▲' : '▼'}</span>
              </button>

              {expanded && (
                <div style={{
                  marginTop: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}>
                  {errors.map((err, i) => (
                    <div key={i} style={{
                      padding: '10px 16px',
                      borderBottom: i < errors.length - 1 ? '1px solid #f1f5f9' : 'none',
                      fontSize: '0.75rem',
                    }}>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontFamily: 'monospace' }}>
                        {err.path}
                      </div>
                      <div style={{ color: '#64748b', marginTop: '2px' }}>
                        Expected: <span style={{ color: '#16a34a' }}>{String(err.expected)}</span>
                        {' · '}
                        Got: <span style={{ color: '#dc2626' }}>{String(err.got)}</span>
                        {err.cause && <span style={{ marginLeft: '8px', color: '#7c3aed' }}>({err.cause})</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <button
              onClick={handleViewForm}
              style={{
                flex: 1,
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              View Form
            </button>
            <button
              onClick={handleFinish}
              style={{
                flex: 2,
                background: '#1e40af',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Download & Return Home
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes score-card-in {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
