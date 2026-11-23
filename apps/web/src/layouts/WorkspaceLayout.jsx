import { ArrowDownUp, ChevronRight, HeartPulse, LayoutDashboard, LogOut, ShieldCheck, Stethoscope, Users } from 'lucide-react';

export default function WorkspaceLayout({ user, page, onNavigate, onLogout, children }) {
  const isAdmin = user.role === 'ADMIN';
  const nav = isAdmin
    ? [
      { id: 'dashboard', label: 'Panoramica', icon: LayoutDashboard },
      { id: 'doctors', label: 'Medici', icon: Stethoscope },
      { id: 'assignments', label: 'Assegnazioni', icon: ArrowDownUp },
    ]
    : [{ id: 'patients', label: 'I miei pazienti', icon: Users }];

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><HeartPulse /></span><span>parkinson<span className="brand-dot">.</span></span></div>
        <div className="workspace-label">CLINICAL WORKSPACE</div>
        <div className="role-tag"><ShieldCheck size={14} /> {isAdmin ? 'Amministrazione' : 'Area medico'}</div>
        <nav aria-label="Navigazione principale">
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} className={(isAdmin ? page === id : true) ? 'active' : ''} onClick={() => onNavigate(id)}>
              <span className="nav-number" aria-hidden="true">0{nav.findIndex(item => item.id === id) + 1}</span><Icon size={19} />{label}
              {(isAdmin ? page === id : true) && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note"><span className="live-dot" /><strong>Ambiente dimostrativo</strong><p>Dati PaHaW · baseline didattica<br />SLA cloud come obiettivi.</p></div>
        <div className="profile">
          <span className="avatar">{user.name.split(' ').slice(-2).map(s => s[0]).join('')}</span>
          <div><strong>{user.name}</strong><small>{isAdmin ? 'Amministratore unico' : 'Medico'}</small></div>
          <button className="icon-button" onClick={onLogout} title="Esci" aria-label="Esci dal workspace"><LogOut size={18} /></button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div><span>Workspace</span><ChevronRight size={14} /><strong>{isAdmin ? nav.find(n => n.id === page)?.label || 'Panoramica' : 'Area clinica'}</strong></div>
          <div className="topbar-meta"><span className="secure-label"><ShieldCheck size={15} /> Sessione autenticata</span><span className="group-label">GROUP 2</span></div>
        </header>
        <main className="content">
          {children}
          <footer className="page-footer"><span>Parkinson Clinical Workspace</span><span>Group 2 · Secure Cloud Computing 26/27</span></footer>
        </main>
      </div>
    </div>
  );
}
