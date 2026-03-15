import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
// import { useForm } from './context/FormContext';
import Header from './components/Header';
import TabNav from './components/TabNav';
import Sidebar from './components/Sidebar';
// import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import PersonalPage from './pages/PersonalPage';
import IncomePage from './pages/IncomePage';
import DeductionsPage from './pages/DeductionsPage';
import WealthPage from './pages/WealthPage';
import AttachmentsPage from './pages/AttachmentsPage';
import ReviewPage from './pages/ReviewPage';
// import DataImportPage from './pages/DataImportPage';
// import AdminPage from './pages/AdminPage';

/* Login is commented out for demo — all routes are accessible directly */
// function ProtectedRoute({ children, showSidebar = false }: { children: React.ReactNode; showSidebar?: boolean }) {
//   const { isLoggedIn } = useForm();
//   if (!isLoggedIn) return <Navigate to="/" replace />;
//   return (
//     <>
//       <TabNav />
//       <div className="app-body">
//         {showSidebar && <Sidebar />}
//         {children}
//       </div>
//     </>
//   );
// }

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
      {/* Login commented out for demo — go straight to overview */}
      {/* <Route path="/" element={
        isLoggedIn ? <Navigate to="/overview" replace /> : (
          <div className="app-body"><LoginPage /></div>
        )
      } /> */}
      <Route path="/" element={<Navigate to="/overview" replace />} />

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

      {/* Data Import & Admin tabs removed for demo */}
      {/* <Route path="/dataimport" element={...} /> */}
      {/* <Route path="/admin" element={...} /> */}

      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Header />
      <AppRoutes />
    </HashRouter>
  );
}
