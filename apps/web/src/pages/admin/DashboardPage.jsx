import { Activity, ArrowDownUp, Check, CircleHelp, Clock3, RefreshCw, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { api } from '../../services/api';
import { useLive } from '../../hooks/useLive';
import { date, number } from '../../utils/format';
import Badge from '../../components/Badge';
import ErrorNotice from '../../components/ErrorNotice';
import Loading from '../../components/Loading';
import StatCard from '../../components/StatCard';

const loadDashboard = () => api('/admin/dashboard');
const eventLabels = { DEMO_IMPORTED: 'Dataset dimostrativo importato', DOCTOR_REGISTERED: 'Nuovo medico registrato', PATIENT_TRANSFERRED: 'Paziente riassegnato' };

function SlaRow({ label, value, status }) {
  return <div className="sla-row"><div><span>{label}</span><small>{status}</small></div><strong>{value}</strong></div>;
}

export default function DashboardPage() {
  const { data, error, refresh } = useLive(loadDashboard);
  if (!data) return error ? <ErrorNotice>{error}</ErrorNotice> : <Loading />;
  const { counts, doctors, telemetry: t, targets } = data;
  const maxPatients = Math.max(...doctors.map(d => d.patientCount), 1);

  return (
    <>
      <div className="page-heading">
        <div><div className="eyebrow">PANORAMICA DEL SISTEMA</div><h1>Ogni dato, al suo posto.</h1><p>Persone, assegnazioni e salute del servizio in un’unica vista.</p></div>
        <button className="button secondary" onClick={refresh}><RefreshCw size={16} /> Aggiorna</button>
      </div>
      <ErrorNotice>{error}</ErrorNotice>
      <div className="live-line"><span className="live-dot" /> {error ? 'Connessione da verificare' : 'Aggiornamento automatico ogni 5 secondi'}<span>Ultima lettura: {date(data.generatedAt)}</span></div>
      <div className="stats">
        <StatCard icon={Users} title="Pazienti assegnati" value={counts.patients} note="Training e inserimenti manuali" accent="featured" />
        <StatCard icon={Stethoscope} title="Medici nel workspace" value={counts.doctors} note="Accesso clinico segregato" />
        <StatCard icon={Clock3} title="Latenza API · p95" value={t.p95LatencyMs === null ? '—' : `${number(t.p95LatencyMs)} ms`} note="Misura server · ultimi 60 secondi" />
        <StatCard icon={ArrowDownUp} title="Trasferimenti" value={counts.transfers} note="Riassegnazioni registrate" />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading"><div><h2>Pazienti per medico</h2><p>Distribuzione attuale delle assegnazioni</p></div><Badge>{doctors.length} medici</Badge></div>
          <div className="doctor-bars">
            {doctors.map((d, i) => (
              <div className="doctor-bar" key={d.id}>
                <span className={`avatar shade-${i % 3}`}>{d.name.split(' ').slice(-2).map(s => s[0]).join('')}</span>
                <div><div className="bar-label"><span>{d.name}</span><strong>{d.patientCount} <small>pazienti</small></strong></div><div className="bar-track"><span style={{ width: `${d.patientCount / maxPatients * 100}%` }} /></div></div>
              </div>
            ))}
          </div>
          {!doctors.length && <p className="empty">Nessun medico registrato.</p>}
          <div className="panel-footer"><ShieldCheck size={15} /> Ogni paziente ha un solo medico assegnato.</div>
        </section>
        <section className="panel service-panel">
          <div className="panel-heading"><div><h2>Stato del servizio</h2><p>Osservazioni del processo corrente</p></div><Activity size={20} /></div>
          <div className="service-number">{number(t.requestsLastMinute)}<span>richieste / ultimo minuto</span></div>
          <div className="service-row"><span>Latenza media / p99</span><strong>{t.meanLatencyMs === null ? '—' : `${number(t.meanLatencyMs)} / ${number(t.p99LatencyMs)} ms`}</strong></div>
          <div className="service-row"><span>Risposte senza errori 5xx</span><strong>{t.successfulServerResponsesPct === null ? '—' : `${number(t.successfulServerResponsesPct)}%`}</strong></div>
          <div className="service-row"><span>Tempo dall’avvio</span><strong>{number(Math.floor(t.uptimeSeconds / 60))} min</strong></div>
          <p className="micro-note">Metriche in memoria, azzerate al riavvio. Non misurano l’uptime esterno o l’accuratezza del modello.</p>
        </section>
        <section className="panel sla-panel">
          <div className="panel-heading"><div><h2>Obiettivi di progetto</h2><p>SLA target cloud · non certificati dall’MVP locale</p></div><Badge tone="amber">TARGET</Badge></div>
          <div className="sla-list">
            <SlaRow label="Tempo di risposta end-to-end" value="≤ 1 secondo" status={t.p95LatencyMs === null ? 'In attesa di misure API' : `API p95: ${number(t.p95LatencyMs)} ms · rete esclusa`} />
            <SlaRow label="Carico di picco" value={`${number(targets.requestsPerMinute)} req/min`} status="Capacità da verificare con stress test" />
            <SlaRow label="Disponibilità / affidabilità" value="≥ 99,5%" status="Monitoraggio esterno e storico non collegati" />
            <SlaRow label="Interruzioni · massima / media" value="30 / 3 minuti" status="Non misurate da questo processo" />
            <SlaRow label="Finestra operativa" value="Lun–Ven · 08–18" status="Fuso operativo da configurare" />
            <SlaRow label="Base utenti target" value="50.000" status="Non equivale agli account attualmente registrati" />
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading"><div><h2>Attività recenti</h2><p>Registro delle operazioni amministrative</p></div><ShieldCheck size={20} /></div>
          <div className="events">{data.events.map(e => <div className="event" key={e.id}><span className="event-icon"><Check size={14} /></span><div><strong>{eventLabels[e.action] || e.action}</strong><p>{e.actor.name}</p><small>{date(e.createdAt)}</small></div></div>)}</div>
        </section>
      </div>
      <div className="notice info"><CircleHelp size={18} /><span><strong>Confini della versione.</strong> {data.limitations.inference} La latenza osservata è server-side; non include rete e rendering browser.</span></div>
    </>
  );
}
