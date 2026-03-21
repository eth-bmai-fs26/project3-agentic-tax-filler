import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from '../context/FormContext';
import { useSession } from '../context/SessionContext';
import '../styles/sidebar.css';

interface SidebarItem {
  path: string;
  label: string;
  key: string;
}

interface SidebarSection {
  key: string;
  label: string;
  items: SidebarItem[];
}

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

// Map sidebar item paths to PAGE_ORDER indices for navigation locking
const PAGE_ORDER_PATHS = [
  '/personal', '/personal/children', '/personal/supported', '/personal/representative',
  '/personal/gifts-received', '/personal/gifts-given', '/personal/capital-benefits', '/personal/bank-details',
  '/income', '/income/pensions', '/income/securities-income', '/income/property-income', '/income/other',
  '/deductions', '/deductions/professional', '/deductions/debt-interest', '/deductions/alimony',
  '/deductions/insurance', '/deductions/medical', '/deductions/other',
  '/wealth', '/wealth/movable', '/wealth/insurance', '/wealth/vehicles', '/wealth/real-estate', '/wealth/debts',
  '/attachments', '/review',
];

function StatusDot({ status }: { status: string }) {
  if (status === 'complete') return <span className="status-dot status-dot-complete" />;
  if (status === 'in-progress') return <span className="status-dot status-dot-progress" />;
  return <span className="status-dot status-dot-empty" />;
}

export default function Sidebar() {
  const { getPageStatus } = useForm();
  const { agentStatus, agentPageIndex } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map(s => [s.key, true]))
  );

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isItemActive = (path: string) => {
    return location.pathname === path;
  };

  const isItemLocked = (item: SidebarItem): boolean => {
    if (agentStatus !== 'running') return false;
    // Lock review tab while agent is running
    if (item.key === 'review') return true;
    // Lock pages beyond agent's current page
    const itemIdx = PAGE_ORDER_PATHS.indexOf(item.path);
    if (itemIdx === -1) return false;
    return itemIdx > agentPageIndex;
  };

  return (
    <nav className="sidebar" aria-label="Tax filing navigation">
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

      {sections.map(section => {
        const sectionStatus = section.key === 'securities'
          ? getPageStatus('wealth')
          : getPageStatus(section.key);

        return (
          <div className="sidebar-section" key={section.key}>
            <button
              id={`nav-section-${section.key}`}
              className="sidebar-section-header"
              onClick={() => toggleSection(section.key)}
            >
              <span
                className={`section-status ${
                  sectionStatus === 'complete' ? 'section-status-filled' :
                  sectionStatus === 'in-progress' ? 'section-status-filled' :
                  'section-status-empty'
                }`}
              />
              {section.label}
              <span className={`sidebar-section-arrow${openSections[section.key] ? ' open' : ''}`}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                  <path d="M2 0l4 4-4 4z"/>
                </svg>
              </span>
            </button>
            {openSections[section.key] && (
              <ul className="sidebar-items">
                {section.items.map(item => {
                  const locked = isItemLocked(item);
                  return (
                    <li key={item.path + item.key}>
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
                        <StatusDot status={getPageStatus(item.key.split('-')[0])} />
                        {item.label}
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
