import { useState, useEffect } from 'react';
import zurichLogo from '../assets/ZurichLogo-white.png';

export default function Header() {
  const [persona, setPersona] = useState('No persona set');

  useEffect(() => {
    (window as any).__taxPortalSetPersona = (name: string) => setPersona(name);
    return () => { delete (window as any).__taxPortalSetPersona; };
  }, []);

  return (
    <header className="app-header">
      <div className="app-header-left">
        <img className="app-header-logo" src={zurichLogo} alt="Canton of Zurich coat of arms" />
        <span className="app-header-title">
          <strong>ZHprivateTax</strong> &rsaquo; Declaration 2025 - {persona}
        </span>
      </div>
      {/* Wegleitung toggle and Abmelden button removed for demo */}
    </header>
  );
}
