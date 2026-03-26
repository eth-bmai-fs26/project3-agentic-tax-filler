/**
 * @file Dashboard.tsx
 *
 * This is the main landing page of the AgenTekki tax filing application.
 * It serves as the "home screen" where users can:
 *   1. See a list of available taxpayer personas (pre-configured profiles)
 *      and click one to start filling out a tax return for that persona.
 *   2. See previously completed tax forms along with their accuracy scores,
 *      and download the filled-in form data as a JSON file.
 *   3. Navigate to the "Create Persona" page to define a custom taxpayer.
 *
 * Data flow:
 * - The list of available personas is fetched from the Flask backend via
 *   the `listPersonas()` API call when the component first mounts.
 * - Completed forms are stored in the browser's localStorage so they
 *   persist across page refreshes. Each entry records the persona name,
 *   a display name, the accuracy score, the date, and the raw form data.
 *
 * Navigation:
 * - Clicking a persona row calls `startSession()` (from SessionContext),
 *   which tells the backend to begin a new tax-filling session, then
 *   navigates the user to the first form page ("/personal").
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPersonas, type PersonaInfo } from '../api/client';
import { useSession } from '../context/SessionContext';

/**
 * A lookup table that maps color names to CSS gradient strings.
 * Each persona in the backend has a `color` field (e.g. "emerald", "rose").
 * We use this map to give each persona row a unique accent color in the UI.
 * If the persona's color is not found in this map, we fall back to "slate".
 */
const ACCENT_COLORS: Record<string, string> = {
  emerald: 'linear-gradient(135deg, #059669, #10b981)',
  rose: 'linear-gradient(135deg, #e11d48, #f43f5e)',
  amber: 'linear-gradient(135deg, #d97706, #f59e0b)',
  sky: 'linear-gradient(135deg, #0284c7, #38bdf8)',
  violet: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
  slate: 'linear-gradient(135deg, #475569, #94a3b8)',
};

/**
 * Represents a persona whose tax form has been completed and submitted.
 * These records are stored in localStorage so the user can revisit
 * their completed work even after refreshing the browser.
 */
interface CompletedPersona {
  /** Internal name/id of the persona (e.g. "anna_meier") */
  persona: string;
  /** Human-readable name shown in the UI (e.g. "Anna Meier") */
  displayName: string;
  /** Accuracy score from 0-100, or null if not yet scored */
  score: number | null;
  /** Date string when the form was completed (e.g. "2025-12-01") */
  date: string;
  /** The full form data object, used for JSON export/download */
  formData?: Record<string, unknown>;
}

/**
 * Retrieves the list of completed personas from localStorage.
 * Uses a try/catch because localStorage.getItem could return
 * malformed JSON if it was tampered with or corrupted.
 *
 * @returns An array of CompletedPersona objects, or an empty array on failure
 */
function getCompleted(): CompletedPersona[] {
  try {
    return JSON.parse(localStorage.getItem('completedPersonas') || '[]');
  } catch { return []; }
}

/**
 * PersonaRow - A clickable card-like row for a single persona.
 *
 * Displays the persona's avatar (initials), name, description, document count,
 * and a "Start" button. When the user clicks, it triggers the onClick handler
 * to begin a session for that persona.
 *
 * @param persona  - The persona data object from the backend API
 * @param loading  - Whether this specific persona is currently being started
 *                   (shows a spinner instead of "Start")
 * @param onClick  - Callback fired when the user clicks the row
 */
function PersonaRow({ persona, loading, onClick }: {
  persona: PersonaInfo;
  loading: boolean;
  onClick: () => void;
}) {
  // Look up the gradient color for this persona, defaulting to slate grey
  const accent = ACCENT_COLORS[persona.color] ?? ACCENT_COLORS.slate;

  // Extract initials from the display name for the avatar circle.
  // For example, "Anna Meier" becomes "AM".
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

/**
 * CompletedRow - Displays a single completed tax form entry.
 *
 * Shows the persona's name, completion date, accuracy score (color-coded),
 * and a download button to export the filled form data as JSON.
 *
 * @param item - The completed persona record from localStorage
 */
function CompletedRow({ item }: { item: CompletedPersona }) {
  /**
   * Creates a downloadable JSON file from the completed form data.
   * This uses the "Blob + temporary anchor element" pattern:
   * 1. Create a Blob (binary large object) from the JSON string
   * 2. Create a temporary URL pointing to that Blob
   * 3. Create a hidden <a> element, set its href to the URL, and click it
   * 4. Clean up by revoking the temporary URL
   */
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

  // Color-code the accuracy score: green (>=80%), amber (>=50%), red (<50%)
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

/**
 * Dashboard - The main page component that renders the full dashboard view.
 *
 * This is the default export and top-level component for the dashboard route.
 * It manages the following state:
 * - `personas`: list of all available personas fetched from the backend
 * - `loading`: whether the initial API call is still in progress
 * - `error`: any error message from failed API calls
 * - `starting`: the name of the persona currently being started (for spinner)
 * - `completed`: list of completed tax forms from localStorage
 *
 * @returns The full dashboard UI with hero banner, pending forms, and completed forms
 */
export default function Dashboard() {
  /** All personas fetched from the backend */
  const [personas, setPersonas] = useState<PersonaInfo[]>([]);
  /** True while the initial persona list is being loaded from the API */
  const [loading, setLoading] = useState(true);
  /** Holds an error message string if something goes wrong, null otherwise */
  const [error, setError] = useState<string | null>(null);
  /** Tracks which persona is currently being started (shows a loading spinner on that row) */
  const [starting, setStarting] = useState<string | null>(null);
  /** List of completed tax forms, loaded from localStorage */
  const [completed, setCompleted] = useState<CompletedPersona[]>(getCompleted);
  /** startSession comes from SessionContext -- it tells the backend to begin a new session */
  const { startSession } = useSession();
  /** React Router's navigate function for programmatic page transitions */
  const navigate = useNavigate();

  // On component mount, fetch the list of personas from the backend
  // and refresh the completed list from localStorage
  useEffect(() => {
    listPersonas()
      .then(setPersonas)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
    setCompleted(getCompleted());
  }, []);

  // Build a Set of completed persona names so we can efficiently filter them out.
  // Personas that have already been completed should not appear in the "Pending" list.
  const completedNames = new Set(completed.map(c => c.persona));
  const pending = personas.filter(p => !completedNames.has(p.name));

  /**
   * Called when the user clicks a persona row to start filling their tax form.
   * 1. Sets a loading state for that specific persona (spinner appears)
   * 2. Calls startSession() to initialize the backend session
   * 3. Navigates to the first form page ("/personal") on success
   * 4. On failure, displays the error and removes the loading state
   *
   * @param persona - The persona the user wants to start working on
   */
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
