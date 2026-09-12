import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePondData } from '../context/pondDataStore';
import { getCarbonMrv } from '../services/dataSource';

const pct = value => `${Math.round(Number(value || 0) * 100)}%`;
const kg = value => `${Number(value || 0).toFixed(3)} kg`;

export default function CarbonMRV() {
  const { snapshot, pondOptions, activePondId, setActivePondId, usingFallback, connection } = usePondData();
  const [volume, setVolume] = useState(1000);
  const [hours, setHours] = useState(24);
  const [emissions, setEmissions] = useState(0);
  const [permanence, setPermanence] = useState(1);
  const [mrv, setMrv] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const calculate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getCarbonMrv(activePondId, {
        pondVolumeM3: Number(volume),
        windowHours: Number(hours),
        operationalEmissionsKg: Number(emissions),
        permanenceFactor: Number(permanence),
      });
      setMrv(response.data);
    } catch (requestError) {
      setMrv(null);
      setError(requestError.status === 404
        ? 'Run the first prediction burst before calculating an MRV estimate.'
        : requestError.message);
    } finally {
      setLoading(false);
    }
  }, [activePondId, volume, hours, emissions, permanence]);

  useEffect(() => { const timer = window.setTimeout(() => void calculate(), 0); return () => window.clearTimeout(timer); }, [calculate]);

  const rows = useMemo(() => {
    const a = mrv?.accounting;
    return [
      { label: 'Gross biological CO2 capture', sub: 'Actual twin uptake-rate output scaled by pond volume and time window', value: a?.gross_biological_capture_kg, tone: 'positive' },
      { label: 'Operational emissions', sub: 'Operator-supplied pumps, aeration and site-energy emissions', value: -(a?.operational_emissions_kg || 0), tone: 'negative' },
      { label: 'Net biological capture estimate', sub: 'Gross modeled capture minus supplied operational emissions', value: a?.net_biological_capture_kg, tone: 'subtotal' },
      { label: 'Permanence-adjusted estimate', sub: 'Net estimate multiplied by the disclosed permanence factor', value: a?.permanence_adjusted_kg, tone: 'final' },
    ];
  }, [mrv]);

  const factors = mrv?.confidence?.factors || {};
  const evidenceRows = (snapshot?.history || []).slice(-8).reverse();

  return <div className="page mrv-page model-mrv-page">
    <header className="page-heading">
      <div><span className="eyebrow">Carbon MRV - model grounded</span><h1>Transparent carbon accounting.</h1><p>Every result separates model output, operator assumptions and verification status.</p></div>
      <label className="select-field"><span>Active pond</span><select value={activePondId} onChange={event => setActivePondId(event.target.value)}>{pondOptions.map(pond => <option key={pond.id} value={pond.id}>{pond.name}</option>)}</select></label>
    </header>

    {(usingFallback || error) && <div className={`data-notice notice-${connection}`}><span>{error ? 'MRV WAITING' : 'DEMO FALLBACK'}</span><p>{error || 'The displayed fallback state is not included in the model-derived carbon claim.'}</p></div>}

    <div className="mrv-status-strip">
      <span><i/> {mrv ? 'Live model evidence' : 'Awaiting evidence'}</span>
      <span>Stream row {mrv?.provenance?.row ?? '-'}</span>
      <span>Cycle {mrv?.provenance?.cycle ?? '-'}</span>
      <b>{mrv?.status?.replaceAll('_', ' ') || 'not calculated'}</b>
    </div>

    <section className="mrv-control-deck glass">
      <div><span className="eyebrow">Accounting boundary</span><h2>Make every assumption explicit.</h2><p>The API recalculates from the latest trained-model uptake rate. Changing these controls never changes the live pond.</p></div>
      <label><span>Pond volume</span><div><input type="number" min="1" value={volume} onChange={event => setVolume(event.target.value)}/><em>m3</em></div></label>
      <label><span>Time window</span><div><input type="number" min="1" value={hours} onChange={event => setHours(event.target.value)}/><em>hours</em></div></label>
      <label><span>Operational emissions</span><div><input type="number" min="0" step="0.1" value={emissions} onChange={event => setEmissions(event.target.value)}/><em>kg CO2</em></div></label>
      <label><span>Permanence factor</span><div><input type="number" min="0" max="1" step="0.05" value={permanence} onChange={event => setPermanence(event.target.value)}/><em>0-1</em></div></label>
      <button onClick={() => void calculate()} disabled={loading}>{loading ? 'Calculating...' : 'Recalculate'}</button>
    </section>

    <div className="mrv-grid">
      <section id="waterfall" className="glass mrv-waterfall">
        <header><div><span className="eyebrow">Calculation trace</span><h3>{hours}-hour carbon waterfall</h3></div><strong>{kg(mrv?.accounting?.permanence_adjusted_kg)}</strong></header>
        <div className="mrv-rate"><span>Model uptake rate</span><b>{Number(mrv?.inputs?.gross_co2_uptake_rate_g_l_h || 0).toFixed(7)} g/L/h</b><small>Estimated by the trained biomass forecast and 1.83 g CO2/g biomass factor</small></div>
        {rows.map((row, index) => <div key={row.label} className={`wf-row mrv-row-${row.tone}`}><div className="wf-dot">{index + 1}</div><div><div className="wf-label">{row.label}</div><div className="wf-sub">{row.sub}</div></div><span className="wf-val">{kg(row.value)}</span></div>)}
        <div className="mrv-caveat"><b>Claim boundary</b><p>{mrv?.methodology?.warning || 'No model evidence is loaded yet.'}</p></div>
      </section>

      <section id="confidence" className="glass mrv-confidence">
        <span className="eyebrow">Evidence quality</span><h3>Carbon confidence</h3>
        <div className="gauge-wrap"><div className="mrv-gauge" style={{ '--confidence': pct(mrv?.confidence?.score) }}><span>{pct(mrv?.confidence?.score)}</span></div><div><b>Composite evidence score</b><small>Not a credit-certification score</small></div></div>
        {Object.entries(factors).map(([name, value]) => <div className="factor-row" key={name}><div className="factor-label"><span>{name.replaceAll('_', ' ')}</span><span>{pct(value)}</span></div><div className="factor-bar"><div className="factor-fill" style={{ width: pct(value) }}/></div></div>)}
        <div className="mrv-method"><span>Formula</span><code>{mrv?.methodology?.formula || 'Awaiting model output'}</code><span>Scope</span><p>{mrv?.methodology?.scope || 'Gross biological uptake only'}</p></div>
      </section>
    </div>

    <section id="ledger" className="glass mrv-evidence-ledger">
      <header><div><span className="eyebrow">Evidence ledger</span><h3>Recent model observations</h3></div><span>{evidenceRows.length} records in view</span></header>
      <p className="sub">This is an in-memory trace of the current run. It is not a harvest or permanence ledger.</p>
      <div className="table-scroll"><table className="ledger-table"><thead><tr><th>Time</th><th>Pond</th><th>Biomass estimate</th><th>Health</th><th>Image evidence</th><th>Provenance</th></tr></thead><tbody>
        {evidenceRows.length ? evidenceRows.map((row, index) => <tr key={`${row.label}-${index}`}><td>{row.label}</td><td>{activePondId}</td><td>{Number(row.biomass || 0).toFixed(4)} g/L</td><td>{Math.round(row.health || 0)}/100</td><td>{snapshot?.image?.state || 'not available'}</td><td><span className="evidence-pill">model history</span></td></tr>) : <tr><td colSpan="6">No live model history is available yet.</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}
