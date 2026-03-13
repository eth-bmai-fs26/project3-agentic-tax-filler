import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { path: '/overview', label: 'Overview / Tax Return', isOverview: true, id: 'tab-nav-overview' },
  { path: '/personal', label: 'Form Navigation', isFormTab: true, id: 'tab-nav-form' },
  { path: '/review', label: 'Review / Submit', id: 'tab-nav-review' },
];

const formPaths = ['/personal', '/income', '/deductions', '/wealth', '/attachments'];

export default function TabNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="tab-nav" aria-label="Main navigation">
      {tabs.map(tab => {
        const isActive = tab.isFormTab
          ? formPaths.some(p => location.pathname.startsWith(p))
          : tab.isOverview
            ? location.pathname === '/overview'
            : location.pathname === tab.path;

        return (
          <button
            key={tab.path}
            id={tab.id}
            className={`tab-nav-item${isActive ? ' active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
