import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { FormProvider } from './context/FormContext';
import { SessionProvider, useSession } from './context/SessionContext';
import { useSSE } from './hooks/useSSE';
import Header from './components/Header';
import TabNav from './components/TabNav';
import Sidebar from './components/Sidebar';
import AskUserPopup from './components/AskUserPopup';
import AgentStatusBar from './components/AgentStatusBar';
import ScoreCard from './components/ScoreCard';
import Dashboard from './pages/Dashboard';
import OverviewPage from './pages/OverviewPage';
import PersonalPage from './pages/PersonalPage';
import IncomePage from './pages/IncomePage';
import DeductionsPage from './pages/DeductionsPage';
import WealthPage from './pages/WealthPage';
import AttachmentsPage from './pages/AttachmentsPage';
import ReviewPage from './pages/ReviewPage';
import CreatePersonaPage from './pages/CreatePersonaPage';

/** Bridges SSE events into SessionContext state updates. */
function AgentSSEBridge() {
  const { sessionId, setAgentStatus, setScorePercent, stopPolling } = useSession();

  useSSE(sessionId, (event) => {
    if (event.type === 'agent_done') {
      setAgentStatus('done');
      stopPolling();
      if (typeof event.score_percent === 'number') {
        setScorePercent(event.score_percent);
      }
    } else if (event.type === 'agent_error') {
      setAgentStatus('error');
      stopPolling();
    }
  });

  return null;
}

/** Sets window.__taxPortalSetPersona for legacy compatibility. */
function PersonaSync() {
  const { persona } = useSession();
  useEffect(() => {
    if (persona && typeof (window as unknown as Record<string, unknown>).__taxPortalSetPersona === 'function') {
      (window as unknown as Record<string, unknown>).__taxPortalSetPersona as (n: string) => void;
    }
  }, [persona]);
  return null;
}

function PageShell({ children, showSidebar = false }: { children: React.ReactNode; showSidebar?: boolean }) {
  return (
    <>
      <TabNav />
      <div className="app-body">
        {showSidebar && <Sidebar />}
        {children}
      </div>
    </>
  );
}

function FormPage({ children }: { children: React.ReactNode }) {
  return (
    <PageShell showSidebar>
      <div className="app-content">{children}</div>
    </PageShell>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/create-persona" element={<CreatePersonaPage />} />

      <Route path="/overview" element={
        <PageShell>
          <OverviewPage />
        </PageShell>
      } />

      {/* Personal sub-routes */}
      <Route path="/personal" element={<FormPage><PersonalPage sub="taxpayer" /></FormPage>} />
      <Route path="/personal/children" element={<FormPage><PersonalPage sub="children" /></FormPage>} />
      <Route path="/personal/supported" element={<FormPage><PersonalPage sub="supported" /></FormPage>} />
      <Route path="/personal/representative" element={<FormPage><PersonalPage sub="representative" /></FormPage>} />
      <Route path="/personal/gifts-received" element={<FormPage><PersonalPage sub="gifts-received" /></FormPage>} />
      <Route path="/personal/gifts-given" element={<FormPage><PersonalPage sub="gifts-given" /></FormPage>} />
      <Route path="/personal/capital-benefits" element={<FormPage><PersonalPage sub="capital-benefits" /></FormPage>} />
      <Route path="/personal/bank-details" element={<FormPage><PersonalPage sub="bank-details" /></FormPage>} />

      {/* Income sub-routes */}
      <Route path="/income" element={<FormPage><IncomePage sub="employment" /></FormPage>} />
      <Route path="/income/pensions" element={<FormPage><IncomePage sub="pensions" /></FormPage>} />
      <Route path="/income/securities-income" element={<FormPage><IncomePage sub="securities" /></FormPage>} />
      <Route path="/income/property-income" element={<FormPage><IncomePage sub="property" /></FormPage>} />
      <Route path="/income/other" element={<FormPage><IncomePage sub="other" /></FormPage>} />

      {/* Deductions sub-routes */}
      <Route path="/deductions" element={<FormPage><DeductionsPage sub="commuting" /></FormPage>} />
      <Route path="/deductions/professional" element={<FormPage><DeductionsPage sub="professional" /></FormPage>} />
      <Route path="/deductions/debt-interest" element={<FormPage><DeductionsPage sub="debt-interest" /></FormPage>} />
      <Route path="/deductions/alimony" element={<FormPage><DeductionsPage sub="alimony" /></FormPage>} />
      <Route path="/deductions/insurance" element={<FormPage><DeductionsPage sub="insurance" /></FormPage>} />
      <Route path="/deductions/medical" element={<FormPage><DeductionsPage sub="medical" /></FormPage>} />
      <Route path="/deductions/other" element={<FormPage><DeductionsPage sub="other" /></FormPage>} />

      {/* Wealth sub-routes */}
      <Route path="/wealth" element={<FormPage><WealthPage sub="securities" /></FormPage>} />
      <Route path="/wealth/movable" element={<FormPage><WealthPage sub="movable" /></FormPage>} />
      <Route path="/wealth/insurance" element={<FormPage><WealthPage sub="insurance" /></FormPage>} />
      <Route path="/wealth/vehicles" element={<FormPage><WealthPage sub="vehicles" /></FormPage>} />
      <Route path="/wealth/real-estate" element={<FormPage><WealthPage sub="real-estate" /></FormPage>} />
      <Route path="/wealth/debts" element={<FormPage><WealthPage sub="debts" /></FormPage>} />

      {/* Attachments & Review */}
      <Route path="/attachments" element={<FormPage><AttachmentsPage /></FormPage>} />
      <Route path="/review" element={<FormPage><ReviewPage /></FormPage>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <FormProvider>
        <SessionProvider>
          <AgentSSEBridge />
          <PersonaSync />
          <Header />
          <AppRoutes />
          <AskUserPopup />
          <AgentStatusBar />
          <ScoreCard />
        </SessionProvider>
      </FormProvider>
    </HashRouter>
  );
}
