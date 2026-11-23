import { useCallback, useState } from 'react';
import { CircleHelp, FileHeart, Plus, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { useLive } from '../../hooks/useLive';
import { date, number } from '../../utils/format';
import Badge from '../../components/Badge';
import ErrorNotice from '../../components/ErrorNotice';
import Loading from '../../components/Loading';
import AssessmentForm from '../../components/AssessmentForm';
import { featureLabels } from '../../utils/features';

export default function PatientDetailPage({ id, onBack }) {
  const load = useCallback(() => api(`/clinical/patients/${id}`), [id]);
  const { data, error, refresh } = useLive(load);
  const [task, setTask] = useState(1);
  const [assessmentId, setAssessmentId] = useState('');
  const [adding, setAdding] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [predictionError, setPredictionError] = useState('');
  const [result, setResult] = useState(null);

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
      <div className="page-heading"><div><div className="eyebrow">CARTELLA CLINICA · {patient.datasetSplit === 'TRAIN' ? 'DATASET TRAINING' : 'PAZIENTE MANUALE'}</div><h1>{patient.name || patient.code}</h1><p>{patient.code} · Test grafomotori del paziente assegnato.</p></div><button className="button secondary" onClick={() => { setAdding(true); setResult(null); }} disabled={adding}><Plus size={16} /> Aggiungi test</button></div>
      <Badge tone="green"><ShieldCheck size={13} /> Accesso autorizzato</Badge>
      {adding && <AssessmentForm patientId={id} featureSchema={data.featureSchema} onCancel={() => setAdding(false)} onSaved={async saved => { setAdding(false); setAssessmentId(saved.id); setResult(null); await refresh(); }} />}
      <ErrorNotice>{predictionError}</ErrorNotice>
      {result && result.assessmentId === assessment?.id && <div className="notice success" role="status">Classe di appartenenza predetta: <strong>{result.label === 'PD' ? 'PD · Parkinson' : 'H · Controllo sano'}</strong></div>}
      {!assessment ? <div className="empty">Nessun test disponibile. Aggiungi le misurazioni per usare Predict.</div> : (
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
