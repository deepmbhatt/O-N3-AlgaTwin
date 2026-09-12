import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePondData } from '../context/pondDataStore';
import { getCarbonMrv } from '../services/dataSource';

const formatKg = value => `${Number(value || 0).toFixed(3)} kg CO2`;
const formatPct = value => `${Math.round(Number(value || 0) * 100)}%`;

export default function Reports() {
  const { snapshot, ponds, pondOptions, activePondId, setActivePondId, usingFallback, connection } = usePondData();
  const [farmName, setFarmName] = useState('AlgaTwin Demonstration Site');
  const [volume, setVolume] = useState(1000);
  const [hours, setHours] = useState(24);
  const [emissions, setEmissions] = useState(0);
  const [permanence, setPermanence] = useState(1);
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [mrv, setMrv] = useState(null);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState({ accounting: true, verification: true, anomalies: true, provenance: true });

  const refreshMrv = useCallback(async () => {
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
      setError(requestError.status === 404 ? 'Run the first prediction burst to create a report.' : requestError.message);
    }
  }, [activePondId, volume, hours, emissions, permanence]);

  useEffect(() => { const timer = window.setTimeout(() => void refreshMrv(), 0); return () => window.clearTimeout(timer); }, [refreshMrv]);

  const reportId = useMemo(() => {
    const stamp = generatedAt.toISOString().slice(0, 10).replaceAll('-', '');
    return `AT-${activePondId.toUpperCase()}-${stamp}-R${snapshot?.stream_row || 0}-C${snapshot?.stream_cycle || 0}`;
  }, [generatedAt, activePondId, snapshot?.stream_row, snapshot?.stream_cycle]);

  const anomalies = useMemo(() => (ponds || []).filter(item => Number(item.snapshot?.dashboard?.anomaly_probability || 0) >= 0.2), [ponds]);
  const history = (snapshot?.history || []).slice(-12).reverse();

  const report = useMemo(() => ({
    schema_version: 'algatwin-mrv-report-1.0',
    report_id: reportId,
    generated_at: generatedAt.toISOString(),
    farm_name: farmName,
    pond_id: activePondId,
    status: mrv?.status || 'awaiting_model_evidence',
    reporting_boundary: { pond_volume_m3: Number(volume), window_hours: Number(hours), operational_emissions_kg: Number(emissions), permanence_factor: Number(permanence) },
    accounting: mrv?.accounting || null,
    confidence: mrv?.confidence || null,
    methodology: mrv?.methodology || null,
    latest_model_output: snapshot?.raw || null,
    recent_history: history,
  }), [reportId, generatedAt, farmName, activePondId, mrv, volume, hours, emissions, permanence, snapshot?.raw, history]);

  function generate() {
    setGeneratedAt(new Date());
    void refreshMrv();
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const accountingRows = [
    ['Gross biological capture', mrv?.accounting?.gross_biological_capture_kg],
    ['Operational emissions', -(mrv?.accounting?.operational_emissions_kg || 0)],
    ['Net biological capture', mrv?.accounting?.net_biological_capture_kg],
    ['Permanence-adjusted estimate', mrv?.accounting?.permanence_adjusted_kg],
  ];

  return <div className="page reports-page model-report-page">
    <header className="page-heading"><div><span className="eyebrow">Verification-ready reports</span><h1>Traceable MRV evidence packs.</h1><p>Generate a transparent record from the latest model outputs and disclosed accounting assumptions.</p></div><div className="report-page-actions"><button onClick={downloadJson} disabled={!mrv}>Download JSON</button><button className="primary" onClick={() => window.print()} disabled={!mrv}>Save as PDF</button></div></header>

    {(usingFallback || error) && <div className={`data-notice notice-${connection}`}><span>{error ? 'REPORT WAITING' : 'DEMO FALLBACK'}</span><p>{error || 'Fallback values are excluded from the exported evidence pack.'}</p></div>}

    <div className="report-layout">
      <aside id="config" className="glass report-config">
        <span className="eyebrow">Report boundary</span><h3>Configuration</h3>
        <label className="field"><span>Site name</span><input value={farmName} onChange={event => setFarmName(event.target.value)}/></label>
        <label className="field"><span>Pond</span><select value={activePondId} onChange={event => setActivePondId(event.target.value)}>{pondOptions.map(pond => <option key={pond.id} value={pond.id}>{pond.name}</option>)}</select></label>
        <div className="report-input-pair"><label className="field"><span>Volume (m3)</span><input type="number" min="1" value={volume} onChange={event => setVolume(event.target.value)}/></label><label className="field"><span>Window (hours)</span><input type="number" min="1" value={hours} onChange={event => setHours(event.target.value)}/></label></div>
        <label className="field"><span>Operational emissions (kg CO2)</span><input type="number" min="0" step=".1" value={emissions} onChange={event => setEmissions(event.target.value)}/></label>
        <label className="field"><span>Permanence factor (0-1)</span><input type="number" min="0" max="1" step=".05" value={permanence} onChange={event => setPermanence(event.target.value)}/></label>
        <div className="report-checks"><span>Include sections</span>{Object.entries(checks).map(([key, checked]) => <label key={key}><input type="checkbox" checked={checked} onChange={() => setChecks(current => ({ ...current, [key]: !current[key] }))}/>{key}</label>)}</div>
        <button className="gen-btn" onClick={generate}>Regenerate from model</button>
        <p className="gen-note">Data lives in process memory only. No MongoDB is required.</p>
      </aside>

      <main id="reportWrap">
        <article className="paper model-report-paper">
          <header className="paper-head"><div className="paper-brand"><div className="mark"><svg viewBox="0 0 24 24"><path d="M12 2C8 6 5 10 5 14a7 7 0 0 0 14 0c0-4-3-8-7-12z" fill="#fff"/></svg></div><div><div className="pname">AlgaTwin Carbon MRV</div><div className="psub">Model-grounded evidence report</div></div></div><div className="meta">Generated {generatedAt.toLocaleString()}<br/>Report ID: {reportId}<div className="conf">{formatPct(mrv?.confidence?.score)} evidence confidence</div></div></header>

          <div className="report-title-row"><div><h2 className="title">{farmName}</h2><div className="period">{activePondId} - {hours}-hour accounting window</div></div><span className="report-status">{(mrv?.status || 'awaiting evidence').replaceAll('_', ' ')}</span></div>

          <section className="sec"><h4>Executive summary</h4><div className="stat-grid"><div className="stat-box"><div className="slabel">Current biomass estimate</div><div className="sval">{Number(snapshot?.dashboard?.current_biomass_g_l || 0).toFixed(4)} g/L</div></div><div className="stat-box"><div className="slabel">Gross modeled capture</div><div className="sval">{formatKg(mrv?.accounting?.gross_biological_capture_kg)}</div></div><div className="stat-box"><div className="slabel">Permanence-adjusted</div><div className="sval">{formatKg(mrv?.accounting?.permanence_adjusted_kg)}</div></div><div className="stat-box"><div className="slabel">Health score</div><div className="sval">{Math.round(snapshot?.dashboard?.health_score || 0)}/100</div></div><div className="stat-box"><div className="slabel">Anomaly probability</div><div className="sval">{formatPct(snapshot?.dashboard?.anomaly_probability)}</div></div><div className="stat-box"><div className="slabel">Evidence confidence</div><div className="sval">{formatPct(mrv?.confidence?.score)}</div></div></div></section>

          {checks.accounting && <section className="sec"><h4>Carbon accounting</h4><table className="rtable"><tbody>{accountingRows.map(([label, value]) => <tr key={label}><td>{label}</td><td className={Number(value) < 0 ? 'neg' : ''} style={{ textAlign: 'right', fontWeight: 600 }}>{formatKg(value)}</td></tr>)}</tbody></table><div className="report-method-note"><b>Formula:</b> {mrv?.methodology?.formula || 'awaiting model evidence'}<br/><b>Scope:</b> {mrv?.methodology?.scope || 'gross biological uptake only'}</div></section>}

          {checks.verification && <section className="sec"><h4>Verification and confidence</h4>{Object.entries(mrv?.confidence?.factors || {}).map(([name, value]) => <div className="verify-line" key={name}><span>{name.replaceAll('_', ' ')}</span><span>{formatPct(value)}</span></div>)}<div className="verify-line"><span>Image classification</span><span>{snapshot?.image?.state || 'not available'} ({formatPct(snapshot?.image?.confidence)})</span></div></section>}

          {checks.anomalies && <section className="sec"><h4>Current anomaly register</h4><table className="rtable"><thead><tr><th>Pond</th><th>Health</th><th>Probability</th><th>Severity</th></tr></thead><tbody>{anomalies.length ? anomalies.map(item => <tr key={item.pond_id}><td>{item.pond_id}</td><td>{Math.round(item.snapshot.dashboard.health_score)}/100</td><td>{formatPct(item.snapshot.dashboard.anomaly_probability)}</td><td className={item.snapshot.dashboard.anomaly_severity === 'high' ? 'neg' : ''}>{item.snapshot.dashboard.anomaly_severity}</td></tr>) : <tr><td colSpan="4">No active anomaly above the reporting threshold.</td></tr>}</tbody></table></section>}

          {checks.provenance && <section className="sec"><h4>Model and provenance trace</h4><div className="verify-line"><span>Stream record</span><span>row {snapshot?.stream_row || '-'}, cycle {snapshot?.stream_cycle || '-'}</span></div><div className="verify-line"><span>Observed at</span><span>{snapshot?.observed_at ? new Date(snapshot.observed_at).toLocaleString() : 'not available'}</span></div><div className="verify-line"><span>Forecast method</span><span>{snapshot?.raw?.results?.digital_twin?.predicted?.method || 'not available'}</span></div><div className="verify-line"><span>Anomaly model</span><span>supervised crash risk + novelty + rules</span></div><div className="verify-line"><span>Remote model</span><span>{snapshot?.raw?.results?.satellite?.provenance || 'not available'}</span></div></section>}

          <footer className="foot-note"><b>Important:</b> {mrv?.methodology?.warning || 'This report has no live model evidence yet.'} This evidence pack supports review; it does not issue or certify carbon credits.</footer>
        </article>
      </main>
    </div>
  </div>;
}
