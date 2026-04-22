/**
 * @file App.tsx - Main Application Component with Routing
 *
 * This is the central "orchestrator" of the frontend. It defines:
 *   1. The URL routing -- which page component shows for which URL path
 *   2. The global layout -- Header at the top, optional Sidebar, tab navigation
 *   3. Context providers -- wraps everything in FormProvider and SessionProvider
 *      so all child components can access shared state
 *   4. Background services -- AgentSSEBridge listens for real-time agent events,
 *      PersonaSync keeps legacy code in sync with the active persona
 *
 * How routing works:
 *   - We use HashRouter (URLs look like /#/dashboard, /#/personal, etc.)
 *   - Each <Route> maps a URL path to a React component (a "page")
 *   - <Navigate> redirects unknown paths to /dashboard
 *
 * How this fits into the project:
 *   main.tsx renders <App /> --> App sets up routing and providers
 *   --> each route renders a page component (Dashboard, PersonalPage, etc.)
 */

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

/**
 * AgentSSEBridge - Invisible component that listens for real-time server events.
 *
 * "SSE" stands for Server-Sent Events -- a way for the Flask backend to push
 * live updates to the browser (e.g., "the agent finished" or "an error occurred").
 *
 * This component does not render anything visible (returns null). Instead, it:
 *   1. Subscribes to the SSE stream for the current session using the useSSE hook
 *   2. When an 'agent_done' event arrives, updates the agent status to 'done',
 *      stops polling the backend for form data, and records the score if present
 *   3. When an 'agent_error' event arrives, updates status to 'error' and stops polling
 *
 * Why it exists as a separate component:
 *   It needs access to SessionContext (useSession), so it must be rendered
 *   inside <SessionProvider>. Keeping it separate makes the code cleaner
 *   than putting this logic directly in App.
 *
 * @returns {null} This component renders nothing -- it only has side effects.
 */
function AgentSSEBridge() {
  const { sessionId, setAgentStatus, setScorePercent, stopPolling } = useSession();

  useSSE(sessionId, (event) => {
    // When the agent finishes processing the tax form
    if (event.type === 'agent_done') {
      setAgentStatus('done');
      stopPolling(); // No need to keep fetching form data from the backend
      // The backend may include a score showing how well the form was filled
      if (typeof event.score_percent === 'number') {
        setScorePercent(event.score_percent);
      }
    } else if (event.type === 'agent_error') {
      // Something went wrong with the agent -- stop polling and show error state
      setAgentStatus('error');
      stopPolling();
    }
  });

  return null;
}

/**
 * PersonaSync - Invisible component for legacy compatibility.
 *
 * Some older parts of the codebase may attach a function called
 * `window.__taxPortalSetPersona` to the global window object.
 * This component checks if that function exists and, if so,
 * could call it whenever the selected persona changes.
 *
 * This is a "bridge" pattern: it connects the modern React state (useSession)
 * to older non-React code that reads from the window object.
 *
 * @returns {null} This component renders nothing -- it only has side effects.
 */
function PersonaSync() {
  const { persona } = useSession();
  useEffect(() => {
    // Check if the legacy global function exists on the window object
    if (persona && typeof (window as unknown as Record<string, unknown>).__taxPortalSetPersona === 'function') {
      (window as unknown as Record<string, unknown>).__taxPortalSetPersona as (n: string) => void;
    }
  }, [persona]); // Re-run this effect whenever the persona changes
  return null;
}

/**
 * PageShell - Shared layout wrapper for pages that need tab navigation.
 *
 * This component provides the consistent page structure:
 *   - TabNav (the horizontal tab bar at the top of the content area)
 *   - Optionally, a Sidebar on the left (for form pages)
 *   - The page content (passed as `children`)
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - The page content to render
 * @param {boolean} [props.showSidebar=false] - Whether to show the left sidebar
 * @returns {JSX.Element} The wrapped page layout
 */
function PageShell({ children, showSidebar = false }: { children: React.ReactNode; showSidebar?: boolean }) {
  return (
    <>
      <TabNav />
      <div className="app-body">
        {/* Only render the Sidebar if showSidebar is true */}
        {showSidebar && <Sidebar />}
        {children}
      </div>
    </>
  );
}

/**
 * FormPage - Layout wrapper specifically for tax form pages.
 *
 * This is a convenience wrapper around PageShell that always shows the sidebar
 * and wraps the content in a styled container (app-content div).
 * All form pages (Personal, Income, Deductions, etc.) use this layout.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - The form page content to render
 * @returns {JSX.Element} The form page layout with sidebar
 */
function FormPage({ children }: { children: React.ReactNode }) {
  return (
    <PageShell showSidebar>
      <div className="app-content">{children}</div>
    </PageShell>
  );
}

/**
 * AppRoutes - Defines all URL-to-page mappings for the application.
 *
 * Each <Route> maps a URL path to a React component. For example:
 *   /dashboard       --> Dashboard component
 *   /personal        --> PersonalPage (taxpayer sub-page)
 *   /income/pensions --> IncomePage (pensions sub-page)
 *
 * The "sub" prop on page components selects which sub-section to display.
 * For example, <PersonalPage sub="children" /> shows the children form section.
 *
 * The catch-all route (path="*") redirects any unknown URL to /dashboard.
 *
 * @returns {JSX.Element} The route definitions for React Router
 */
function AppRoutes() {
  return (
    <Routes>
      {/* Redirect the root URL "/" to the dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Top-level pages that do not use the form layout */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/create-persona" element={<CreatePersonaPage />} />

      {/* Overview page -- has tabs but no sidebar */}
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

      {/* Catch-all: any URL not matched above redirects to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

/**
 * App - The root application component.
 *
 * This is the top-level component rendered by main.tsx. It sets up:
 *
 * 1. HashRouter - Enables client-side routing using URL hashes (e.g., /#/dashboard).
 *    We use hash-based routing so the app works as a static site without
 *    server-side URL rewriting.
 *
 * 2. FormProvider - React Context that holds all tax form data and provides
 *    functions to update it (see FormContext.tsx).
 *
 * 3. SessionProvider - React Context that manages the agent session lifecycle:
 *    creating sessions, tracking status, polling for updates (see SessionContext.tsx).
 *
 * 4. Several "invisible" components that run in the background:
 *    - AgentSSEBridge: listens for real-time events from the backend
 *    - PersonaSync: keeps legacy window globals in sync
 *
 * 5. Global UI components that appear on every page:
 *    - Header: the top bar with branding
 *    - AskUserPopup: modal that appears when the agent needs user input
 *    - AgentStatusBar: shows whether the agent is running, done, or errored
 *    - ScoreCard: displays the final score when the agent finishes
 *
 * @returns {JSX.Element} The fully wrapped application
 */
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
