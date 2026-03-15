export default function Header() {
  return (
    <header className="app-header">
      <div className="app-header-left">
        {/* ZH Coat of Arms - stylized shield */}
        <svg className="app-header-logo" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Canton of Zurich coat of arms">
          <path d="M18 2C10 2 4 6 4 6v18c0 4 6 10 14 10s14-6 14-10V6s-6-4-14-4z" fill="#fff"/>
          <path d="M4 6v18c0 4 6 10 14 10s14-6 14-10V6" stroke="#1a4a6e" strokeWidth="1.5" fill="none"/>
          <rect x="8" y="8" width="20" height="5" rx="1" fill="#1a4a6e"/>
          <rect x="8" y="16" width="20" height="5" rx="1" fill="#1a4a6e"/>
          <rect x="8" y="24" width="20" height="5" rx="1" fill="#1a4a6e"/>
          <rect x="8" y="12" width="20" height="5" rx="1" fill="#fff"/>
          <rect x="8" y="20" width="20" height="5" rx="1" fill="#fff"/>
        </svg>
        <span className="app-header-title">
          <strong>ZHprivateTax</strong> &rsaquo; Steuererklärung 2025 (AHVN13 DEMO)
        </span>
      </div>
      {/* Wegleitung toggle and Abmelden button removed for demo */}
    </header>
  );
}
