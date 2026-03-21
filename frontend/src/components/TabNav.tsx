import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

const tabs = [
  { path: '/overview', label: 'Overview / Tax Return', isOverview: true, id: 'tab-nav-overview' },
  { path: '/personal', label: 'Form Navigation', isFormTab: true, id: 'tab-nav-form' },
  { path: '/review', label: 'Review / Submit', id: 'tab-nav-review', requiresDone: true },
];

const formPaths = ['/personal', '/income', '/deductions', '/wealth', '/attachments'];

export default function TabNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { agentStatus } = useSession();

  return (
    <nav className="tab-nav" aria-label="Main navigation">
      {tabs.map(tab => {
        const isActive = tab.isFormTab
          ? formPaths.some(p => location.pathname.startsWith(p))
          : tab.isOverview
            ? location.pathname === '/overview'
            : location.pathname === tab.path;

        const isLocked = tab.requiresDone && agentStatus === 'running';

        return (
          <button
            key={tab.path}
            id={tab.id}
            className={`tab-nav-item${isActive ? ' active' : ''}`}
            onClick={() => !isLocked && navigate(tab.path)}
            style={isLocked ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            title={isLocked ? 'Available after agent completes' : undefined}
          >
            {tab.label}
            {isLocked && <span style={{ marginLeft: '6px', fontSize: '0.7rem' }}>🔒</span>}
          </button>
        );
      })}
    </nav>
  );
}
