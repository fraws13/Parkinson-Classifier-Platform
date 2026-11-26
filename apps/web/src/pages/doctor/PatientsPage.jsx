import { useCallback, useState } from 'react';
import { ChevronRight, CircleHelp, FileHeart, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { api } from '../../services/api';
import { useLive } from '../../hooks/useLive';
import Badge from '../../components/Badge';
import ErrorNotice from '../../components/ErrorNotice';
import Loading from '../../components/Loading';
import SearchBox from '../../components/SearchBox';
import StatCard from '../../components/StatCard';
import Modal from '../../components/Modal';

const loadClinical = () => api('/clinical/patients');

export default function PatientsPage({ onSelect }) {
  const { data, error, refresh } = useLive(loadClinical);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState('');
  const [patientToDelete, setPatientToDelete] = useState(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const close = useCallback(() => { if (!pending) setOpen(false); }, [pending]);
  const patients = data?.patients.filter(p => `${p.code} ${p.name || ''}`.toLowerCase().includes(query.toLowerCase())) || [];

  async function createPatient(event) {
    event.preventDefault(); setPending(true); setFormError('');
    const name = new FormData(event.currentTarget).get('name');
    try {
      const result = await api('/clinical/patients', { method: 'POST', body: JSON.stringify({ name }) });
      setOpen(false); await refresh(); onSelect(result.patient.id);
    } catch (err) { setFormError(err.message); }
    finally { setPending(false); }
  }

  async function deletePatient() {
    if (!patientToDelete || deletePending) return;
    setDeletePending(true);
    setDeleteError('');
    try {
      await api(`/clinical/patients/${patientToDelete.id}`, { method: 'DELETE' });
      setPatientToDelete(null);
      await refresh();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">AREA CLINICA RISERVATA</div><h1>Le persone di cui ti prendi cura.</h1><p>Solo soggetti di training e pazienti inseriti manualmente, assegnati a te.</p></div><button className="button primary" onClick={() => { setFormError(''); setOpen(true); }}><Plus size={17} /> Aggiungi paziente</button></div>
      <ErrorNotice>{error}</ErrorNotice>
      <div className="stats clinical-stats">
        <StatCard icon={Users} title="I tuoi pazienti" value={data?.patients.length ?? '—'} note="Assegnazioni correnti" accent="featured" />
        <StatCard icon={FileHeart} title="Test disponibili" value={data ? data.patients.reduce((n, p) => n + p.assessmentCount, 0) : '—'} note="Feature dei tre task grafomotori" />
        <StatCard icon={ShieldCheck} title="Dati di riferimento" value="PaHaW" note="Demo · non nuove diagnosi" />
      </div>
      <section className="panel">
        <div className="panel-heading"><div><h2>Cartelle paziente</h2><p>Apri una cartella per consultare i dati dei test</p></div><SearchBox value={query} onChange={setQuery} placeholder="Cerca codice paziente…" /></div>
        {!data ? <Loading /> : <div className="table-wrap"><table><thead><tr><th>Paziente</th><th>Test</th><th>Classe / riferimento</th><th><span className="sr-only">Azioni</span></th></tr></thead><tbody>{patients.map(p => <tr key={p.id}><td className="strong">{p.name || p.code}<small className="patient-code">{p.name ? p.code : 'Dataset training'}</small></td><td>{p.assessmentCount} test</td><td>{p.latestAssessment?.predictedLabel ? <Badge tone="green">Classe predetta: {p.latestAssessment.predictedLabel}</Badge> : p.latestAssessment?.referenceLabel ? <Badge>Riferimento dataset: {p.latestAssessment.referenceLabel}</Badge> : <Badge>Da classificare</Badge>}</td><td className="align-right patient-actions"><button className="text-button" onClick={() => onSelect(p.id)}>Apri cartella <ChevronRight size={16} /></button>{p.sourceSubjectId === null && <button className="icon-button danger-action" title={`Elimina ${p.name || p.code}`} aria-label={`Elimina ${p.name || p.code}`} onClick={() => { setDeleteError(''); setPatientToDelete(p); }}><Trash2 size={16} /></button>}</td></tr>)}</tbody></table>{!patients.length && <p className="empty">Nessun paziente assegnato o corrispondente alla ricerca.</p>}</div>}
      </section>
      <div className="notice info"><CircleHelp size={18} /> H = controllo sano · PD = Parkinson nel dataset di riferimento. Le etichette importate non sono predizioni generate dall’app.</div>
      {open && <Modal title="Aggiungi un paziente" subtitle="Il paziente sarà assegnato automaticamente al tuo account. Aggiungi poi le misurazioni dei tre esercizi per classificarlo." onClose={close}><form onSubmit={createPatient}><label>Nome e cognome<input name="name" required minLength={2} maxLength={100} placeholder="Nome del paziente demo" /></label><ErrorNotice>{formError}</ErrorNotice><div className="modal-actions"><button type="button" className="button secondary" disabled={pending} onClick={close}>Annulla</button><button className="button primary" disabled={pending}>{pending ? 'Creazione…' : 'Crea paziente'}</button></div></form></Modal>}
      {patientToDelete && <Modal title="Elimina paziente" subtitle={`Eliminando ${patientToDelete.name || patientToDelete.code} verranno eliminati anche tutti i test e i risultati collegati.`} onClose={() => { if (!deletePending) setPatientToDelete(null); }}><div className="notice error"><Trash2 size={18} /><span>Questa operazione è permanente e non può essere annullata.</span></div><ErrorNotice>{deleteError}</ErrorNotice><div className="modal-actions"><button type="button" className="button secondary" disabled={deletePending} onClick={() => setPatientToDelete(null)}>Annulla</button><button type="button" className="button danger" disabled={deletePending} onClick={deletePatient}>{deletePending ? 'Eliminazione…' : 'Elimina paziente'}</button></div></Modal>}
    </>
  );
}
