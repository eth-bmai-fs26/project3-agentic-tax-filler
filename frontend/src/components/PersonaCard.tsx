/**
 * @file PersonaCard.tsx
 *
 * A clickable card displayed on the Dashboard page. Each card represents one
 * taxpayer persona that the AI agent can fill out. The card shows:
 *   - A coloured accent bar and avatar with the persona's initials.
 *   - A difficulty badge (Easy / Medium / Hard).
 *   - The persona's name and a short description.
 *   - A footer with the number of source documents and a "Start" action.
 *
 * When clicked, the card triggers the parent's onClick handler, which
 * typically starts the AI agent session for that persona and navigates to
 * the form.
 */

import type { PersonaInfo } from '../api/client';

/**
 * Colour configuration for each difficulty level.
 * Each entry defines the badge label, text colour, background colour, and
 * border colour so the badge visually communicates how hard the persona is.
 *
 * - Easy   = green tones
 * - Medium = amber/orange tones
 * - Hard   = red tones
 */
const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  medium: { label: 'Medium', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  hard: { label: 'Hard', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
};

/**
 * Maps colour names (provided in the persona data from the backend) to CSS
 * gradient strings. These gradients are used for the card's top accent bar
 * and the avatar square, giving each persona a distinct visual identity.
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
 * Props for the PersonaCard component.
 *
 * @property persona - The persona data object from the API containing name,
 *                     description, difficulty, colour, and document list.
 * @property onClick - Callback fired when the user clicks the card to start
 *                     the agent for this persona.
 * @property loading - When true, the card is visually dimmed and clicks are
 *                     disabled (shown while the agent session is being set up).
 */
interface PersonaCardProps {
  persona: PersonaInfo;
  onClick: () => void;
  loading?: boolean;
}

/**
 * PersonaCard -- renders a single persona selection card on the Dashboard.
 *
 * The card has hover effects (shadow + slight lift) to indicate it is
 * interactive. When loading is true, hover effects are suppressed and the
 * card shows "Starting..." instead of "Start".
 *
 * @param props - See PersonaCardProps for details.
 * @returns A styled button element representing the persona.
 */
export default function PersonaCard({ persona, onClick, loading }: PersonaCardProps) {
  // Look up the visual config for this persona's difficulty and colour.
  // Fall back to "medium" difficulty and "slate" colour if the value is unexpected.
  const diff = DIFFICULTY_CONFIG[persona.difficulty] ?? DIFFICULTY_CONFIG.medium;
  const accent = ACCENT_COLORS[persona.color] ?? ACCENT_COLORS.slate;

  // Build a two-letter initial string from the persona's display name.
  // For example, "Anna Mueller" becomes "AM".
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
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        overflow: 'hidden',
        cursor: loading ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'box-shadow 0.2s, transform 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
        opacity: loading ? 0.7 : 1,
      }}
      /* Hover effect: increase shadow and lift the card up by 2px.
         These are applied via inline style manipulation because CSS
         hover pseudo-classes cannot be used with inline styles. */
      onMouseEnter={e => {
        if (!loading) {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }
      }}
      /* Reset shadow and position when the mouse leaves the card */
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.07)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Thin coloured bar at the top of the card for visual flair */}
      <div style={{ height: '6px', background: accent }} />

      <div style={{ padding: '20px' }}>
        {/* ----- Row: avatar initials (left) + difficulty badge (right) ----- */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
          {/* Square avatar showing the persona's initials on a gradient background */}
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          {/* Difficulty badge (e.g. "EASY", "MEDIUM", "HARD") */}
          <span style={{
            background: diff.bg,
            color: diff.color,
            border: `1px solid ${diff.border}`,
            borderRadius: '8px',
            padding: '3px 10px',
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {diff.label}
          </span>
        </div>

        {/* ----- Persona name ----- */}
        <h3 style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: '#0f172a',
          margin: '0 0 6px',
          letterSpacing: '-0.02em',
        }}>
          {persona.display_name}
        </h3>

        {/* ----- Short description of the persona's tax situation ----- */}
        <p style={{
          fontSize: '0.8125rem',
          color: '#64748b',
          margin: '0 0 16px',
          lineHeight: 1.5,
        }}>
          {persona.description}
        </p>

        {/* ----- Footer: document count + start action ----- */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '14px',
          borderTop: '1px solid #f1f5f9',
        }}>
          {/* Number of source documents available for this persona */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>📄</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
              {persona.documents.length} documents
            </span>
          </div>
          {/* Call-to-action text; changes to "Starting..." while loading */}
          <span style={{
            fontSize: '0.8125rem',
            color: '#1e40af',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            {loading ? 'Starting…' : 'Start →'}
          </span>
        </div>
      </div>
    </button>
  );
}
