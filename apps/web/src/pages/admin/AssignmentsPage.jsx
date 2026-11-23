import { useCallback, useState } from 'react';
import { ArrowDownUp, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { useLive } from '../../hooks/useLive';
import Badge from '../../components/Badge';
import ErrorNotice from '../../components/ErrorNotice';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';
import SearchBox from '../../components/SearchBox';

const loadAssignments = async () => {
  const [patients, doctors] = await Promise.all([api('/admin/patients'), api('/admin/doctors')]);
  return { ...patients, ...doctors };
};

export default function AssignmentsPage() {
  const { data, error, refresh } = useLive(loadAssignments);
  const [query, setQuery] = useState('');
  const [patient, setPatient] = useState(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const close = useCallback(() => { if (!pending) setPatient(null); }, [pending]);

  async function submit(event) {
    event.preventDefault(); setPending(true); setFormError('');
    const toDoctorId = new FormData(event.currentTarget).get('toDoctorId');
    try {
      await api(`/admin/patients/${patient.id}/transfer`, { method: 'POST', body: JSON.stringify({ toDoctorId, expectedDoctorId: patient.doctorId }) });
      setSuccess(`${patient.code}: assegnazione aggiornata. Il medico precedente non ha più accesso.`); setPatient(null); await refresh();
    } catch (err) { setFormError(err.message); }
    finally { setPending(false); }
  }
  const filtered = data?.patients.filter(p => `${p.code} ${p.doctor.name}`.toLowerCase().includes(query.toLowerCase())) || [];

  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">OWNERSHIP E CONTINUITÀ</div><h1>Il medico giusto, per ogni paziente.</h1><p>Trasferisci l’assegnazione mantenendo intatto lo storico clinico.</p></div></div>
      <ErrorNotice>{error}</ErrorNotice>
      {success && <div className="notice success" role="status">{success}</div>}
      <section className="panel">
        <div className="panel-heading"><h2>Assegnazioni paziente–medico</h2><SearchBox value={query} onChange={setQuery} placeholder="Cerca codice o medico…" /></div>
        {!data ? <Loading /> : <div className="table-wrap"><table><thead><tr><th>Paziente</th><th>Medico assegnato</th><th>Accesso</th><th><span className="sr-only">Azioni</span></th></tr></thead><tbody>{filtered.map(p => <tr key={p.id}><td className="strong">{p.code}</td><td>{p.doctor.name}</td><td><Badge>Esclusivo</Badge></td><td className="align-right"><button className="text-button" onClick={() => { setFormError(''); setPatient(p); }}><ArrowDownUp size={14} /> Trasferisci</button></td></tr>)}</tbody></table>{!filtered.length && <div className="empty">Nessuna assegnazione trovata.</div>}</div>}
      </section>
      <div className="notice info"><ShieldCheck size={18} /> Questa vista espone solo i metadati amministrativi. Feature e risultati clinici restano riservati al medico assegnato.</div>
      {patient && (
        <Modal title={`Trasferisci ${patient.code}`} subtitle="La modifica revoca l’accesso al medico precedente. Tutti i test restano collegati al paziente." onClose={close}>
          <form onSubmit={submit}>
            <label>Medico attuale<input value={patient.doctor.name} disabled /></label>
            <label>Nuovo medico<select name="toDoctorId" required defaultValue=""><option value="" disabled>Seleziona un medico</option>{data.doctors.filter(d => d.active && d.id !== patient.doctorId).map(d => <option key={d.id} value={d.id}>{d.name} · {d.patientCount} pazienti</option>)}</select></label>
            <ErrorNotice>{formError}</ErrorNotice>
            <div className="modal-actions"><button type="button" className="button secondary" disabled={pending} onClick={close}>Annulla</button><button className="button primary" disabled={pending}>{pending ? 'Trasferimento…' : 'Conferma trasferimento'}</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
