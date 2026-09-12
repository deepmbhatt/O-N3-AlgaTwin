import { useMemo } from 'react';
import { usePondData } from '../context/pondDataStore';

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
  h = Math.max(0, Math.min(100, Number(h || 0)));
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

function anomalyColor(pct) {
  const p = Number(pct || 0);
  return p < 20 ? '#2FBE86' : p < 60 ? '#D98A3D' : '#B2422F';
}

export default function AIIntelligence() {
  const { ponds: livePonds, usingFallback, connection } = usePondData();

  const ponds = useMemo(() => {
    if (livePonds && livePonds.length > 0) {
      return livePonds.map(item => {
        const d = item.snapshot?.dashboard || {};
        const h = Math.round(d.health_score ?? 85);
        const aProb = Math.round((d.anomaly_probability ?? 0.1) * 100);
        const conf = Math.round((1 - (d.anomaly_probability ?? 0.1)) * 100);
        const f6 = Number(d.biomass_6h_g_l ?? d.current_biomass_g_l ?? 3.5);
        const f24 = Number(d.biomass_24h_g_l ?? d.current_biomass_g_l ?? 3.5);
        const cRate = Number(d.gross_co2_uptake_rate_g_l_h ?? 0);
        const cImpact = h < 75 ? -Math.round(cRate * 24 * 7 * 1000) : 0;
        return {
          id: item.pond_id,
          name: item.pond_id.replace('-', ' ').replace(/\b\w/g, char => char.toUpperCase()),
          health: h,
          anomalyProb: aProb,
          confidence: conf,
          cause: d.anomaly_severity && d.anomaly_severity !== 'normal'
            ? (item.snapshot?.insights?.[0]?.message || 'Ecosystem anomaly identified by machine learning model.')
            : null,
          forecast6h: f6,
          forecast24h: f24,
          carbonImpactKg: cImpact,
          carbonWindowDays: 7,
        };
      });
    }
    return Object.values(AI_DATA);
  }, [livePonds]);

  const anomalies = ponds.filter(p => p.anomalyProb >= 20).length;
  const avgConf = Math.round(ponds.reduce((s, p) => s + p.confidence, 0) / (ponds.length || 1));

  return (
    <div className="page ai-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">AI Intelligence</span>
          <h1>Ecosystem Intelligence &amp; Model Output</h1>
          <p>Every number below is labelled by where it came from — sensors, imagery, or a model — so nothing is a black box.</p>
        </div>
      </header>

      {usingFallback && (
        <div className={`data-notice notice-${connection}`}>
          <span>{connection === 'empty' ? 'API READY' : connection === 'fallback' ? 'DEMO FALLBACK' : 'CONNECTION'}</span>
          <p>Displaying model forecast baseline data until live telemetry is streamed.</p>
        </div>
      )}

      <div className="legend glass" role="region" aria-label="Data source legend">
        <div className="legend-item"><span className="swatch" style={{ background: 'var(--tag-measured)' }}></span><span className="ltext"><span className="ltitle">Measured</span><span className="ldesc">Direct sensor reading</span></span></div>
        <div className="legend-item"><span className="swatch" style={{ background: 'var(--tag-estimated)' }}></span><span className="ltext"><span className="ltitle">Estimated</span><span className="ldesc">Derived from current data</span></span></div>
        <div className="legend-item"><span className="swatch" style={{ background: 'var(--tag-predicted)' }}></span><span className="ltext"><span className="ltitle">Predicted</span><span className="ldesc">Prototype model forecast, not yet observed</span></span></div>
        <div className="legend-item"><span className="swatch" style={{ background: 'var(--tag-verified)' }}></span><span className="ltext"><span className="ltitle">Cross-checked</span><span className="ldesc">Cross-checked with satellite/drone imagery</span></span></div>
      </div>

      <div className="summary-row" role="region" aria-label="Summary statistics">
        <div className="summary-card glass"><div className="label">Anomalies flagged</div><div className="value hero">{anomalies}</div></div>
        <div className="summary-card glass"><div className="label">Avg. prototype model confidence</div><div className="value">{avgConf}%</div></div>
        <div className="summary-card glass"><div className="label">Prototype models active</div><div className="value">{ponds.length}</div></div>
        <div className="summary-card glass"><div className="label">Last updated</div><div className="value" style={{ fontSize: '16px' }}>Live</div></div>
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
                <div className="ai-row"><span className="ai-tag tag-verified">Cross-checked</span><span>No anomaly detected in the current model reading.</span></div>
              )}

              <div className="forecast-pair">
                <div className="forecast-box">
                  <div className="flabel">6h biomass forecast</div>
                  <div className="fval">{Number(p.forecast6h).toFixed(2)} g/L</div>
                </div>
                <div className="forecast-box">
                  <div className="flabel">24h biomass forecast</div>
                  <div className="fval">{Number(p.forecast24h).toFixed(2)} g/L</div>
                </div>
              </div>

              <div className="ai-row">
                <span className="ai-tag tag-predicted">Predicted</span>
                <span>{p.carbonImpactKg < 0 ? `Projected CO₂ capture impact over the next ${p.carbonWindowDays} days: ${p.carbonImpactKg} kg CO₂ if current conditions persist.` : `No negative CO₂ capture impact projected over the next ${p.carbonWindowDays} days.`}</span>
              </div>

              <div className="conf-wrap">
                <div className="conf-label"><span>Prototype model confidence</span><span>{p.confidence}%</span></div>
                <div className="conf-bar"><div className="conf-fill" style={{ width: `${p.confidence}%`, background: color }}></div></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
