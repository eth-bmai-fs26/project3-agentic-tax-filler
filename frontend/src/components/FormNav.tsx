import { useLocation } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

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

interface FormNavProps {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
}

export default function FormNav({
  onBack,
  onNext,
  backLabel = '← Back',
  nextLabel = 'Next →',
}: FormNavProps) {
  const location = useLocation();
  const { agentStatus, agentPageIndex } = useSession();

  // Determine if Next is locked because agent hasn't reached the next page yet
  const currentIdx = PAGE_ORDER_PATHS.indexOf(location.pathname);
  const nextLocked = agentStatus === 'running' && currentIdx >= 0 && currentIdx >= agentPageIndex;

  return (
    <div className="page-nav">
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
      <button
        id="btn-save-draft"
        className="btn-secondary"
        data-testid="nav-save"
        aria-label="Save draft"
      >
        Save Draft
      </button>
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
