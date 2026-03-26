/**
 * @file ScoreCard.tsx
 *
 * A full-screen overlay that appears when the AI agent finishes filling the
 * tax form. It fetches the agent's accuracy score from the backend, displays
 * it as a circular gauge (percentage), and shows a breakdown of correct,
 * wrong, missing, and extra fields. The user can expand an error list to see
 * exactly which fields were incorrect.
 *
 * From here the user can either:
 *   - "View Form" -- dismiss the overlay and inspect the filled form.
 *   - "Download & Return Home" -- save the result, download the JSON, and
 *     navigate back to the dashboard.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useForm } from '../context/FormContext';
import { getScore } from '../api/client';

/**
 * Shape of the scoring response returned by the backend API.
 *
 * @property score_percent - Overall accuracy as a percentage (0-100).
 * @property correct       - Number of fields filled correctly.
 * @property wrong         - Number of fields filled with the wrong value.
 * @property missing       - Number of fields the agent left empty.
 * @property extra         - Number of fields the agent filled that should be empty.
 * @property errors        - Detailed list of individual field errors.
 */
interface ScoreResult {
  score_percent?: number;
  correct?: number;
  wrong?: number;
  missing?: number;
  extra?: number;
  errors?: Array<{ path: string; expected: unknown; got: unknown; cause?: string }>;
}

/**
 * CircleGauge -- an SVG circular progress gauge that visually represents
 * the agent's score as a partially filled ring.
 *
 * How it works:
 *   - Two <circle> elements are drawn on top of each other.
 *   - The bottom circle is a light grey track (the "empty" part).
 *   - The top circle uses `strokeDasharray` to fill only a portion of the
 *     ring proportional to the percentage. The ring colour changes based on
 *     the score: green (>= 80%), amber (>= 50%), or red (< 50%).
 *   - The entire SVG is rotated -90 degrees so the fill starts from the
 *     top (12 o'clock position) instead of the right (3 o'clock).
 *   - The percentage text is counter-rotated so it reads normally.
 *
 * @param percent - The score percentage to display (0-100).
 * @returns An SVG element showing a circular gauge.
 */
function CircleGauge({ percent }: { percent: number }) {
  const r = 52; // radius of the circle in SVG units
  const circ = 2 * Math.PI * r; // total circumference of the circle
  // The "dash" length is the portion of the circumference that is filled in
  const dash = (percent / 100) * circ;
  // Choose colour based on score thresholds
  const color = percent >= 80 ? '#16a34a' : percent >= 50 ? '#d97706' : '#dc2626';

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
      {/* Background track circle (light grey) */}
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
      {/* Foreground progress arc -- only `dash` pixels are visible,
          the rest (`circ`) is the gap in the dash pattern */}
      <circle
        cx="70" cy="70" r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease-out' }}
      />
      {/* Percentage label in the centre.
          Rotated +90 degrees to counteract the parent SVG's -90 degree rotation
          so the text reads upright. */}
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

/**
 * Persists the completed persona result to localStorage so the Dashboard
 * can display it later (even after the page is refreshed).
 *
 * @param persona     - Internal persona key.
 * @param displayName - Human-readable persona name.
 * @param scorePct    - Accuracy score (0-100), or null.
 * @param formData    - The full form data object.
 */
function saveCompleted(persona: string, displayName: string, scorePct: number | null, formData: Record<string, unknown>) {
  try {
    const existing = JSON.parse(localStorage.getItem('completedPersonas') || '[]');
    // Remove if already exists (handles re-runs of the same persona)
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
    // localStorage may be full or unavailable -- silently ignore
  }
}

/**
 * Triggers a browser download of the form data as a pretty-printed JSON file.
 *
 * @param persona  - Persona key used in the filename.
 * @param formData - The complete form data to serialize.
 */
function downloadFormJSON(persona: string, formData: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zh-tax-filing-${persona}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * ScoreCard -- the full-screen modal overlay that shows the agent's accuracy
 * score after it finishes filling the tax form.
 *
 * Lifecycle:
 *   1. When `agentStatus` transitions to "done", a useEffect fetches the
 *      score from the backend API.
 *   2. The overlay appears with a scale-up animation.
 *   3. The user can expand the error details, view the form, or finish.
 *   4. Dismissing the overlay (either button) sets `dismissed = true` and
 *      hides the component.
 *
 * @returns The score overlay element, or null when not applicable.
 */
export default function ScoreCard() {
  const { agentStatus, sessionId, persona, resetSession } = useSession();
  const { data } = useForm();
  const navigate = useNavigate();

  // The score result fetched from the backend (null until loaded)
  const [score, setScore] = useState<ScoreResult | null>(null);
  // Whether the user has closed the overlay
  const [dismissed, setDismissed] = useState(false);
  // Whether the error details list is expanded
  const [expanded, setExpanded] = useState(false);

  // Fetch the score from the backend whenever the agent finishes
  useEffect(() => {
    if (agentStatus === 'done' && sessionId) {
      getScore(sessionId)
        .then(data => setScore(data as ScoreResult))
        .catch(() => setScore({ score_percent: 0 })); // Default to 0 on failure
      setDismissed(false); // Reset dismissed flag for new results
    }
  }, [agentStatus, sessionId]);

  // Don't render anything if the agent isn't done, the score hasn't loaded,
  // or the user has already dismissed the overlay
  if (agentStatus !== 'done' || !score || dismissed) return null;

  const pct = score.score_percent ?? 0;
  const errors = score.errors ?? [];

  // Convert persona key to a display-friendly name
  const displayName = persona
    ? persona.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : '';

  /**
   * Called when the user clicks "Download & Return Home".
   * Saves the result, triggers a file download, resets the session,
   * and navigates back to the dashboard.
   */
  const handleFinish = () => {
    if (persona) {
      saveCompleted(persona, displayName, pct, data as unknown as Record<string, unknown>);
      downloadFormJSON(persona, data as unknown as Record<string, unknown>);
    }
    setDismissed(true);
    resetSession();
    navigate('/dashboard');
  };

  /**
   * Called when the user clicks "View Form" or the close button.
   * Simply hides the overlay so the user can inspect the filled form.
   */
  const handleViewForm = () => {
    setDismissed(true);
  };

  return (
    /* Full-screen semi-transparent backdrop with blur.
       Clicking the backdrop does NOT dismiss the overlay -- the user must
       use one of the action buttons. */
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
      {/* White card that scales up and fades in */}
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        width: '100%',
        maxWidth: '520px',
        overflow: 'hidden',
        animation: 'score-card-in 0.4s ease-out',
      }}>
        {/* ----- Dark header with trophy icon and close button ----- */}
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
          {/* Close button -- same as "View Form" (dismisses overlay) */}
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

        {/* ----- Score gauge and stats area ----- */}
        <div style={{ padding: '32px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          {/* Circular percentage gauge */}
          <CircleGauge percent={Math.round(pct)} />

          {/* Four stat boxes in a row: Correct, Wrong, Missing, Extra */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            width: '100%',
          }}>
            {/* Each stat object defines its label, numeric value, text colour,
                and background colour. We map over the array to render them. */}
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

          {/* ----- Expandable error details ----- */}
          {/* Only shown when there are errors to display */}
          {errors.length > 0 && (
            <div style={{ width: '100%' }}>
              {/* Toggle button to expand/collapse the error list */}
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

              {/* Scrollable list of individual field errors */}
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
                      {/* The field path (e.g. "personal.taxpayer.firstName") */}
                      <div style={{ fontWeight: 600, color: '#1e293b', fontFamily: 'monospace' }}>
                        {err.path}
                      </div>
                      {/* Expected vs. actual values, with optional cause */}
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

          {/* ----- Action buttons ----- */}
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            {/* "View Form" dismisses the overlay so the user can inspect fields */}
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
            {/* "Download & Return Home" saves, downloads, and navigates away */}
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

      {/* Scale-up + fade-in animation for the card entrance */}
      <style>{`
        @keyframes score-card-in {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
