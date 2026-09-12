import React from 'react';
import Scene from '../components/Scene';
import Navigation from '../components/Navigation';

const WATERFALL = [
  { label: 'Gross biological CO₂ capture', sub: 'Prototype estimate from biomass growth rate data', value: 420, type: 'start' },
  { label: 'Operational emissions', sub: 'Pumps, aeration, and site energy use', delta: -38, type: 'delta' },
  { label: 'Net biological capture', sub: 'Gross capture minus operational emissions', value: 382, type: 'subtotal' },
  { label: 'Biomass fate & permanence adjustment', sub: 'Weighted by the destinations in the fate ledger', delta: -74, type: 'delta' },
  { label: 'Estimated net carbon removal', sub: 'Prototype estimate — pending evidence pipeline verification', value: 308, type: 'final' },
];

const FACTORS = [
  { name: 'Sensor completeness', value: 96 },
  { name: 'Sensor consistency', value: 93 },
  { name: 'Imagery agreement', value: 94 },
  { name: 'Model confidence', value: 90 },
  { name: 'Data freshness', value: 88 },
  { name: 'Biomass-fate traceability', value: 85 },
];
const OVERALL_CONFIDENCE = Math.round(FACTORS.reduce((s, f) => s + f.value, 0) / FACTORS.length);

const LEDGER = [
  { date: '2026-09-08', pond: 'Pond P1', biomass: 180, dest: 'Biofuel', perm: 'longterm', permLabel: 'Long-term (~20 yr)' },
  { date: '2026-08-30', pond: 'Pond P2', biomass: 150, dest: 'Animal feed', perm: 'shortterm', permLabel: 'Short-term (~1 yr)' },
  { date: '2026-08-22', pond: 'Pond P3', biomass: 165, dest: 'Bioplastic', perm: 'longterm', permLabel: 'Long-term (~15 yr)' },
  { date: '2026-08-11', pond: 'Pond P1', biomass: 175, dest: 'Biochar', perm: 'permanent', permLabel: 'Permanent (100+ yr)' },
  { date: '2026-07-29', pond: 'Pond P2', biomass: 140, dest: 'Food', perm: 'shortterm', permLabel: 'Short-term (<1 yr)' },
];
const FATE_COLORS = { permanent: '#2F7D5A', longterm: '#0F5850', shortterm: '#D98A3D' };
const PERM_CLASS = { permanent: 'perm-permanent', longterm: 'perm-longterm', shortterm: 'perm-shortterm' };

export default function CarbonMRV() {
  return (
    <>
      <Scene>
        <div className="veil"></div>
      </Scene>
      <Navigation />
      
      <div className="page">
        <div className="page-head">
          <h1>Carbon MRV</h1>
          <p>How a raw biological CO₂ uptake number becomes an estimated net carbon removal value — and how trustworthy that estimate is.</p>
        </div>

        <div className="hierarchy-strip glass" role="region" aria-label="Carbon accounting hierarchy">
          <span className="step">Gross biological CO₂ capture</span>
          <span className="arrow">→</span>
          <span className="step">Operational emissions</span>
          <span className="arrow">→</span>
          <span className="step">Net biological capture</span>
          <span className="arrow">→</span>
          <span className="step">Biomass fate &amp; permanence adjustment</span>
          <span className="arrow">→</span>
          <span className="step">Estimated net carbon removal</span>
        </div>

        <div className="mrv-grid">
          <div id="waterfall" className="glass" role="region" aria-label="Carbon accounting waterfall">
            <h3>Carbon accounting waterfall — last 30 days</h3>
            <div className="wf-note">Prototype estimates based on simulated sensor and biomass data.</div>
            <div id="wfRows">
              {WATERFALL.map((row, i) => {
                const isFinal = row.type === 'final';
                const dotColor = isFinal ? '#0F5850' : row.type === 'delta' ? '#B2422F' : '#2FBE86';
                const dotContent = row.type === 'delta' ? '−' : (i + 1);
                
                return (
                  <div key={i} className={`wf-row ${isFinal ? 'final' : ''}`}>
                    <div className="wf-dot" style={{ background: dotColor }}>{dotContent}</div>
                    <div>
                      <div className="wf-label">{row.label}</div>
                      <div className="wf-sub">{row.sub}</div>
                    </div>
                    {row.type === 'delta' ? (
                      <span className="wf-val delta-neg">{row.delta} kg</span>
                    ) : (
                      <span className="wf-val">{row.value} kg</span>
                    )}
                  </div>
                );
              })}
              <div className="wf-disclaimer">This estimate does not constitute independently verified carbon removal. Verification will be completed via the satellite/imagery evidence pipeline in a future sprint.</div>
            </div>
          </div>

          <div id="confidence" className="glass" role="region" aria-label="Carbon confidence score">
            <h3>Carbon Confidence Score</h3>
            <div className="sub">Prototype confidence score — factors listed below. Final verification will depend on future evidence pipeline.</div>
            <div className="gauge-wrap">
              <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(14,38,34,0.1)" strokeWidth="8"/>
                <circle id="confArc" cx="36" cy="36" r="30" fill="none" stroke="#0F5850" strokeWidth="8" strokeLinecap="round" strokeDasharray="188.5" strokeDashoffset={188.5 * (1 - OVERALL_CONFIDENCE / 100)} transform="rotate(-90 36 36)"/>
              </svg>
              <div>
                <div className="gauge-big-val">{OVERALL_CONFIDENCE}%</div>
                <div className="gauge-big-label">overall confidence (prototype)</div>
              </div>
            </div>
            <div id="factorRows">
              {FACTORS.map((f, i) => (
                <div key={i} className="factor-row">
                  <div className="factor-label"><span>{f.name}</span><span>{f.value}%</span></div>
                  <div className="factor-bar"><div className="factor-fill" style={{ width: `${f.value}%` }}></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div id="ledger" className="glass" role="region" aria-label="Carbon fate ledger">
          <h3>Carbon Fate Ledger</h3>
          <div className="sub">Carbon captured into algae biomass is not automatically the same as permanent carbon removal — the destination of each harvest determines how long that carbon stays out of the atmosphere. Records below are demonstration data.</div>
          <table className="ledger-table">
            <thead>
              <tr><th>Date</th><th>Pond</th><th>Biomass</th><th>Destination</th><th>Permanence</th></tr>
            </thead>
            <tbody>
              {LEDGER.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.pond}</td>
                  <td>{r.biomass} kg</td>
                  <td><span className="fate-pill"><span className="ficon" style={{ background: FATE_COLORS[r.perm] }}></span>{r.dest}</span></td>
                  <td><span className={`perm-badge ${PERM_CLASS[r.perm]}`}>{r.permLabel}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="demo-data-badge" aria-label="Prototype using simulated data">PROTOTYPE • SIMULATED DATA</div>
    </>
  );
}
