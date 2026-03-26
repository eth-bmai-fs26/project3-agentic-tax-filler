/**
 * @file Sidebar.tsx
 *
 * The left-hand navigation panel shown alongside the tax form. It lists every
 * section and page of the form in a collapsible tree structure. Each item
 * displays a small status dot (empty, in-progress, or complete) so the user
 * can quickly see which parts of the form have been filled.
 *
 * While the AI agent is running, sidebar items for pages the agent hasn't
 * reached yet are locked (greyed out with a lock icon). This prevents the
 * user from jumping ahead to unfilled pages.
 *
 * The sidebar also includes a "Back to Overview" link at the top that returns
 * the user to the Overview / summary page.
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from '../context/FormContext';
import { useSession } from '../context/SessionContext';
import '../styles/sidebar.css';

/**
 * Represents a single navigable item within a sidebar section.
 *
 * @property path  - The URL path to navigate to (e.g. "/personal/children").
 * @property label - Human-readable name shown in the sidebar.
 * @property key   - Unique identifier used for HTML ids and status lookups.
 */
interface SidebarItem {
  path: string;
  label: string;
  key: string;
}

/**
 * Represents a collapsible group of sidebar items.
 *
 * @property key   - Unique identifier for the section (e.g. "personal").
 * @property label - The heading text shown for the section.
 * @property items - The list of navigable items inside this section.
 */
interface SidebarSection {
  key: string;
  label: string;
  items: SidebarItem[];
}

/**
 * The complete navigation structure for the tax form sidebar.
 * Each section groups related form pages together. The order here
 * determines the visual order in the sidebar.
 */
const sections: SidebarSection[] = [
  {
    key: 'personal',
    label: 'Personal',
    items: [
      { path: '/personal', label: 'Taxpayer Details', key: 'personal' },
      { path: '/personal/children', label: 'Children', key: 'personal-children' },
      { path: '/personal/supported', label: 'Supported Persons', key: 'personal-supported' },
      { path: '/personal/representative', label: 'Representative', key: 'personal-representative' },
      { path: '/personal/gifts-received', label: 'Gifts / Inheritances Received', key: 'personal-gifts-received' },
      { path: '/personal/gifts-given', label: 'Gifts / Advance Inheritances Given', key: 'personal-gifts-given' },
      { path: '/personal/capital-benefits', label: 'Capital Benefits', key: 'personal-capital-benefits' },
      { path: '/personal/bank-details', label: 'Bank Details for Refunds', key: 'personal-bank-details' },
    ],
  },
  {
    key: 'income',
    label: 'Income',
    items: [
      { path: '/income', label: 'Employment', key: 'income' },
      { path: '/income/pensions', label: 'Pensions & Insurance', key: 'income-pensions' },
      { path: '/income/securities-income', label: 'Securities Income', key: 'income-securities' },
      { path: '/income/property-income', label: 'Property Income', key: 'income-property' },
      { path: '/income/other', label: 'Other Income', key: 'income-other' },
    ],
  },
  {
    key: 'deductions',
    label: 'Deductions',
    items: [
      { path: '/deductions', label: 'Commuting Costs', key: 'deductions' },
      { path: '/deductions/professional', label: 'Other Professional Expenses', key: 'deductions-professional' },
      { path: '/deductions/debt-interest', label: 'Debt Interest', key: 'deductions-debt' },
      { path: '/deductions/alimony', label: 'Alimony / Maintenance', key: 'deductions-alimony' },
      { path: '/deductions/insurance', label: 'Insurance Premiums', key: 'deductions-insurance' },
      { path: '/deductions/medical', label: 'Medical Costs', key: 'deductions-medical' },
      { path: '/deductions/other', label: 'Other Deductions', key: 'deductions-other' },
    ],
  },
  {
    key: 'securities',
    label: 'Securities',
    items: [
      { path: '/wealth', label: 'Securities Register', key: 'wealth' },
      { path: '/wealth', label: 'Bank Accounts', key: 'wealth-bankaccounts' },
    ],
  },
  {
    key: 'wealth',
    label: 'Wealth',
    items: [
      { path: '/wealth/movable', label: 'Movable Assets', key: 'wealth-movable' },
      { path: '/wealth/insurance', label: 'Life & Pension Insurance', key: 'wealth-insurance' },
      { path: '/wealth/vehicles', label: 'Motor Vehicles', key: 'wealth-vehicles' },
      { path: '/wealth/real-estate', label: 'Real Estate', key: 'wealth-realestate' },
      { path: '/wealth/debts', label: 'Debts', key: 'wealth-debts' },
    ],
  },
  {
    key: 'attachments',
    label: 'Attachments',
    items: [
      { path: '/attachments', label: 'Upload Documents', key: 'attachments' },
    ],
  },
  {
    key: 'review',
    label: 'Completion',
    items: [
      { path: '/review', label: 'Review & Submit', key: 'review' },
    ],
  },
];

/**
 * Ordered list of every form page path, used to determine which pages
 * should be locked while the agent is running. The agent progresses through
 * these pages in order, and any page beyond the agent's current index is
 * considered "not yet reached" and will be locked.
 *
 * This list must stay in sync with PAGE_ORDER_PATHS in FormNav.tsx.
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
 * StatusDot -- a small coloured circle indicating whether a form section is
 * empty (grey), in progress (blue/yellow), or complete (green).
 *
 * The actual colours and animations are defined in sidebar.css via the
 * CSS classes "status-dot-complete", "status-dot-progress", and "status-dot-empty".
 *
 * @param status - One of "complete", "in-progress", or any other value (treated as empty).
 * @returns A small <span> element styled as a coloured dot.
 */
function StatusDot({ status }: { status: string }) {
  if (status === 'complete') return <span className="status-dot status-dot-complete" />;
  if (status === 'in-progress') return <span className="status-dot status-dot-progress" />;
  return <span className="status-dot status-dot-empty" />;
}

/**
 * Sidebar -- the main left-hand navigation panel for the tax form.
 *
 * Features:
 *   - Collapsible section headers that show/hide their child items.
 *   - Status dots next to each item indicating fill progress.
 *   - Navigation locking while the AI agent is running (pages the agent
 *     hasn't reached yet are greyed out and unclickable).
 *   - A "Back to Overview" link at the top.
 *
 * @returns A <nav> element containing the full sidebar navigation tree.
 */
export default function Sidebar() {
  // getPageStatus returns "empty", "in-progress", or "complete" for a given page key
  const { getPageStatus } = useForm();
  // agentPageIndex is the index in PAGE_ORDER_PATHS of the page the agent is currently on
  const { agentStatus, agentPageIndex } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  // Track which sidebar sections are expanded (open) or collapsed.
  // By default, all sections start expanded (set to true).
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map(s => [s.key, true]))
  );

  /**
   * Toggles a section between expanded and collapsed.
   * @param key - The section key to toggle.
   */
  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /**
   * Checks whether a sidebar item is the currently active (visible) page
   * by comparing its path to the browser's current URL.
   *
   * @param path - The item's route path.
   * @returns True if this item's page is currently being viewed.
   */
  const isItemActive = (path: string) => {
    return location.pathname === path;
  };

  /**
   * Determines whether a sidebar item should be locked (non-clickable).
   * Items are locked when the agent is running and hasn't reached that
   * page yet. The Review tab is always locked while the agent is running.
   *
   * @param item - The sidebar item to check.
   * @returns True if the item should be locked.
   */
  const isItemLocked = (item: SidebarItem): boolean => {
    if (agentStatus !== 'running') return false;
    // The review page is always locked while the agent is still working
    if (item.key === 'review') return true;
    // Compare this item's position in the page order to the agent's progress
    const itemIdx = PAGE_ORDER_PATHS.indexOf(item.path);
    if (itemIdx === -1) return false;
    return itemIdx > agentPageIndex;
  };

  return (
    <nav className="sidebar" aria-label="Tax filing navigation">
      {/* "Back to Overview" link at the top of the sidebar */}
      <a
        id="nav-back-overview"
        className="sidebar-back"
        onClick={() => navigate('/overview')}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && navigate('/overview')}
      >
        Back to Overview
      </a>

      {/* Render each collapsible section and its child items */}
      {sections.map(section => {
        // For the "Securities" section, look up the status of the "wealth"
        // page since they share the same data. Otherwise use the section's own key.
        const sectionStatus = section.key === 'securities'
          ? getPageStatus('wealth')
          : getPageStatus(section.key);

        return (
          <div className="sidebar-section" key={section.key}>
            {/* Section header -- clicking it expands or collapses the items */}
            <button
              id={`nav-section-${section.key}`}
              className="sidebar-section-header"
              onClick={() => toggleSection(section.key)}
            >
              {/* Section-level status indicator (filled or empty circle) */}
              <span
                className={`section-status ${
                  sectionStatus === 'complete' ? 'section-status-filled' :
                  sectionStatus === 'in-progress' ? 'section-status-filled' :
                  'section-status-empty'
                }`}
              />
              {section.label}
              {/* Chevron arrow that rotates when the section is open */}
              <span className={`sidebar-section-arrow${openSections[section.key] ? ' open' : ''}`}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                  <path d="M2 0l4 4-4 4z"/>
                </svg>
              </span>
            </button>

            {/* Render child items only when the section is expanded */}
            {openSections[section.key] && (
              <ul className="sidebar-items">
                {section.items.map(item => {
                  const locked = isItemLocked(item);
                  return (
                    <li key={item.path + item.key}>
                      {/* Each item acts like a link/button. Locked items are
                          dimmed, have cursor: not-allowed, and ignore clicks. */}
                      <a
                        id={`nav-${item.key}`}
                        className={isItemActive(item.path) ? 'active' : ''}
                        onClick={() => !locked && navigate(item.path)}
                        role="button"
                        tabIndex={locked ? -1 : 0}
                        onKeyDown={e => e.key === 'Enter' && !locked && navigate(item.path)}
                        style={locked ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                        title={locked ? 'Agent has not reached this page yet' : undefined}
                      >
                        {/* Status dot for this individual page.
                            We extract the top-level page key by splitting on "-"
                            (e.g. "personal-children" -> "personal"). */}
                        <StatusDot status={getPageStatus(item.key.split('-')[0])} />
                        {item.label}
                        {/* Lock icon shown next to items the agent hasn't reached */}
                        {locked && <span style={{ marginLeft: 'auto', fontSize: '0.65rem' }}>🔒</span>}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
