import { useNavigate } from 'react-router-dom';
import { useForm } from '../context/FormContext';
import FormField from '../components/FormField';

export default function LoginPage() {
  const { setLoggedIn } = useForm();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoggedIn(true);
    navigate('/overview');
  };

  return (
    <div className="app-content full-width">
      <form className="login-container" onSubmit={handleLogin}>
        <h1>ZHprivateTax 2025</h1>
        <p>Kanton Zürich &mdash; Steuererklärung Simulator</p>
        <FormField page="login" section="auth" name="ahvnumber" label="AHV Number" required />
        <FormField page="login" section="auth" name="zugangscode" label="Access Code (Zugangscode)" type="text" required />
        <button className="btn-primary" type="submit" id="login-submit">
          Anmelden
        </button>
      </form>
    </div>
  );
}
