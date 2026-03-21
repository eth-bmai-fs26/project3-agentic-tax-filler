import type { PersonaInfo } from '../api/client';

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  medium: { label: 'Medium', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  hard: { label: 'Hard', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
};

const ACCENT_COLORS: Record<string, string> = {
  emerald: 'linear-gradient(135deg, #059669, #10b981)',
  rose: 'linear-gradient(135deg, #e11d48, #f43f5e)',
  amber: 'linear-gradient(135deg, #d97706, #f59e0b)',
  sky: 'linear-gradient(135deg, #0284c7, #38bdf8)',
  violet: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
  slate: 'linear-gradient(135deg, #475569, #94a3b8)',
};

interface PersonaCardProps {
  persona: PersonaInfo;
  onClick: () => void;
  loading?: boolean;
}

export default function PersonaCard({ persona, onClick, loading }: PersonaCardProps) {
  const diff = DIFFICULTY_CONFIG[persona.difficulty] ?? DIFFICULTY_CONFIG.medium;
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
      onMouseEnter={e => {
        if (!loading) {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.07)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Accent bar */}
      <div style={{ height: '6px', background: accent }} />

      <div style={{ padding: '20px' }}>
        {/* Avatar + difficulty */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
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

        {/* Name */}
        <h3 style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: '#0f172a',
          margin: '0 0 6px',
          letterSpacing: '-0.02em',
        }}>
          {persona.display_name}
        </h3>

        {/* Description */}
        <p style={{
          fontSize: '0.8125rem',
          color: '#64748b',
          margin: '0 0 16px',
          lineHeight: 1.5,
        }}>
          {persona.description}
        </p>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '14px',
          borderTop: '1px solid #f1f5f9',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>📄</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
              {persona.documents.length} documents
            </span>
          </div>
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
