import { useState } from 'react';
import { api } from '../services/api';
import ErrorNotice from './ErrorNotice';
import { featureLabels } from '../utils/features';

export default function AssessmentForm({ patientId, featureSchema, onSaved, onCancel }) {
  const [values, setValues] = useState({});
  const [task, setTask] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault(); setError('');
    const features = Object.fromEntries(featureSchema.feature_names.map(name => [name, values[name] === undefined || values[name] === '' ? null : Number(values[name])]));
    if (!Object.values(features).some(v => v !== null)) return setError('Inserisci almeno una misura numerica.');
    if (Object.values(features).some(v => v !== null && !Number.isFinite(v))) return setError('Inserisci numeri validi.');
    setPending(true);
    try {
      const result = await api(`/clinical/patients/${patientId}/assessments`, { method: 'POST', body: JSON.stringify({ features }) });
      onSaved(result.assessment);
    } catch (err) { setError(err.message); }
    finally { setPending(false); }
  }

  const completed = Object.values(values).filter(v => v !== '').length;
  return <section className="panel assessment-form"><div className="panel-heading"><div><h2>Nuovo test grafomotorio</h2><p>{completed} / 63 misure inserite. I campi vuoti saranno imputati dal modello: compila più dati possibile.</p></div></div><div className="task-tabs">{['Spirale', 'Lettera “l”', 'Bigramma “le”'].map((label, index) => <button type="button" key={label} className={task === index + 1 ? 'active' : ''} onClick={() => setTask(index + 1)}>{label}</button>)}</div><form onSubmit={submit}><div className="features-grid">{featureSchema.feature_names.filter(name => name.startsWith(`t${task}_`)).map(name => <label key={name}>{featureLabels[name.slice(3)] || name}{name.endsWith('_pct') ? ' (0–1)' : name.endsWith('_ms') ? ' (ms)' : ''}<input type="number" step="any" name={name} value={values[name] ?? ''} placeholder="Non disponibile" onChange={event => setValues(current => ({ ...current, [name]: event.target.value }))} /></label>)}</div><ErrorNotice>{error}</ErrorNotice><div className="form-actions"><button type="button" className="button secondary" onClick={onCancel} disabled={pending}>Annulla</button><button className="button primary" disabled={pending}>{pending ? 'Salvataggio…' : 'Salva test'}</button></div></form></section>;
}
