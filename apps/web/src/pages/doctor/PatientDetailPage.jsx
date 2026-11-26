import { useCallback, useRef, useState } from 'react';
import { CircleHelp, FileHeart, Plus, ShieldCheck, Upload } from 'lucide-react';
import { api } from '../../services/api';
import { useLive } from '../../hooks/useLive';
import { date, number } from '../../utils/format';
import Badge from '../../components/Badge';
import ErrorNotice from '../../components/ErrorNotice';
import Loading from '../../components/Loading';
import AssessmentForm from '../../components/AssessmentForm';
import { featureLabels } from '../../utils/features';
import { readAssessmentJson } from '../../utils/assessmentImport';

export default function PatientDetailPage({ id, onBack }) {
  const load = useCallback(() => api(`/clinical/patients/${id}`), [id]);
  const { data, error, refresh } = useLive(load);
  const [task, setTask] = useState(1);
  const [assessmentId, setAssessmentId] = useState('');
  const fileInput = useRef(null);
  const [draft, setDraft] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState(null);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [predictionError, setPredictionError] = useState('');
  const [result, setResult] = useState(null);

  function closeDraft() {
    setDraft(null);
    setImportFeedback(null);
  }

  async function importJson(event) {
    const file = event.currentTarget.files[0];
    event.currentTarget.value = '';
    if (!file || importing || savingAssessment) return;

    setImporting(true);
    setImportFeedback(null);
    try {
      const { importedValues, issues } = await readAssessmentJson(file, data.featureSchema.feature_names);
      const count = Object.keys(importedValues).length;
      if (count) {
        setDraft(current => ({ ...current, ...importedValues }));
        setResult(null);
      }
      setImportFeedback({ count, issues });
    } catch (err) {
      setImportFeedback({ error: err.message });
    } finally {
      setImporting(false);
    }
  }

  async function predict(assessment) {
    setPredicting(true); setPredictionError(''); setResult(null);
    try {
      const response = await api(`/clinical/patients/${id}/assessments/${assessment.id}/predict`, { method: 'POST' });
      setResult({ ...response, assessmentId: assessment.id }); await refresh();
    } catch (err) { setPredictionError(err.message); }
    finally { setPredicting(false); }
  }
  // Never retain clinical content on screen after a failed ownership recheck.
  if (error) return <><button className="text-button" onClick={onBack}>← Torna ai pazienti</button><ErrorNotice>{error}</ErrorNotice></>;
  if (!data) return <Loading />;
  const { patient } = data;
  const assessment = patient.assessments.find(a => a.id === assessmentId) || patient.assessments[0];

  return (
    <>
      <button className="text-button back-button" onClick={onBack}>← Tutti i pazienti</button>
      <div className="page-heading">
        <div><div className="eyebrow">CARTELLA CLINICA · {patient.datasetSplit === 'TRAIN' ? 'DATASET TRAINING' : 'PAZIENTE MANUALE'}</div><h1>{patient.name || patient.code}</h1><p>{patient.code} · Test grafomotori del paziente assegnato.</p></div>
        <div className="assessment-actions">
          <button type="button" className="button secondary" onClick={() => { setDraft({}); setImportFeedback(null); setResult(null); }} disabled={draft !== null || importing}><Plus size={16} /> Aggiungi test</button>
          {patient.sourceSubjectId === null && (
            <>
              <button type="button" className="button secondary" onClick={() => fileInput.current?.click()} disabled={importing || savingAssessment}><Upload size={16} /> {importing ? 'Lettura JSON…' : 'Importa JSON'}</button>
              <input ref={fileInput} type="file" accept=".json,application/json" aria-label="File JSON del test" hidden onChange={importJson} />
            </>
          )}
        </div>
      </div>
      <Badge tone="green"><ShieldCheck size={13} /> Accesso autorizzato</Badge>
      {importFeedback?.count > 0 && <div className="notice success" role="status">{importFeedback.count} misure importate. Controlla le tre sezioni e premi Salva test.</div>}
      <ErrorNotice>{importFeedback?.error || (importFeedback?.count === 0 && !(importFeedback?.issues?.length) ? 'Il file non contiene misure numeriche da importare.' : null)}</ErrorNotice>
      {importFeedback?.issues?.length > 0 && (
        <div className="notice error import-issues" role="alert">
          <div>
            <strong>Campi da correggere nel JSON</strong>
            <ul>{importFeedback.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
          </div>
        </div>
      )}
      {draft !== null && (
        <AssessmentForm
          patientId={id}
          featureSchema={data.featureSchema}
          values={draft}
          onChange={(name, value) => setDraft(current => ({ ...current, [name]: value }))}
          importing={importing}
          saving={savingAssessment}
          onSavingChange={setSavingAssessment}
          onCancel={closeDraft}
          onSaved={async saved => { closeDraft(); setAssessmentId(saved.id); setResult(null); await refresh(); }}
        />
      )}
      <ErrorNotice>{predictionError}</ErrorNotice>
      {result && result.assessmentId === assessment?.id && <div className="notice success" role="status">Classe di appartenenza predetta: <strong>{result.label === 'PD' ? 'PD · Parkinson' : 'H · Controllo sano'}</strong></div>}
      {!assessment ? draft === null && <div className="empty">Nessun test disponibile. Aggiungi le misurazioni per usare Predict.</div> : (
        <>
          <div className="result-banner">
            <span className="result-icon"><FileHeart size={28} /></span>
            <div><span className="eyebrow">{assessment.predictedLabel ? 'CLASSE PREDETTA DAL MODELLO' : assessment.referenceLabel ? 'ETICHETTA NOTA DEL DATASET' : 'CLASSIFICAZIONE NON ESEGUITA'}</span><h2>{(assessment.predictedLabel || assessment.referenceLabel) === 'PD' ? 'PD · Parkinson' : (assessment.predictedLabel || assessment.referenceLabel) === 'H' ? 'H · Controllo sano' : 'Da classificare'}</h2><p>{assessment.predictedLabel ? `Modello: ${assessment.modelVersion} · ${date(assessment.predictedAt)}` : assessment.referenceLabel ? 'Riferimento importato: premi Predict per ottenere la classe dal modello.' : 'Premi Predict per classificare questo test.'}</p>{assessment.predictedLabel && assessment.referenceLabel && <p>Etichetta di riferimento (training): {assessment.referenceLabel}</p>}</div>
            <button className="button primary" disabled={predicting} onClick={() => predict(assessment)}>{predicting ? 'Classificazione…' : 'Predict · classifica'}</button>
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div><h2>Misurazioni grafomotorie</h2><p>Valori originali · nessuna imputazione nel frontend</p></div>
              <label className="test-select"><span className="sr-only">Test da visualizzare</span><select value={assessment.id} disabled={predicting} onChange={e => { setAssessmentId(e.target.value); setResult(null); setPredictionError(''); }}>{patient.assessments.map((a, i) => <option value={a.id} key={a.id}>Test {patient.assessments.length - i} · {date(a.createdAt)}</option>)}</select></label>
            </div>
            <div className="task-tabs" role="tablist" aria-label="Task grafomotorio">{['Spirale', 'Lettera “l”', 'Bigramma “le”'].map((label, i) => <button key={label} role="tab" aria-selected={task === i + 1} onClick={() => setTask(i + 1)} className={task === i + 1 ? 'active' : ''}><span>0{i + 1}</span>{label}</button>)}</div>
            <div className="features-grid" role="tabpanel" aria-label={`Misurazioni task ${task}`}>
              {data.featureSchema.feature_names.filter(k => k.startsWith(`t${task}_`)).map(key => {
                const value = assessment.features[key];
                const name = key.slice(3);
                const display = value == null ? 'Non disponibile' : name.endsWith('_pct') ? `${number(value * 100)}%` : `${number(value)}${name.endsWith('_ms') ? ' ms' : ''}`;
                return <div className="feature" key={key}><span>{featureLabels[name] || name}</span><strong>{display}</strong><small>{key}</small></div>;
              })}
            </div>
          </section>
          <div className="notice info"><CircleHelp size={18} /> Strumento didattico di supporto: i risultati non sostituiscono la valutazione del medico. Nessuna probabilità calibrata è disponibile.</div>
        </>
      )}
    </>
  );
}
