import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPersonas, type PersonaInfo } from '../api/client';
import { useSession } from '../context/SessionContext';

const ACCENT_COLORS: Record<string, string> = {
  emerald: 'linear-gradient(135deg, #059669, #10b981)',
  rose: 'linear-gradient(135deg, #e11d48, #f43f5e)',
  amber: 'linear-gradient(135deg, #d97706, #f59e0b)',
  sky: 'linear-gradient(135deg, #0284c7, #38bdf8)',
  violet: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
  slate: 'linear-gradient(135deg, #475569, #94a3b8)',
};

interface CompletedPersona {
  persona: string;
  displayName: string;
  score: number | null;
  date: string;
  formData?: Record<string, unknown>;
}

function getCompleted(): CompletedPersona[] {
  try {
    return JSON.parse(localStorage.getItem('completedPersonas') || '[]');
  } catch { return []; }
}

function PersonaRow({ persona, loading, onClick }: {
  persona: PersonaInfo;
  loading: boolean;
  onClick: () => void;
}) {
  const accent = ACCENT_COLORS[persona.color] ?? ACCENT_COLORS.slate;
  const initials = persona.display_name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        width: '100%',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '0',
        cursor: loading ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s, transform 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        opacity: loading ? 0.7 : 1,
      }}
      onMouseEnter={e => {
        if (!loading) {
          (e.currentTarget).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
          (e.currentTarget).style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
        (e.currentTarget).style.transform = 'translateY(0)';
      }}
    >
      {/* Accent bar */}
      <div style={{ width: '5px', alignSelf: 'stretch', background: accent, flexShrink: 0, borderRadius: '12px 0 0 12px' }} />

      {/* Avatar */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '0.875rem',
        fontWeight: 700,
        flexShrink: 0,
        marginLeft: '12px',
      }}>
        {initials}
      </div>

      {/* Name + description */}
      <div style={{ flex: 1, minWidth: 0, padding: '14px 0' }}>
        <div style={{
          fontSize: '0.9375rem',
          fontWeight: 600,
          color: '#0f172a',
          letterSpacing: '-0.01em',
          lineHeight: 1.3,
        }}>
          {persona.display_name}
        </div>
        <div style={{
          fontSize: '0.8125rem',
          color: '#64748b',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {persona.description}
        </div>
      </div>

      {/* Doc count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.75rem',
        color: '#94a3b8',
        flexShrink: 0,
      }}>
        <span>📄</span>
        <span>{persona.documents.length} docs</span>
      </div>

      {/* Action */}
      <div style={{
        fontSize: '0.8125rem',
        color: '#1e40af',
        fontWeight: 600,
        paddingRight: '20px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        {loading ? (
          <>
            <div style={{
              width: '14px', height: '14px',
              border: '2px solid #e2e8f0', borderTopColor: '#1e40af',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            Starting…
          </>
        ) : 'Start →'}
      </div>
    </button>
  );
}

function CompletedRow({ item }: { item: CompletedPersona }) {
  const handleDownload = () => {
    if (!item.formData) return;
    const blob = new Blob([JSON.stringify(item.formData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zh-tax-filing-${item.persona}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scoreColor = (item.score ?? 0) >= 80 ? '#16a34a' : (item.score ?? 0) >= 50 ? '#d97706' : '#dc2626';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      width: '100%',
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '14px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0f172a' }}>
          {item.displayName}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Completed {item.date}
        </div>
      </div>

      {/* Score */}
      {item.score != null && (
        <div style={{
          fontSize: '0.875rem',
          fontWeight: 700,
          color: scoreColor,
          background: `${scoreColor}12`,
          padding: '4px 12px',
          borderRadius: '8px',
          flexShrink: 0,
        }}>
          {item.score}%
        </div>
      )}

      {/* Download */}
      {item.formData && (
        <button
          onClick={handleDownload}
          style={{
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '6px 14px',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: '#475569',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Download
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [personas, setPersonas] = useState<PersonaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedPersona[]>(getCompleted);
  const { startSession } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    listPersonas()
      .then(setPersonas)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
    setCompleted(getCompleted());
  }, []);

  const completedNames = new Set(completed.map(c => c.persona));
  const pending = personas.filter(p => !completedNames.has(p.name));

  const handleSelect = async (persona: PersonaInfo) => {
    setStarting(persona.name);
    try {
      await startSession(persona.name);
      navigate('/personal');
    } catch (e) {
      setError(String(e));
      setStarting(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1e40af 100%)',
        padding: '48px 40px 64px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background decoration */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.06,
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{
              color: '#fff',
              fontSize: '2.25rem',
              fontWeight: 800,
              margin: '0 0 8px',
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
            }}>
              AgenTekki
            </h1>
            <p style={{
              color: '#93c5fd',
              fontSize: '1rem',
              margin: 0,
              lineHeight: 1.6,
            }}>
              Agentic Swiss Tax Filler — Zurich Canton
            </p>
          </div>
          <button
            onClick={() => navigate('/create-persona')}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={e => (e.currentTarget).style.background = 'rgba(255,255,255,0.25)'}
            onMouseLeave={e => (e.currentTarget).style.background = 'rgba(255,255,255,0.15)'}
          >
            + Create Persona
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        paddingTop: '32px',
        padding: '0 32px 60px',
        position: 'relative',
        zIndex: 1,
      }}>
        {loading && (
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            padding: '48px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '0.9375rem',
          }}>
            <div style={{
              width: '32px', height: '32px',
              border: '3px solid #e2e8f0', borderTopColor: '#1e40af',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            Loading personas…
          </div>
        )}

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '20px 24px',
            color: '#dc2626',
            fontSize: '0.875rem',
            marginBottom: '24px',
          }}>
            <strong>Could not connect to backend:</strong> {error}
            <div style={{ marginTop: '8px', color: '#64748b', fontSize: '0.8125rem' }}>
              Make sure Flask is running: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>python -m backend.app</code>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Pending Tax Forms */}
            <div style={{ marginBottom: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <h2 style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}>
                  Pending Tax Forms
                </h2>
                <span style={{
                  background: '#e2e8f0',
                  color: '#475569',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}>
                  {pending.length}
                </span>
              </div>

              {pending.length === 0 ? (
                <div style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '32px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.875rem',
                }}>
                  All personas completed! Create a new persona to continue.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pending.map(p => (
                    <PersonaRow
                      key={p.name}
                      persona={p}
                      loading={starting === p.name}
                      onClick={() => handleSelect(p)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Completed Tax Forms */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <h2 style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}>
                  Completed Tax Forms
                </h2>
                <span style={{
                  background: '#dcfce7',
                  color: '#16a34a',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}>
                  {completed.length}
                </span>
              </div>
              {completed.length === 0 ? (
                <div style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '32px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.875rem',
                }}>
                  No completed tax forms yet. Start filling a persona to see results here.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {completed.map(c => (
                    <CompletedRow key={c.persona} item={c} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
