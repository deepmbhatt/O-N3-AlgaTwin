import { useEffect, useMemo, useState } from 'react';
import { usePondData } from '../context/pondDataStore';
import { getAiInsights, getApiHealth } from '../services/dataSource';

const modeCopy = {
  RECOVER: 'Immediate intervention search',
  STABILIZE: 'Small corrective action',
  MAINTAIN: 'No change recommended',
  OPTIMIZE: 'Conservative improvement search',
  VERIFY: 'Gather stronger evidence',
};

function ActionCard({ entry, onOptimize, busy }) {
  const { current_state: state, insight, action } = entry;
  const recommended = action.recommended_action;
  return <article className={`decision-card glass decision-${action.action_state.toLowerCase()}`}>
    <header><div><span>{state.pond_id}</span><h2>{insight.summary}</h2></div><b>{action.action_state}</b></header>
    <div className="decision-kpis"><span><small>Health</small><b>{state.health.score.toFixed(1)}</b></span><span><small>6h biomass</small><b>{state.biomass.change_6h_pct >= 0 ? '+' : ''}{state.biomass.change_6h_pct.toFixed(1)}%</b></span><span><small>Anomaly</small><b>{Math.round(state.anomaly.probability * 100)}%</b></span><span><small>Image confidence</small><b>{state.verification.image_confidence == null ? '-' : `${Math.round(state.verification.image_confidence * 100)}%`}</b></span></div>
    <div className="decision-findings"><span className="eyebrow">What the models see</span>{insight.main_findings.slice(0, 4).map(item => <p key={item}><i/>{item}</p>)}</div>
    <div className="decision-action"><span className="eyebrow">{modeCopy[action.action_state]}</span>{recommended ? <><h3>{recommended.label}</h3><div className="action-changes">{Object.entries(recommended.changes).map(([key, value]) => <span key={key}>{key.replaceAll('_', ' ')} <b>{value}</b></span>)}</div><div className="action-impact"><span>Biomass <b>{recommended.expected_biomass_change_pct >= 0 ? '+' : ''}{recommended.expected_biomass_change_pct.toFixed(1)}%</b></span><span>Health <b>{recommended.expected_health_score.toFixed(1)}</b></span><span>Class <b>{recommended.classification}</b></span></div></> : <p>{action.reason}</p>}</div>
    <footer><span>{action.tested_count} supported scenarios tested</span><button onClick={() => onOptimize(state.pond_id)} disabled={busy}>{busy ? 'Testing...' : 'Test optimization'}</button></footer>
  </article>;
}

export default function AIIntelligence() {
  const { ponds, connection, usingFallback, processNextBurst, busy: predictionBusy } = usePondData();
  const [packages, setPackages] = useState({});
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState('');
  const [error, setError] = useState('');
  const [modelFamilies, setModelFamilies] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [health, results] = await Promise.all([
          getApiHealth(),
          Promise.allSettled((ponds || []).map(item => getAiInsights(item.pond_id))),
        ]);
        if (cancelled) return;
        setModelFamilies(health.model_families || 0);
        const next = {};
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') next[ponds[index].pond_id] = result.value.data;
        });
        setPackages(next);
        setError('');
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [ponds]);

  async function optimize(pondId) {
    setOptimizing(pondId);
    try {
      const result = await getAiInsights(pondId, true);
      setPackages(current => ({ ...current, [pondId]: result.data }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOptimizing('');
    }
  }

  const entries = useMemo(() => Object.values(packages), [packages]);
  const actionCount = entries.filter(item => item.insight.needs_action).length;
  const tested = entries.reduce((sum, item) => sum + item.action.tested_count, 0);

  return <div className="page ai-page decision-page">
    <header className="page-heading"><div><span className="eyebrow">AI insight + action engine</span><h1>Decisions backed by the twin.</h1><p>Aoi explains these outputs, but only the trained models and non-mutating scenario search decide what can be recommended.</p></div><button className="burst-button" onClick={() => void processNextBurst()} disabled={predictionBusy}>{predictionBusy ? 'Running models...' : 'Run fresh prediction'}</button></header>
    {(usingFallback || error) && <div className={`data-notice notice-${connection}`}><span>{error ? 'ENGINE NOTICE' : 'AWAITING LIVE STATE'}</span><p>{error || 'Run a prediction to replace the fallback interface with model-grounded decisions.'}</p></div>}

    <section className="decision-architecture glass"><span>Trained model outputs</span><i>&rarr;</i><span>Evidence insights</span><i>&rarr;</i><span>Scenario search</span><i>&rarr;</i><span>Ranked action</span><i>&rarr;</i><span>Aoi explanation</span></section>
    <div className="summary-row"><div className="summary-card glass"><div className="label">Model families loaded</div><div className="value">{modelFamilies}</div></div><div className="summary-card glass"><div className="label">Ponds evaluated</div><div className="value">{entries.length}</div></div><div className="summary-card glass"><div className="label">Need action</div><div className="value hero">{actionCount}</div></div><div className="summary-card glass"><div className="label">Scenarios tested</div><div className="value">{tested}</div></div></div>
    {loading && <div className="decision-empty glass">Reading the current digital twins...</div>}
    {!loading && !entries.length && <div className="decision-empty glass"><h2>No live twin exists yet.</h2><p>Run the first prediction burst. The engine will then evaluate all three ponds without MongoDB.</p></div>}
    <div className="decision-grid">{entries.map(entry => <ActionCard key={entry.current_state.pond_id} entry={entry} onOptimize={optimize} busy={optimizing === entry.current_state.pond_id}/>)}</div>
    <div className="decision-safety glass"><b>Decision boundary</b><p>Recommendations are emitted only when a supported scenario improves the current twin above the configured threshold. Every candidate is tested by the packaged model artifacts. Results remain associational simulations and do not change live state.</p></div>
  </div>;
}
