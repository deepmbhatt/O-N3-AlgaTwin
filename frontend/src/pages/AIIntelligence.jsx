import React from 'react';
import Scene from '../components/Scene';
import Navigation from '../components/Navigation';

const AI_DATA = {
  p1: {
    name: 'Pond P1', health: 96, anomalyProb: 4, confidence: 96,
    cause: null,
    forecast6h: 4.31, forecast24h: 4.34,
    carbonImpactKg: 0, carbonWindowDays: 7,
  },
  p2: {
    name: 'Pond P2', health: 78, anomalyProb: 58, confidence: 88,
    cause: 'Possible nutrient stress, consistent with a slow decline in dissolved oxygen over the last 6 hours.',
    forecast6h: 3.58, forecast24h: 3.55,
    carbonImpactKg: -22, carbonWindowDays: 7,
  },
  p3: {
    name: 'Pond P3', health: 38, anomalyProb: 87, confidence: 87,
    cause: 'Nutrient stress compounded by elevated temperature. Similar pattern preceded two prior productivity drops.',
    forecast6h: 2.90, forecast24h: 2.68,
    carbonImpactKg: -160, carbonWindowDays: 7,
  },
};

function healthColor(h) {
  const stops = [
    [100, [47, 190, 134]], [85, [63, 203, 152]], [70, [183, 195, 75]],
    [55, [217, 138, 61]], [35, [178, 85, 47]], [0, [122, 59, 51]],
  ];
  h = Math.max(0, Math.min(100, h));
  for (let i = 0; i < stops.length - 1; i++) {
    const [h1, c1] = stops[i], [h2, c2] = stops[i + 1];
    if (h <= h1 && h >= h2) {
      const t = (h - h2) / (h1 - h2 || 1);
      const c = c1.map((v, idx) => Math.round(v * t + c2[idx] * (1 - t)));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1].join(',')})`;
}
function anomalyColor(pct) { return pct < 20 ? '#2FBE86' : pct < 60 ? '#D98A3D' : '#B2422F'; }

export default function AIIntelligence() {
  const ponds = Object.values(AI_DATA);
  const anomalies = ponds.filter(p => p.anomalyProb >= 20).length;
  const avgConf = Math.round(ponds.reduce((s, p) => s + p.confidence, 0) / ponds.length);

  return (
    <>
      <Scene>
        <div className="veil"></div>
      </Scene>
      <Navigation />
      
      <div className="page">
        <div className="page-head">
          <h1>AI Intelligence</h1>
          <p>Every number below is labelled by where it came from — sensors, imagery, or a model — so nothing is a black box.</p>
          <span className="proto-note">Prototype model output — values are simulated, not from a live ML pipeline</span>
        </div>

        <div className="legend glass" role="region" aria-label="Data source legend">
          <div className="legend-item"><span className="swatch" style={{ background: 'var(--tag-measured)' }}></span><span className="ltext"><span className="ltitle">Measured</span><span className="ldesc">Direct sensor reading</span></span></div>
          <div className="legend-item"><span className="swatch" style={{ background: 'var(--tag-estimated)' }}></span><span className="ltext"><span className="ltitle">Estimated</span><span className="ldesc">Derived from current data</span></span></div>
          <div className="legend-item"><span className="swatch" style={{ background: 'var(--tag-predicted)' }}></span><span className="ltext"><span className="ltitle">Predicted</span><span className="ldesc">Prototype model forecast, not yet observed</span></span></div>
          <div className="legend-item"><span className="swatch" style={{ background: 'var(--tag-verified)' }}></span><span className="ltext"><span className="ltitle">Verified</span><span className="ldesc">Cross-checked with satellite/drone imagery</span></span></div>
        </div>

        <div className="summary-row" role="region" aria-label="Summary statistics">
          <div className="summary-card glass"><div className="label">Anomalies flagged</div><div className="value hero">{anomalies}</div></div>
          <div className="summary-card glass"><div className="label">Avg. prototype model confidence</div><div className="value">{avgConf}%</div></div>
          <div className="summary-card glass"><div className="label">Prototype models active</div><div className="value">3</div></div>
          <div className="summary-card glass"><div className="label">Last updated (simulated)</div><div className="value" style={{ fontSize: '16px' }}>Just now</div></div>
        </div>

        <div className="cards-row" role="region" aria-label="Per-pond model output">
          {ponds.map(p => {
            const color = healthColor(p.health);
            const aColor = anomalyColor(p.anomalyProb);
            
            return (
              <div key={p.name} className="ai-card glass" role="article" aria-label={`${p.name} model output`}>
                <div className="ai-card-head">
                  <div className={`mini-pond ${p.anomalyProb >= 60 ? 'pulse' : ''}`} style={{ background: `radial-gradient(circle at 35% 30%, ${color}, rgba(10,50,40,0.9))` }} aria-hidden="true"></div>
                  <div>
                    <h3>{p.name}</h3>
                    <div className="sub">Operational Health Score: {p.health}%</div>
                  </div>
                  <div className="anomaly-badge">
                    <div className="pct" style={{ color: aColor }}>{p.anomalyProb}%</div>
                    <div className="plabel">anomaly probability</div>
                  </div>
                </div>

                {p.cause ? (
                  <div className="ai-row"><span className="ai-tag tag-estimated">Estimated</span><span>{p.cause}</span></div>
                ) : (
                  <div className="ai-row"><span className="ai-tag tag-verified">Verified</span><span>No anomaly detected in the prototype model.</span></div>
                )}

                <div className="forecast-pair">
                  <div className="forecast-box">
                    <div className="flabel">6h biomass forecast</div>
                    <div className="fval">{p.forecast6h.toFixed(2)} g/L</div>
                  </div>
                  <div className="forecast-box">
                    <div className="flabel">24h biomass forecast</div>
                    <div className="fval">{p.forecast24h.toFixed(2)} g/L</div>
                  </div>
                </div>

                <div className="ai-row"><span className="ai-tag tag-predicted">Predicted</span><span>{p.carbonImpactKg < 0 ? `Projected CO₂ capture impact over the next ${p.carbonWindowDays} days: ${p.carbonImpactKg} kg CO₂ if current conditions persist.` : `No negative CO₂ capture impact projected over the next ${p.carbonWindowDays} days.`}</span></div>

                <div className="conf-wrap">
                  <div className="conf-label"><span>Prototype model confidence</span><span>{p.confidence}%</span></div>
                  <div className="conf-bar"><div className="conf-fill" style={{ width: p.confidence + '%', background: color }}></div></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="demo-data-badge" aria-label="Prototype using simulated data">PROTOTYPE · Simulated Data</div>
    </>
  );
}
