import { useState } from 'react';
import { ArrowRight, CircleHelp, HeartPulse, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import Badge from '../components/Badge';
import ErrorNotice from '../components/ErrorNotice';

export default function LoginPage({ onLogin }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault(); setError(''); setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) });
      onLogin(result.user);
    } catch (err) { setError(err.message); }
    finally { setPending(false); }
  }

  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand"><span className="brand-mark"><HeartPulse /></span><span>parkinson<span className="brand-dot">.</span></span></div>
        <div>
          <div className="eyebrow">CLINICAL DECISION SUPPORT</div>
          <h1>Parkinson’s<br />disease<br /><span>classification.</span></h1>
          <p>Un unico spazio per i tuoi pazienti, i test grafomotori e una gestione clinica consapevole.</p>
          <div className="login-project-meta"><span>TRACK 2 — CLOUD ML SAAS</span><span>GROUP 2 · SECURE CLOUD COMPUTING 26/27</span></div>
        </div>
        <div className="login-foot"><ShieldCheck size={18} /> Accesso riservato · Dati segregati per medico</div>
      </section>
      <main className="login-form">
        <div className="login-card">
          <Badge tone="green">WORKSPACE DIMOSTRATIVO</Badge>
          <h2>Bentornato.</h2>
          <p className="muted">Accedi con il tuo account per continuare.</p>
          <form onSubmit={submit}>
            <label>Username<input name="username" autoComplete="username" placeholder="admin oppure medic" required maxLength={254} /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" placeholder="La tua password" required maxLength={128} /></label>
            <ErrorNotice>{error}</ErrorNotice>
            <button className="button primary full" disabled={pending}>{pending ? 'Accesso in corso…' : 'Accedi al workspace'}<ArrowRight size={17} /></button>
          </form>
          <p className="login-disclaimer"><CircleHelp size={17} /> Gli account sono creati dall’amministratore. Questo prototipo non sostituisce una diagnosi clinica.</p>
        </div>
        <small>GROUP 2 · SECURE CLOUD COMPUTING 26/27</small>
      </main>
    </div>
  );
}
