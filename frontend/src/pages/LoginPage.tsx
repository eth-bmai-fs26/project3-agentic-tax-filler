/**
 * @file LoginPage.tsx
 *
 * This page simulates the login screen of the official ZHprivateTax system
 * (Zurich canton's online tax filing portal). In the real system, taxpayers
 * log in using their AHV number (Swiss social security number) and an
 * access code they receive by mail.
 *
 * IMPORTANT: This is a simulation only -- there is no actual authentication.
 * The AHV number and access code fields are just for visual realism.
 * Clicking "Anmelden" (German for "Log in") simply sets the logged-in
 * state to true and navigates to the overview page.
 *
 * This page is shown when the user is inside the tax form interface
 * (as opposed to the Dashboard which is the persona selection screen).
 */

import { useNavigate } from 'react-router-dom';
import { useForm } from '../context/FormContext';
import FormField from '../components/FormField';

/**
 * LoginPage - A simulated login screen for the tax filing system.
 *
 * This component does NOT perform real authentication. It merely:
 * 1. Renders a login form with AHV number and access code fields
 * 2. On submit, sets the "loggedIn" flag in FormContext to true
 * 3. Navigates to the overview page
 *
 * The form fields use the same FormField component as the rest of the app,
 * but they are stored under the "login.auth" section of the form data
 * (which is separate from the actual tax return data).
 *
 * @returns The login page UI
 */
export default function LoginPage() {
  /** setLoggedIn comes from FormContext -- it controls whether the
      user sees the login screen or the main tax form interface */
  const { setLoggedIn } = useForm();
  const navigate = useNavigate();

  /**
   * Handles the login form submission.
   * Prevents the default form submit behavior (which would reload the page),
   * marks the user as logged in, and navigates to the overview page.
   *
   * @param e - The form submit event
   */
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoggedIn(true);
    navigate('/overview');
  };

  return (
    <div className="app-content full-width">
      <form className="login-container" onSubmit={handleLogin}>
        <h1>ZHprivateTax 2025</h1>
        {/* "Steuererklärung Simulator" means "Tax Return Simulator" in German */}
        <p>Kanton Zürich &mdash; Steuererklärung Simulator</p>
        {/* These fields store their values in form data under login.auth,
            but the values are not actually used for authentication */}
        <FormField page="login" section="auth" name="ahvnumber" label="AHV Number" required />
        <FormField page="login" section="auth" name="zugangscode" label="Access Code (Zugangscode)" type="text" required />
        {/* "Anmelden" is German for "Log in" / "Sign in" */}
        <button className="btn-primary" type="submit" id="login-submit">
          Anmelden
        </button>
      </form>
    </div>
  );
}
