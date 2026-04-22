/**
 * @file TabNav.tsx
 *
 * The top-level horizontal tab navigation bar that sits just below the header.
 * It provides three main tabs:
 *
 *   1. "Overview / Tax Return" -- the summary page showing all form sections.
 *   2. "Form Navigation"       -- the form editing view (covers all form pages
 *                                 like Personal, Income, Deductions, etc.).
 *   3. "Review / Submit"       -- the final review page.
 *
 * The "Review / Submit" tab is locked (greyed out) while the AI agent is still
 * running, because the form data is not complete yet.
 *
 * The "Form Navigation" tab is treated as active whenever the user is on any
 * form page (personal, income, deductions, wealth, or attachments), since
 * those are all sub-pages of the form editing experience.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

/**
 * Configuration for each top-level tab.
 *
 * - path:         Default route to navigate to when the tab is clicked.
 * - label:        Text shown on the tab button.
 * - isOverview:   If true, this tab is active only on the exact "/overview" path.
 * - isFormTab:    If true, this tab is active on any form page path.
 * - requiresDone: If true, the tab is locked while the agent is running.
 * - id:           HTML id for testing / agent interaction.
 */
const tabs = [
  { path: '/overview', label: 'Overview / Tax Return', isOverview: true, id: 'tab-nav-overview' },
  { path: '/personal', label: 'Form Navigation', isFormTab: true, id: 'tab-nav-form' },
  { path: '/review', label: 'Review / Submit', id: 'tab-nav-review', requiresDone: true },
];

/**
 * The set of top-level route prefixes that are all considered part of the
 * "Form Navigation" tab. If the current URL starts with any of these,
 * the "Form Navigation" tab is highlighted as active.
 */
const formPaths = ['/personal', '/income', '/deductions', '/wealth', '/attachments'];

/**
 * TabNav -- renders the three top-level tabs and handles highlighting the
 * currently active tab and locking tabs that are not yet available.
 *
 * @returns A <nav> element containing the tab buttons.
 */
export default function TabNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { agentStatus } = useSession();

  return (
    <nav className="tab-nav" aria-label="Main navigation">
      {tabs.map(tab => {
        // Determine which tab should be highlighted as "active":
        // - The "Form Navigation" tab is active if the URL matches any form path.
        // - The "Overview" tab is active only on the exact "/overview" route.
        // - Other tabs are active only when the URL matches their exact path.
        const isActive = tab.isFormTab
          ? formPaths.some(p => location.pathname.startsWith(p))
          : tab.isOverview
            ? location.pathname === '/overview'
            : location.pathname === tab.path;

        // A tab is locked if it requires the agent to be done but the agent
        // is still running
        const isLocked = tab.requiresDone && agentStatus === 'running';

        return (
          <button
            key={tab.path}
            id={tab.id}
            className={`tab-nav-item${isActive ? ' active' : ''}`}
            onClick={() => !isLocked && navigate(tab.path)}
            /* Locked tabs are dimmed and show a "not-allowed" cursor */
            style={isLocked ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            title={isLocked ? 'Available after agent completes' : undefined}
          >
            {tab.label}
            {/* Show a lock icon next to locked tabs */}
            {isLocked && <span style={{ marginLeft: '6px', fontSize: '0.7rem' }}>🔒</span>}
          </button>
        );
      })}
    </nav>
  );
}
