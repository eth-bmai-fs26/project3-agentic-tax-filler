/**
 * @file OverviewPage.tsx
 *
 * This page provides a bird's-eye view of the entire tax return.
 * It summarizes every section (Personal, Income, Deductions, Wealth,
 * Attachments, Review) in a compact grid layout, showing which fields
 * have been filled in and which are still empty.
 *
 * Each item is clickable and navigates to the corresponding form page
 * so the user can quickly jump to any section that needs attention.
 *
 * When the AI agent is actively filling the form, this page blocks
 * navigation to sections the agent has not yet reached (showing a
 * toast message instead).
 *
 * This page acts like a "table of contents" or "progress tracker"
 * for the entire tax filing process.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from '../context/FormContext';
import { useSession } from '../context/SessionContext';

/**
 * Defines the exact order of all form pages in the application.
 * This ordering is important because when the AI agent is running,
 * we use the page's index in this array to determine whether the
 * user is allowed to navigate to it yet (the agent fills pages
 * sequentially, so pages ahead of the agent are still locked).
 */
const PAGE_ORDER_PATHS = [
  '/personal', '/personal/children', '/personal/supported', '/personal/representative',
  '/personal/gifts-received', '/personal/gifts-given', '/personal/capital-benefits', '/personal/bank-details',
  '/income', '/income/pensions', '/income/securities-income', '/income/property-income', '/income/other',
  '/deductions', '/deductions/professional', '/deductions/debt-interest', '/deductions/alimony',
  '/deductions/insurance', '/deductions/medical', '/deductions/other',
  '/wealth', '/wealth/movable', '/wealth/insurance', '/wealth/vehicles', '/wealth/real-estate', '/wealth/debts',
  '/attachments', '/review',
];

/**
 * SVG icon components used as visual indicators next to section headers.
 * Each icon represents a category of the tax form:
 * PersonIcon   - for the Personal section
 * IncomeIcon   - for the Income section (dollar sign)
 * DeductionIcon - for the Deductions section (plus sign in a box)
 * WealthIcon   - for the Wealth section (dollar sign, same as Income)
 * CheckIcon    - for the Completion section (checkmark)
 */
const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
);
const IncomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
);
const DeductionIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
);
const WealthIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
);

/**
 * Formats a value for display in the overview.
 * If the value is a valid number, formats it with Swiss locale (e.g. 1'234.56).
 * Otherwise returns the string as-is, or empty string if falsy.
 *
 * @param v - The string value to format (could be a number stored as string)
 * @returns The formatted string for display
 */
function fmt(v: string) {
  if (!v) return '';
  const num = Number(v);
  if (isNaN(num)) return v;
  return num.toLocaleString('de-CH');
}

/**
 * OverviewItem - A single clickable row in the overview grid.
 *
 * Each item represents one form section (e.g. "Taxpayer Details",
 * "Employment", "Commuting Costs"). It shows:
 * - A label describing the section
 * - An optional value summarizing what's been filled in
 * - A status indicator (filled = green, attention = orange, empty = grey)
 * - An "i" icon that visually indicates whether the section needs attention
 *
 * Clicking the item navigates to the corresponding form page.
 *
 * @param label   - Display text for the section name
 * @param value   - Optional summary value (e.g. "CHF 85,000" or "2 child(ren)")
 * @param status  - Visual status: 'filled', 'attention', or 'empty'
 * @param link    - The route path to navigate to when clicked
 * @param onClick - Navigation handler (may block if agent is still running)
 */
function OverviewItem({
  label, value, status, link, onClick,
}: {
  label: string;
  value?: string;
  status?: 'filled' | 'attention' | 'empty';
  link: string;
  onClick: (path: string) => void;
}) {
  return (
    <a
      className={`overview-item${status === 'filled' ? ' overview-item-filled' : ''}${status === 'attention' ? ' overview-item-attention' : ''}`}
      onClick={() => onClick(link)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(link)}
    >
      <span className="overview-item-label">{label}</span>
      {value && <span className="overview-item-value">{value}</span>}
      <span className={`info-icon${status === 'attention' ? ' info-icon-error' : ''}`}>i</span>
    </a>
  );
}

/**
 * OverviewPage - The main overview/summary component for the tax return.
 *
 * Pulls all form data from FormContext and displays a summary of every
 * section. Users can click any item to jump directly to that form page.
 *
 * When the AI agent is actively filling forms (`agentStatus === 'running'`),
 * sections that the agent has not yet reached are blocked from navigation.
 *
 * @returns The full overview page UI with all tax return sections summarized
 */
export default function OverviewPage() {
  /** Get the full form data tree from the shared FormContext */
  const { data } = useForm();
  /** Get the agent's current status and which page index it has reached */
  const { agentStatus, agentPageIndex } = useSession();
  const navigate = useNavigate();
  /** Toast message shown when user tries to navigate to a locked section */
  const [toast, setToast] = useState<string | null>(null);

  /**
   * Navigation handler that checks whether the user is allowed to go
   * to the requested page. If the AI agent is currently running and the
   * target page is ahead of where the agent has gotten to, we block
   * navigation and show a temporary toast message instead.
   *
   * @param path - The route path the user wants to navigate to
   */
  const go = (path: string) => {
    if (agentStatus === 'running') {
      // Find the index of the target page in the ordered page list
      const idx = PAGE_ORDER_PATHS.indexOf(path);
      // If the target page is beyond where the agent currently is, block it
      if (idx >= 0 && idx > agentPageIndex) {
        setToast('Waiting for the agent to finish filling this section...');
        setTimeout(() => setToast(null), 3000);
        return;
      }
    }
    navigate(path);
  };

  /**
   * Helper to check if a form value has been filled in.
   * For booleans, returns the boolean directly.
   * For strings, returns true only if the string is non-empty after trimming.
   */
  const has = (v: string | boolean) => typeof v === 'boolean' ? v : !!v && v.trim() !== '';

  // Build the taxpayer's full name for display in the overview
  const fullName = [data.personal.main.firstName, data.personal.main.lastName].filter(Boolean).join(' ');

  return (
    <div className="app-content-wide">
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#fff', padding: '12px 24px', borderRadius: '10px',
          fontSize: '0.875rem', fontWeight: 500, zIndex: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          animation: 'score-card-in 0.3s ease-out',
        }}>
          {toast}
        </div>
      )}
      <h1 style={{ fontSize: '1.2rem', marginBottom: '28px' }}>Overview &mdash; Tax Return 2025</h1>

      {/* ===== PERSONAL SECTION ===== */}
      <div className="overview-section">
        <div className="overview-section-header">
          <PersonIcon />
          <h2>Personal</h2>
        </div>
        <div className="overview-grid" style={{ marginTop: 0 }}>
          <div>
            <OverviewItem
              label="Taxpayer Details"
              value={fullName || undefined}
              status={has(data.personal.main.firstName) ? 'filled' : 'empty'}
              link="/personal"
              onClick={go}
            />
            <OverviewItem
              label="Children"
              value={data.personal.children.length > 0 ? `${data.personal.children.length} child(ren)` : undefined}
              status={data.personal.children.length > 0 ? 'filled' : 'empty'}
              link="/personal/children"
              onClick={go}
            />
            <OverviewItem
              label="Bank Details for Refunds"
              value={data.personal.bankdetails.iban || undefined}
              status={has(data.personal.bankdetails.iban) ? 'filled' : 'empty'}
              link="/personal/bank-details"
              onClick={go}
            />
          </div>
          <div className="overview-info-panel">
            Further personal details on children, supported persons, gifts, inheritances...
          </div>
        </div>
      </div>

      {/* ===== INCOME & DEDUCTIONS =====
           These two sections are displayed side-by-side in a grid layout.
           Income on the left, Deductions on the right. */}
      <div className="overview-grid">
        <div className="overview-section">
          <div className="overview-section-header">
            <IncomeIcon />
            <h2>Income</h2>
          </div>
          {/* Show total income from gross salary; displays a dash if not yet entered */}
          <div className="overview-total">
            <span className="overview-total-label">Total Income</span>
            <span className="overview-total-value">{fmt(data.income.employment.bruttolohn) || '—'}</span>
          </div>
          <OverviewItem
            label="Employment"
            value={fmt(data.income.employment.bruttolohn)}
            status={has(data.income.employment.bruttolohn) ? 'filled' : 'empty'}
            link="/income"
            onClick={go}
          />
          <OverviewItem
            label="Pensions & Insurance"
            value={fmt(data.income.pension.ahvpension)}
            status={has(data.income.pension.ahvpension) ? 'filled' : 'empty'}
            link="/income/pensions"
            onClick={go}
          />
          {/* Securities Income: sum up dividends + interest for the display value.
              We convert both to numbers (defaulting to 0 if empty) then format the total. */}
          <OverviewItem
            label="Securities Income"
            value={has(data.income.investment.dividends) || has(data.income.investment.interest)
              ? fmt(String(Number(data.income.investment.dividends || 0) + Number(data.income.investment.interest || 0)))
              : undefined}
            status={has(data.income.investment.dividends) ? 'filled' : 'empty'}
            link="/income/securities-income"
            onClick={go}
          />
          <OverviewItem
            label="Property Income"
            value={fmt(data.income.rental.eigenmietwert)}
            status={has(data.income.rental.eigenmietwert) ? 'filled' : 'empty'}
            link="/income/property-income"
            onClick={go}
          />
          <OverviewItem
            label="Other Income"
            value={fmt(data.income.otherincome.amount)}
            status={has(data.income.otherincome.amount) ? 'filled' : 'empty'}
            link="/income/other"
            onClick={go}
          />
        </div>

        <div className="overview-section">
          <div className="overview-section-header">
            <DeductionIcon />
            <h2>Deductions</h2>
          </div>
          <div className="overview-total">
            <span className="overview-total-label">Total Deductions</span>
            <span className="overview-total-value">—</span>
          </div>
          <OverviewItem
            label="Commuting Costs"
            value={fmt(data.deductions.fahrkosten.amount)}
            status={has(data.deductions.fahrkosten.amount) ? 'filled' : 'empty'}
            link="/deductions"
            onClick={go}
          />
          <OverviewItem
            label="Other Professional Expenses"
            // value={data.deductions.berufsauslagen.type === 'flat-rate' ? (() => {
            //   const brutto = Number(data.income.employment.bruttolohn) || 0;
            //   const ahv = Number(data.income.employment.ahvcontributions) || 0;
            //   const bvg = Number(data.income.employment.bvgcontributions) || 0;
            //   const nettolohn = brutto - ahv - bvg;
            //   return Math.min(Math.max(Math.round(nettolohn * 0.03), 2000), 4000).toLocaleString('de-CH');
            // })() : undefined}
            /* If the user chose "flat-rate" deduction type, show the auto-calculated
               flat-rate amount (defaults to CHF 2,000 if not computed yet).
               If "effective" (itemized) was chosen, no summary value is shown here. */
            value={data.deductions.berufsauslagen.type === 'flat-rate' ? Number(data.deductions.flatrate.amount || 2000).toLocaleString('de-CH') : undefined}
            status="filled"
            link="/deductions/professional"
            onClick={go}
          />
          <OverviewItem
            label="Debt Interest"
            value={fmt(data.deductions.schuldzinsen.amount)}
            status={has(data.deductions.schuldzinsen.amount) ? 'filled' : 'empty'}
            link="/deductions/debt-interest"
            onClick={go}
          />
          <OverviewItem
            label="Insurance Premiums"
            value={fmt(data.deductions.insurance.amount)}
            status={has(data.deductions.insurance.amount) ? 'filled' : 'empty'}
            link="/deductions/insurance"
            onClick={go}
          />
          <OverviewItem
            label="Pillar 3a"
            value={fmt(data.deductions.pillar3a.amount)}
            status={has(data.deductions.pillar3a.amount) ? 'filled' : 'empty'}
            link="/deductions/other"
            onClick={go}
          />
          <OverviewItem
            label="Medical Costs"
            value={fmt(data.deductions.medical.amount)}
            status={has(data.deductions.medical.amount) ? 'filled' : 'empty'}
            link="/deductions/medical"
            onClick={go}
          />
          <OverviewItem
            label="Other Deductions"
            value={fmt(data.deductions.otherdeductions.amount)}
            status={has(data.deductions.otherdeductions.amount) ? 'filled' : 'empty'}
            link="/deductions/other"
            onClick={go}
          />
        </div>
      </div>

      {/* ===== WEALTH & COMPLETION ===== */}
      <div className="overview-grid">
        <div className="overview-section">
          <div className="overview-section-header">
            <WealthIcon />
            <h2>Wealth</h2>
          </div>
          <div className="overview-total">
            <span className="overview-total-label">Total Wealth</span>
            <span className="overview-total-value">—</span>
          </div>
          <OverviewItem
            label="Securities"
            value={data.wealth.securities.length > 0 ? `${data.wealth.securities.length} position(s)` : undefined}
            status={data.wealth.securities.length > 0 ? 'filled' : 'empty'}
            link="/wealth"
            onClick={go}
          />
          <OverviewItem
            label="Bank Accounts"
            value={data.wealth.bankaccounts.length > 0 ? `${data.wealth.bankaccounts.length} account(s)` : undefined}
            status={data.wealth.bankaccounts.length > 0 ? 'filled' : 'empty'}
            link="/wealth"
            onClick={go}
          />
          <OverviewItem
            label="Movable Assets"
            value={fmt(data.wealth.movableassets.cashgold)}
            status={has(data.wealth.movableassets.cashgold) ? 'filled' : 'empty'}
            link="/wealth/movable"
            onClick={go}
          />
          <OverviewItem
            label="Real Estate"
            value={fmt(data.wealth.realestate.steuerwert)}
            status={has(data.wealth.realestate.steuerwert) ? 'filled' : 'empty'}
            link="/wealth/real-estate"
            onClick={go}
          />
          <OverviewItem
            label="Debts"
            value={data.wealth.debts.length > 0 ? `${data.wealth.debts.length} debt(s)` : undefined}
            status={data.wealth.debts.length > 0 ? 'filled' : 'empty'}
            link="/wealth/debts"
            onClick={go}
          />
        </div>

        <div className="overview-section">
          <div className="overview-section-header">
            <CheckIcon />
            <h2>Completion</h2>
          </div>
          <OverviewItem
            label="Attachments"
            value={Object.values(data.attachments.uploads).filter(Boolean).length > 0
              ? `${Object.values(data.attachments.uploads).filter(Boolean).length} uploaded`
              : undefined}
            status={Object.values(data.attachments.uploads).filter(Boolean).length > 0 ? 'filled' : 'empty'}
            link="/attachments"
            onClick={go}
          />
          <OverviewItem
            label="Review & Submit"
            status="empty"
            link="/review"
            onClick={go}
          />
        </div>
      </div>
    </div>
  );
}
