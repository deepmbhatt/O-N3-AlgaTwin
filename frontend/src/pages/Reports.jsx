import { useState, useEffect } from 'react';
import { usePondData } from '../context/pondDataStore';

const ACCOUNTING = [
  { label: 'Gross biological CO₂ capture', value: 420 },
  { label: 'Operational emissions', value: -38 },
  { label: 'Net biological capture', value: 382 },
  { label: 'Biomass fate & permanence adjustment', value: -74 },
  { label: 'Estimated net carbon removal', value: 308 },
];

export default function Reports() {
  const { usingFallback, connection } = usePondData();
  const [farmName, setFarmName] = useState('Verdance Algae Farm — Site A');
  const [period, setPeriod] = useState('Last 30 days');
  const [checks, setChecks] = useState({
    secAccounting: true,
    secVerify: true,
    secAnomalies: true,
    secHarvest: true,
  });

  const [reportData, setReportData] = useState({
    farmName: 'Verdance Algae Farm — Site A',
    period: 'Last 30 days',
    genDate: '',
    reportId: '',
  });

  const handleGenerate = () => {
    const now = new Date();
    setReportData({
      farmName: farmName || 'Untitled farm',
      period: period,
      genDate: now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      reportId: now.getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000)),
    });
  };

  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheck = (key) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="page reports-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Verification Reports</span>
          <h1>Audit-Ready MRV Records</h1>
          <p>Generate downloadable, verifiable MRV records compiled from sensors, models, and harvest ledgers into a single traceable document.</p>
        </div>
      </header>

      {usingFallback && (
        <div className={`data-notice notice-${connection}`}>
          <span>{connection === 'empty' ? 'API READY' : connection === 'fallback' ? 'DEMO FALLBACK' : 'CONNECTION'}</span>
          <p>Reports will populate with live site parameters once connected to a deployed sensor network.</p>
        </div>
      )}

      <div className="report-layout">
        <aside id="config" className="glass" role="region" aria-label="Report configuration">
          <h3>Report configuration</h3>
          <div className="field">
            <label htmlFor="farmName">Farm name</label>
            <input
              type="text"
              id="farmName"
              value={farmName}
              onChange={e => setFarmName(e.target.value)}
            />
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
            <div className="check-item">
              <input
                type="checkbox"
                checked={checks.secAccounting}
                onChange={() => handleCheck('secAccounting')}
                id="secAccounting"
              />
              <label htmlFor="secAccounting">Carbon accounting</label>
            </div>
            <div className="check-item">
              <input
                type="checkbox"
                checked={checks.secVerify}
                onChange={() => handleCheck('secVerify')}
                id="secVerify"
              />
              <label htmlFor="secVerify">Verification &amp; confidence</label>
            </div>
            <div className="check-item">
              <input
                type="checkbox"
                checked={checks.secAnomalies}
                onChange={() => handleCheck('secAnomalies')}
                id="secAnomalies"
              />
              <label htmlFor="secAnomalies">Anomalies</label>
            </div>
            <div className="check-item">
              <input
                type="checkbox"
                checked={checks.secHarvest}
                onChange={() => handleCheck('secHarvest')}
                id="secHarvest"
              />
              <label htmlFor="secHarvest">Harvest records</label>
            </div>
          </div>
          <button className="gen-btn" id="genBtn" onClick={handleGenerate}>
            Generate report
          </button>
          <button className="dl-btn" id="dlBtn" onClick={() => window.print()}>
            Download as PDF
          </button>
          <div className="gen-note">Download opens your browser's print dialog — choose "Save as PDF".</div>
        </aside>

        <main id="reportWrap">
          <article className="paper" id="paper">
            <header className="paper-head">
              <div className="paper-brand">
                <div className="mark">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 2C8 6 5 10 5 14a7 7 0 0 0 14 0c0-4-3-8-7-12z" fill="#fff" />
                  </svg>
                </div>
                <div>
                  <div className="pname">Verdance / AlgaTwin</div>
                  <div className="psub">Algae Carbon Monitoring Platform</div>
                </div>
              </div>
              <div className="meta">
                Generated <span id="genDate">{reportData.genDate}</span><br />
                Report ID: VDC-<span id="reportId">{reportData.reportId}</span>
                <div className="conf" id="metaConf">91% confidence</div>
              </div>
            </header>

            <h2 className="title" id="reportFarmName">{reportData.farmName}</h2>
            <div className="period" id="reportPeriod">Monitoring &amp; Verification Report — {reportData.period}</div>

            <section className="sec">
              <h4>Summary</h4>
              <div className="stat-grid">
                <div className="stat-box"><div className="slabel">Total biomass produced</div><div className="sval" id="statBiomass">312 kg</div></div>
                <div className="stat-box"><div className="slabel">Gross CO₂ captured</div><div className="sval" id="statGross">420 kg CO₂</div></div>
                <div className="stat-box"><div className="slabel">Net capture</div><div className="sval" id="statNet">382 kg CO₂</div></div>
                <div className="stat-box"><div className="slabel">Permanence-adjusted carbon</div><div className="sval" id="statAdjusted">308 kg CO₂</div></div>
                <div className="stat-box"><div className="slabel">Verification confidence</div><div className="sval" id="statConf">91%</div></div>
                <div className="stat-box"><div className="slabel">Ponds monitored</div><div className="sval">3</div></div>
              </div>
            </section>

            {checks.secAccounting && (
              <section className="sec" id="secAccountingBlock">
                <h4>Carbon accounting</h4>
                <table className="rtable">
                  <tbody id="accountingBody">
                    {ACCOUNTING.map((r, i) => (
                      <tr key={i}>
                        <td>{r.label}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }} className={r.value < 0 ? 'neg' : ''}>
                          {r.value} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {checks.secVerify && (
              <section className="sec" id="secVerifyBlock">
                <h4>Verification &amp; confidence</h4>
                <div className="verify-line"><span>Sensor availability</span><span>96.4%</span></div>
                <div className="verify-line"><span>Satellite / drone cross-check</span><span>93.7% agreement</span></div>
                <div className="verify-line"><span>Model confidence (biomass &amp; anomaly)</span><span>90%</span></div>
                <div className="verify-line"><span>Data freshness</span><span>Within 15 minutes</span></div>
              </section>
            )}

            {checks.secAnomalies && (
              <section className="sec" id="secAnomaliesBlock">
                <h4>Anomalies detected</h4>
                <table className="rtable">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Pond</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>2026-09-06</td><td>Pond 03</td><td className="neg">Critical</td><td>Under review</td></tr>
                    <tr><td>2026-08-29</td><td>Pond 02</td><td>Mild</td><td>Resolved</td></tr>
                  </tbody>
                </table>
              </section>
            )}

            {checks.secHarvest && (
              <section className="sec" id="secHarvestBlock">
                <h4>Harvest records</h4>
                <table className="rtable">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Pond</th>
                      <th scope="col">Biomass</th>
                      <th scope="col">Destination</th>
                      <th scope="col">Permanence</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>2026-09-08</td><td>Pond 01</td><td>180 kg</td><td>Biofuel</td><td>Long-term (~20 yr)</td></tr>
                    <tr><td>2026-08-30</td><td>Pond 02</td><td>150 kg</td><td>Animal feed</td><td>Short-term (~1 yr)</td></tr>
                    <tr><td>2026-08-22</td><td>Pond 03</td><td>165 kg</td><td>Bioplastic</td><td>Long-term (~15 yr)</td></tr>
                    <tr><td>2026-08-11</td><td>Pond 01</td><td>175 kg</td><td>Biochar</td><td>Permanent (100+ yr)</td></tr>
                  </tbody>
                </table>
              </section>
            )}

            <footer className="foot-note">
              This preview is generated from monitoring records. It is intended to demonstrate the MRV reporting workflow and prepare data for formal third-party verification.
            </footer>
          </article>
        </main>
      </div>
    </div>
  );
}
