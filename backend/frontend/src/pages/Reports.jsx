import React, { useState, useEffect } from 'react';
import Scene from '../components/Scene';
import Navigation from '../components/Navigation';

const ACCOUNTING = [
  { label: 'Gross biological CO₂ capture', value: 420 },
  { label: 'Operational emissions', value: -38 },
  { label: 'Net biological capture', value: 382 },
  { label: 'Biomass fate & permanence adjustment', value: -74 },
  { label: 'Estimated net carbon removal', value: 308 },
];

export default function Reports() {
  const [farmName, setFarmName] = useState('Verdance Algae Farm — Site A');
  const [period, setPeriod] = useState('Last 30 days');
  const [checks, setChecks] = useState({
    secAccounting: true,
    secVerify: true,
    secAnomalies: true,
    secHarvest: true
  });
  
  const [reportData, setReportData] = useState({
    farmName: 'Verdance Algae Farm — Site A',
    period: 'Last 30 days',
    genDate: '',
    reportId: ''
  });

  const handleGenerate = () => {
    const now = new Date();
    setReportData({
      farmName: farmName || 'Untitled farm',
      period: period,
      genDate: now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      reportId: now.getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000))
    });
  };

  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const handleCheck = (key) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <Scene>
        <div className="veil"></div>
      </Scene>
      <Navigation />
      
      <div className="page">
        <div className="page-head">
          <h1>Verification Reports</h1>
          <p>Generate downloadable, verifiable MRV records for third-party registries. The system compiles data from sensors, models, and harvest ledgers into a single traceable document.</p>
        </div>

        <div id="config" className="glass" role="region" aria-label="Report configuration">
          <h3>Report configuration</h3>
          <div className="field">
            <label htmlFor="farmName">Farm name</label>
            <input type="text" id="farmName" value={farmName} onChange={e => setFarmName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="period">Reporting period</label>
            <select id="period" value={period} onChange={e => setPeriod(e.target.value)}>
              <option value="Last 30 days">Last 30 days</option>
              <option value="Last 90 days">Last 90 days</option>
              <option value="Year to date">Year to date</option>
              <option value="All time">All time</option>
            </select>
          </div>
          <div className="field">
            <label>Include sections</label>
            <div className="check-item"><input type="checkbox" checked={checks.secAccounting} onChange={() => handleCheck('secAccounting')} id="secAccounting"/><span>Carbon accounting</span></div>
            <div className="check-item"><input type="checkbox" checked={checks.secVerify} onChange={() => handleCheck('secVerify')} id="secVerify"/><span>Verification &amp; confidence</span></div>
            <div className="check-item"><input type="checkbox" checked={checks.secAnomalies} onChange={() => handleCheck('secAnomalies')} id="secAnomalies"/><span>Anomalies</span></div>
            <div className="check-item"><input type="checkbox" checked={checks.secHarvest} onChange={() => handleCheck('secHarvest')} id="secHarvest"/><span>Harvest records</span></div>
          </div>
          <button className="gen-btn" id="genBtn" onClick={handleGenerate}>Generate report</button>
          <button className="dl-btn" id="dlBtn" onClick={() => window.print()}>Download as PDF</button>
          <div className="gen-note">Download opens your browser's print dialog — choose "Save as PDF".</div>
        </div>

        <div id="reportWrap">
          <div className="paper" id="paper">
            <div className="paper-head">
              <div className="paper-brand">
                <div className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8 6 5 10 5 14a7 7 0 0 0 14 0c0-4-3-8-7-12z" fill="#fff"/></svg></div>
                <div><div className="pname">Verdance</div><div className="psub">Algae Carbon Monitoring Platform</div></div>
              </div>
              <div className="meta">
                Generated <span id="genDate">{reportData.genDate}</span><br/>
                Report ID: VDC-<span id="reportId">{reportData.reportId}</span>
                <div className="conf" id="metaConf">91% confidence</div>
              </div>
            </div>

            <h2 className="title" id="reportFarmName">{reportData.farmName}</h2>
            <div className="period" id="reportPeriod">Monitoring &amp; Verification Report — {reportData.period}</div>

            <div className="sec">
              <h4>Summary</h4>
              <div className="stat-grid">
                <div className="stat-box"><div className="slabel">Total biomass produced</div><div className="sval" id="statBiomass">312 kg</div></div>
                <div className="stat-box"><div className="slabel">Gross CO₂ captured</div><div className="sval" id="statGross">420 kg CO₂</div></div>
                <div className="stat-box"><div className="slabel">Net capture</div><div className="sval" id="statNet">382 kg CO₂</div></div>
                <div className="stat-box"><div className="slabel">Permanence-adjusted carbon</div><div className="sval" id="statAdjusted">308 kg CO₂</div></div>
                <div className="stat-box"><div className="slabel">Verification confidence</div><div className="sval" id="statConf">91%</div></div>
                <div className="stat-box"><div className="slabel">Ponds monitored</div><div className="sval">3</div></div>
              </div>
            </div>

            {checks.secAccounting && (
              <div className="sec" id="secAccountingBlock">
                <h4>Carbon accounting</h4>
                <table className="rtable">
                  <tbody id="accountingBody">
                    {ACCOUNTING.map((r, i) => (
                      <tr key={i}>
                        <td>{r.label}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }} className={r.value < 0 ? 'neg' : ''}>{r.value} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {checks.secVerify && (
              <div className="sec" id="secVerifyBlock">
                <h4>Verification &amp; confidence</h4>
                <div className="verify-line"><span>Sensor availability</span><span>96.4%</span></div>
                <div className="verify-line"><span>Satellite / drone cross-check</span><span>93.7% agreement</span></div>
                <div className="verify-line"><span>Model confidence (biomass &amp; anomaly)</span><span>90%</span></div>
                <div className="verify-line"><span>Data freshness</span><span>Within 15 minutes</span></div>
              </div>
            )}

            {checks.secAnomalies && (
              <div className="sec" id="secAnomaliesBlock">
                <h4>Anomalies detected</h4>
                <table className="rtable">
                  <thead><tr><th>Date</th><th>Pond</th><th>Severity</th><th>Status</th></tr></thead>
                  <tbody>
                    <tr><td>2026-09-06</td><td>Pond P3</td><td className="neg">Critical</td><td>Under review</td></tr>
                    <tr><td>2026-08-29</td><td>Pond P2</td><td>Mild</td><td>Resolved</td></tr>
                  </tbody>
                </table>
              </div>
            )}

            {checks.secHarvest && (
              <div className="sec" id="secHarvestBlock">
                <h4>Harvest records</h4>
                <table className="rtable">
                  <thead><tr><th>Date</th><th>Pond</th><th>Biomass</th><th>Destination</th><th>Permanence</th></tr></thead>
                  <tbody>
                    <tr><td>2026-09-08</td><td>Pond P1</td><td>180 kg</td><td>Biofuel</td><td>Long-term (~20 yr)</td></tr>
                    <tr><td>2026-08-30</td><td>Pond P2</td><td>150 kg</td><td>Animal feed</td><td>Short-term (~1 yr)</td></tr>
                    <tr><td>2026-08-22</td><td>Pond P3</td><td>165 kg</td><td>Bioplastic</td><td>Long-term (~15 yr)</td></tr>
                    <tr><td>2026-08-11</td><td>Pond P1</td><td>175 kg</td><td>Biochar</td><td>Permanent (100+ yr)</td></tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="foot-note">
              This preview is generated from prototype data. It is intended to demonstrate the future MRV reporting workflow and does not replace formal third-party verification.
            </div>
          </div>
        </div>
      </div>

      <div className="demo-data-badge" aria-label="Prototype using simulated data">PROTOTYPE • SIMULATED DATA</div>
    </>
  );
}
