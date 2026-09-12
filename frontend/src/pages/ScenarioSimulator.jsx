import { useMemo, useState } from 'react';
import LivingPond from '../components/LivingPond';
import Mascot from '../components/Mascot';
import { usePondData } from '../context/pondDataStore';
import { scenarioControls } from '../data/mockData';
import { deriveVisualState } from '../lib/visualState';
import { fileToImageData, runScenario } from '../services/dataSource';

const valuesFrom = snapshot => Object.fromEntries(scenarioControls.map(c => [c.key, c.baseline ?? snapshot.iot[c.key] ?? c.min]));

export default function ScenarioSimulator() {
  const { snapshot: baseline, activePondId, pondOptions, setActivePondId, usingFallback } = usePondData();
  const [changes, setChanges] = useState(() => valuesFrom(baseline));
  const [result, setResult] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [running, setRunning] = useState(false);
  const [requestError, setRequestError] = useState('');
  const currentVisual = useMemo(() => deriveVisualState(baseline), [baseline]);
  const simulatedSnapshot = useMemo(() => result ? {
    ...baseline,
    label: result.health >= 80 ? 'Healthy' : result.health >= 50 ? 'Stressed' : 'Critical',
    dashboard: {
      ...baseline.dashboard,
      health_score: result.health,
      current_biomass_g_l: result.biomass,
      anomaly_severity: result.health >= 75 ? 'normal' : result.health >= 50 ? 'moderate' : 'high',
      anomaly_probability: Math.max(.05, Math.min(.95, (100 - result.health) / 100)),
      chlorophyll_a: result.raw.satellite?.chlorophyll_a ?? baseline.dashboard.chlorophyll_a,
      turbidity: result.raw.satellite?.turbidity ?? baseline.dashboard.turbidity,
      image_state: result.raw.dashboard?.image_state ?? baseline.dashboard.image_state,
      image_confidence: result.raw.dashboard?.image_confidence ?? baseline.dashboard.image_confidence,
    },
    iot: { ...baseline.iot, ...changes },
    insights: result.raw.insights || baseline.insights,
  } : baseline, [result, baseline, changes]);
  const simulatedVisual = deriveVisualState(simulatedSnapshot, { recovering: Boolean(result && result.relative > 0) });

  function resetToLive() {
    setChanges(valuesFrom(baseline));
    setResult(null);
    setRequestError('');
  }

  async function runPreview() {
    setRunning(true);
    setRequestError('');
    try {
      const imageData = await fileToImageData(imageFile);
      const payload = await runScenario(activePondId, changes, imageData);
      const data = payload.data;
      setResult({
        health: Number(data.dashboard.simulated_health_score),
        biomass: Number(data.dashboard.simulated_biomass_g_l),
        relative: Number(data.dashboard.relative_biomass_delta_pct),
        classification: data.dashboard.simulation_classification || data.simulation?.classification || 'neutral',
        raw: data,
      });
    } catch (error) {
      setRequestError(error.message || 'The simulation request failed.');
    } finally {
      setRunning(false);
    }
  }

  return <div className="page scenario-page">
    <header className="page-heading"><div><span className="eyebrow">Scenario lab - real API</span><h1>Test an intervention before the pond feels it.</h1><p>The latest streamed row is sent as the baseline; simulations never advance or change live state.</p></div><select className="quiet-select" value={activePondId} onChange={e => { setActivePondId(e.target.value); setResult(null); }}>{pondOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></header>
    {(requestError || usingFallback) && <div className="data-notice notice-critical"><span>{requestError ? 'SIMULATION ERROR' : 'LIVE BASELINE REQUIRED'}</span><p>{requestError || 'Process a prediction burst before submitting a real simulation.'}</p></div>}
    <div className="scenario-layout">
      <aside className="panel scenario-controls">
        <div className="panel-title"><div><span className="eyebrow">Intervention design</span><h2>Custom conditions</h2></div><button className="text-button" onClick={resetToLive}>Use live values</button></div>
        <div className="control-list">{scenarioControls.map(control => <label key={control.key}><div><span>{control.label}</span><b>{changes[control.key]} <small>{control.unit}</small></b></div><input type="range" min={control.min} max={control.max} step={control.step} value={changes[control.key]} onChange={e => setChanges(v => ({ ...v, [control.key]: Number(e.target.value) }))}/><small>{control.min} <i/>{control.max}</small></label>)}</div>
        <label className="image-drop"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImageFile(e.target.files[0] || null)}/><span className="upload-icon">+</span><div><b>{imageFile?.name || 'Add a pond image'}</b><small>{imageFile ? 'Will be sent as supporting evidence' : 'Optional JPG, PNG or WebP - maximum 10 MB'}</small></div></label>
        <button className="primary-button" onClick={runPreview} disabled={running || usingFallback}>{running ? 'Calling simulation API...' : 'Run live model simulation'}<span aria-hidden="true">&rarr;</span></button>
      </aside>
      <section className="scenario-stage">
        <div className="comparison-heading"><div><span className="eyebrow">Side-by-side ecosystem response</span><h2>Current vs simulated</h2></div>{result && <span className={`impact-badge impact-${result.classification}`}>{result.relative >= 0 ? '+' : ''}{result.relative.toFixed(1)}% biomass response</span>}</div>
        <div className="pond-comparison">
          <article><div className="compare-label"><span>Current streamed row</span><b>{Math.round(baseline.dashboard.health_score)}/100 health</b></div><LivingPond snapshot={baseline} visual={currentVisual} compact showCallouts={false}/></article>
          <article><div className="compare-label"><span>Simulated outcome</span><b>{result ? `${Math.round(result.health)}/100 health` : 'Awaiting API result'}</b></div><LivingPond snapshot={simulatedSnapshot} visual={simulatedVisual} compact showCallouts={false}/></article>
        </div>
        <div className="scenario-result">
          {result ? <><div><span>Classification</span><b>{result.classification.replace('_', ' ')}</b></div><div><span>Simulated biomass</span><b>{result.biomass.toFixed(3)} g/L</b></div><div><span>Health delta</span><b>{result.health - baseline.dashboard.health_score >= 0 ? '+' : ''}{(result.health - baseline.dashboard.health_score).toFixed(1)} points</b></div><div className="result-assurance"><span>LIVE STATE</span><b>Unchanged</b><small>Cursor was not advanced</small></div></> : <Mascot compact mood="calm" message="Tune the controls, add optional visual evidence, and I will send this intervention to the live simulation model."/>}
        </div>
      </section>
    </div>
  </div>;
}
