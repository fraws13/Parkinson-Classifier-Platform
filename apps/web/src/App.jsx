import { useEffect, useState } from 'react';
import { api } from './services/api';
import ErrorNotice from './components/ErrorNotice';
import Loading from './components/Loading';
import WorkspaceLayout from './layouts/WorkspaceLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import DoctorsPage from './pages/admin/DoctorsPage';
import AssignmentsPage from './pages/admin/AssignmentsPage';
import PatientsPage from './pages/doctor/PatientsPage';
import PatientDetailPage from './pages/doctor/PatientDetailPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('dashboard');
  const [selected, setSelected] = useState(null);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    api('/auth/me').then(d => setUser(d.user)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => api('/auth/me').catch(error => {
      if (error.status === 401) { setUser(null); setSelected(null); }
    }), 30000);
    return () => clearInterval(timer);
  }, [user]);

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null); setSelected(null); setSessionError('');
    } catch (err) {
      if (err.status === 401) setUser(null);
      else setSessionError('Logout non riuscito. Riprova per chiudere la sessione.');
    }
  }

  if (loading) return <Loading />;
  if (!user) return <LoginPage onLogin={value => {
    setUser(value); setPage(value.role === 'ADMIN' ? 'dashboard' : 'patients'); setSelected(null);
  }} />;

  let content;
  if (user.role === 'ADMIN') {
    content = page === 'doctors' ? <DoctorsPage /> : page === 'assignments' ? <AssignmentsPage /> : <DashboardPage />;
  } else {
    content = selected
      ? <PatientDetailPage key={selected} id={selected} onBack={() => setSelected(null)} />
      : <PatientsPage onSelect={setSelected} />;
  }

  return (
    <WorkspaceLayout user={user} page={page} onNavigate={id => { setPage(id); setSelected(null); }} onLogout={logout}>
      <ErrorNotice>{sessionError}</ErrorNotice>
      {content}
    </WorkspaceLayout>
  );
}
