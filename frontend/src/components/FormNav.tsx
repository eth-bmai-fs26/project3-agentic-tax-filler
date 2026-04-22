/**
 * @file FormNav.tsx
 *
 * Renders Back / Save Draft / Next navigation buttons at the bottom of each
 * form page. The "Next" button can be locked (greyed out and unclickable)
 * while the AI agent is still working on the current page -- this prevents
 * the user from jumping ahead to pages the agent hasn't filled yet.
 *
 * The locking logic compares the current page index against the agent's
 * progress index (agentPageIndex) from the SessionContext.
 */

import { useLocation } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

/**
 * Ordered list of every form page path in the application.
 * The index of a path in this array represents how far along in the form
 * it is. This must stay in sync with the same list in Sidebar.tsx.
 */
// Must match PAGE_ORDER_PATHS in Sidebar.tsx
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
 * Props for the FormNav component.
 *
 * @property onBack    - Callback fired when the Back button is clicked.
 *                       If undefined, the Back button is disabled.
 * @property onNext    - Callback fired when the Next button is clicked.
 *                       If undefined, the Next button is disabled.
 * @property backLabel - Custom label for the Back button (defaults to "Back").
 * @property nextLabel - Custom label for the Next button (defaults to "Next").
 */
interface FormNavProps {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
}

/**
 * FormNav -- renders the bottom navigation bar with Back, Save Draft, and Next
 * buttons. The Next button is automatically locked while the AI agent is
 * running and hasn't reached the next page yet.
 *
 * @param props - See FormNavProps for details.
 * @returns A navigation bar element with three buttons.
 */
export default function FormNav({
  onBack,
  onNext,
  backLabel = '← Back',
  nextLabel = 'Next →',
}: FormNavProps) {
  const location = useLocation();
  const { agentStatus, agentPageIndex } = useSession();

  // --- Next-button locking logic ---
  // Find where the current page sits in the ordered list of pages.
  const currentIdx = PAGE_ORDER_PATHS.indexOf(location.pathname);
  // The Next button is locked when:
  //   1. The agent is currently running, AND
  //   2. The current page index is at or beyond the agent's progress index.
  // This means the user can freely navigate backward to pages the agent has
  // already completed but cannot skip ahead.
  const nextLocked = agentStatus === 'running' && currentIdx >= 0 && currentIdx >= agentPageIndex;

  return (
    <div className="page-nav">
      {/* Back button -- disabled when no onBack handler is provided
          (i.e., the user is already on the first page). */}
      <button
        id="btn-back"
        className="btn-secondary"
        onClick={onBack}
        disabled={!onBack}
        data-testid="nav-back"
        aria-label="Back"
      >
        {backLabel}
      </button>

      {/* Save Draft button -- currently a placeholder for future functionality */}
      <button
        id="btn-save-draft"
        className="btn-secondary"
        data-testid="nav-save"
        aria-label="Save draft"
      >
        Save Draft
      </button>

      {/* Next button -- disabled if no handler OR if the agent hasn't
          reached the next page yet. When locked, a tooltip explains why. */}
      <button
        id="btn-next"
        className="btn-primary"
        onClick={nextLocked ? undefined : onNext}
        disabled={!onNext || nextLocked}
        data-testid="nav-next"
        aria-label="Next"
        title={nextLocked ? 'Agent has not finished this page yet' : undefined}
        style={nextLocked ? { opacity: 0.5 } : undefined}
      >
        {nextLabel}
      </button>
    </div>
  );
}
