import { useState } from 'react';
import { api } from '../services/api';
import ErrorNotice from './ErrorNotice';
import { featureLabels } from '../utils/features';
import { measurementIssue } from '../utils/assessmentImport';

const tasks = ['Spirale', 'Lettera “l”', 'Bigramma “le”'];

export default function AssessmentForm({
  patientId, featureSchema, values, onChange, importing, saving, onSavingChange, onSaved, onCancel,
}) {
  const [task, setTask] = useState(1);
  const [error, setError] = useState('');
  const busy = saving || importing;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const features = Object.fromEntries(featureSchema.feature_names.map(name => {
      const value = values[name];
      return [name, value == null || value === '' ? null : Number(value)];
    }));
    if (!Object.values(features).some(v => v !== null)) return setError('Inserisci almeno una misura numerica.');
    for (const [name, value] of Object.entries(features)) {
      const issue = measurementIssue(name, value);
      if (issue) {
        setTask(Number(name[1]));
        return setError(`${name}: ${issue}.`);
      }
    }
    onSavingChange(true);
    try {
      const result = await api(`/clinical/patients/${patientId}/assessments`, { method: 'POST', body: JSON.stringify({ features }) });
      await onSaved(result.assessment);
    } catch (err) { setError(err.message); }
    finally { onSavingChange(false); }
  }

  const completed = Object.values(values).filter(v => v !== '').length;
  return (
    <section className="panel assessment-form" aria-labelledby="new-assessment-title">
      <div className="panel-heading">
        <div>
          <h2 id="new-assessment-title">Nuovo test grafomotorio</h2>
          <p>{completed} / {featureSchema.feature_names.length} misure inserite. I campi vuoti saranno imputati dal modello.</p>
        </div>
      </div>
      <div className="task-tabs" aria-label="Sezioni del nuovo test" role="tablist">
        {tasks.map((label, index) => (
          <button type="button" role="tab" key={label} className={task === index + 1 ? 'active' : ''} aria-selected={task === index + 1} onClick={() => setTask(index + 1)}>{label}</button>
        ))}
      </div>
      <form onSubmit={submit}>
        <div className="features-grid">
          {featureSchema.feature_names.filter(name => name.startsWith(`t${task}_`)).map(name => (
            <label key={name}>
              {featureLabels[name.slice(3)] || name}{name.endsWith('_pct') ? ' (0–1)' : name.endsWith('_ms') ? ' (ms)' : ''}
              <input type="number" step="any" name={name} value={values[name] ?? ''} placeholder="Non disponibile" disabled={busy} onChange={event => {
                setError('');
                onChange(name, event.target.value);
              }} />
            </label>
          ))}
        </div>
        <ErrorNotice>{error}</ErrorNotice>
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onCancel} disabled={busy}>Annulla</button>
          <button className="button primary" disabled={busy}>{saving ? 'Salvataggio…' : 'Salva test'}</button>
        </div>
      </form>
    </section>
  );
}
