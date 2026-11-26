import { useCallback, useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useLive } from '../../hooks/useLive';
import Badge from '../../components/Badge';
import ErrorNotice from '../../components/ErrorNotice';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';

const loadDoctors = () => api('/admin/doctors');

export default function DoctorsPage() {
  const { data, error, refresh } = useLive(loadDoctors);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState('');
  const [doctorToDelete, setDoctorToDelete] = useState(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const close = useCallback(() => { if (!pending) setOpen(false); }, [pending]);

  async function submit(event) {
    event.preventDefault(); setFormError(''); setPending(true);
    try {
      await api('/admin/doctors', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      setOpen(false); setSuccess('Medico registrato. Comunica la password iniziale tramite un canale sicuro.'); await refresh();
    } catch (err) {
      setFormError(err.fields?.length ? 'Controlla i campi: nome valido, email e password di almeno 12 caratteri.' : err.message);
    } finally { setPending(false); }
  }

  async function deleteDoctor() {
    if (!doctorToDelete || deletePending) return;
    setDeletePending(true);
    setDeleteError('');
    try {
      await api(`/admin/doctors/${doctorToDelete.id}`, { method: 'DELETE' });
      setDoctorToDelete(null);
      setSuccess('Medico eliminato.');
      await refresh();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">GESTIONE ACCESSI</div><h1>Il team clinico.</h1><p>Registra i medici e consulta il loro carico di pazienti.</p></div><button className="button primary" onClick={() => { setFormError(''); setOpen(true); }}><Plus size={17} /> Registra medico</button></div>
      <ErrorNotice>{error}</ErrorNotice>
      {success && <div className="notice success" role="status">{success}</div>}
      <section className="panel">
        <div className="panel-heading"><h2>Medici registrati</h2><Badge>{data?.doctors.length || 0} account</Badge></div>
        {!data ? <Loading /> : <div className="table-wrap"><table><thead><tr><th>Medico</th><th>Username</th><th>Email</th><th>Pazienti</th><th>Stato</th><th><span className="sr-only">Azioni</span></th></tr></thead><tbody>{data.doctors.map(d => <tr key={d.id}><td className="strong">{d.name}</td><td>{d.username || '—'}</td><td>{d.email}</td><td>{d.patientCount}</td><td><Badge tone={d.active ? 'green' : 'amber'}>{d.active ? 'Attivo' : 'Disattivato'}</Badge></td><td className="align-right"><button className="icon-button danger-action" title={`Elimina ${d.name}`} aria-label={`Elimina ${d.name}`} onClick={() => { setDeleteError(''); setDoctorToDelete(d); }}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>}
      </section>
      <div className="notice info"><ShieldCheck size={18} /> Un solo amministratore di sistema. I nuovi account hanno esclusivamente il ruolo di medico.</div>
      {open && (
        <Modal title="Registra un medico" subtitle="Il nuovo account vedrà soltanto i pazienti che gli saranno assegnati." onClose={close}>
          <form onSubmit={submit}>
            <label>Nome e cognome<input name="name" required minLength={2} maxLength={100} placeholder="Dott.ssa Anna Conti" /></label>
            <label>Username<input name="username" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9._-]+" autoComplete="off" placeholder="medic4" /></label>
            <label>Email<input name="email" type="email" required maxLength={254} autoComplete="off" placeholder="anna.conti@studio.it" /></label>
            <label>Password iniziale<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" placeholder="Almeno 12 caratteri" /></label>
            <ErrorNotice>{formError}</ErrorNotice>
            <div className="modal-actions"><button type="button" className="button secondary" disabled={pending} onClick={close}>Annulla</button><button className="button primary" disabled={pending}>{pending ? 'Registrazione…' : 'Crea account'}</button></div>
          </form>
        </Modal>
      )}
      {doctorToDelete && <Modal title="Elimina medico" subtitle={`Eliminando ${doctorToDelete.name} verrà rimosso l’account e verranno revocate le sue sessioni.`} onClose={() => { if (!deletePending) setDoctorToDelete(null); }}><div className="notice error"><Trash2 size={18} /><span>L’operazione è consentita solo per medici senza pazienti assegnati e senza attività cliniche nello storico.</span></div><ErrorNotice>{deleteError}</ErrorNotice><div className="modal-actions"><button type="button" className="button secondary" disabled={deletePending} onClick={() => setDoctorToDelete(null)}>Annulla</button><button type="button" className="button danger" disabled={deletePending} onClick={deleteDoctor}>{deletePending ? 'Eliminazione…' : 'Elimina medico'}</button></div></Modal>}
    </>
  );
}
