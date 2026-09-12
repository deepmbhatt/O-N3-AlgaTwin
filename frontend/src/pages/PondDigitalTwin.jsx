import React, { useState, useEffect } from 'react';
import Scene from '../components/Scene';
import Navigation from '../components/Navigation';

function useBodyOverflowHidden() {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
}

const PONDS = {
  p1: {
    name: 'Pond P1', state: 'healthy', health: 96,
    temp: 24.3, ph: 7.10, do: 8.3,
    now: { biomass: 4.28, co2: 52, health: 96 },
    expected: { biomass: 4.30, co2: 53, health: 97 },
    predicted: { biomass: 4.34, co2: 54, health: 97 },
    confidence: 95, carbonLossKg: 0,
    history: [4.05, 4.10, 4.15, 4.20, 4.24, 4.28],
    forecast: [4.28, 4.30, 4.32, 4.33, 4.34],
  },
  p2: {
    name: 'Pond P2', state: 'mild', health: 78,
    temp: 25.4, ph: 6.92, do: 7.4,
    now: { biomass: 3.62, co2: 41, health: 78 },
    expected: { biomass: 4.10, co2: 50, health: 93 },
    predicted: { biomass: 3.55, co2: 39, health: 74 },
    confidence: 88, carbonLossKg: 22,
    history: [4.05, 3.98, 3.88, 3.78, 3.70, 3.62],
    forecast: [3.62, 3.60, 3.58, 3.56, 3.55],
  },
  p3: {
    name: 'Pond P3', state: 'critical', health: 38,
    temp: 27.6, ph: 6.68, do: 5.1,
    now: { biomass: 3.05, co2: 23, health: 38 },
    expected: { biomass: 4.20, co2: 51, health: 95 },
    predicted: { biomass: 2.68, co2: 16, health: 29 },
    confidence: 87, carbonLossKg: 38,
    history: [4.02, 3.85, 3.60, 3.35, 3.18, 3.05],
    forecast: [3.05, 2.94, 2.85, 2.75, 2.68],
  },
};

const PRESET_META = {
  healthy: { tint: null, pulse: null },
  mild: { tint: 'amber', pulse: 'pulse' },
  nutrient: { tint: 'amber', pulse: 'pulse' },
  heat: { tint: 'orange', pulse: 'pulse' },
  co2fail: { tint: 'orange', pulse: 'pulse' },
  critical: { tint: 'red', pulse: 'pulse-fast' },
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

function tintColor(kind) { return { amber: 'rgba(217,138,61,0.55)', orange: 'rgba(201,106,46,0.55)', red: 'rgba(178,66,47,0.6)' }[kind] || 'transparent'; }
function ringColor(kind) { return { amber: '#D98A3D', orange: '#C96A2E', red: '#B2422F' }[kind] || 'transparent'; }
function statusLabel(state) {
  return { healthy: 'Healthy', mild: 'Mild stress', nutrient: 'Nutrient stress', heat: 'Heat stress', co2fail: 'CO₂ supply failure', critical: 'Critical anomaly' }[state] || state;
}

function buildNarrative(p) {
  const lines = [];
  const deltaProd = Math.round((p.expected.biomass - p.now.biomass) / p.expected.biomass * 100);
  if (deltaProd > 2) {
    lines.push({ tag: 'Estimated', cls: 'tag-estimated', text: `Productivity is currently ${deltaProd}% below expected behaviour.` });
  } else {
    lines.push({ tag: 'Estimated', cls: 'tag-estimated', text: 'Productivity is tracking in line with expected behaviour.' });
  }
  lines.push({ tag: 'Predicted', cls: 'tag-predicted', text: `24-hour biomass forecast: ${p.predicted.biomass.toFixed(2)} g/L.` });
  if (p.state === 'mild' || p.state === 'nutrient') lines.push({ tag: 'Estimated', cls: 'tag-estimated', text: 'Possible nutrient stress detected in prototype model.' });
  if (p.state === 'heat') lines.push({ tag: 'Measured', cls: 'tag-measured', text: `Water temperature is running ${(p.temp - 24.5).toFixed(1)}°C above target range.` });
  if (p.state === 'co2fail') lines.push({ tag: 'Measured', cls: 'tag-measured', text: 'CO₂ inlet flow has dropped sharply below normal range.' });
  if (p.state === 'critical') lines.push({ tag: 'Predicted', cls: 'tag-predicted', text: `Projected carbon capture impact if no action: ${p.carbonLossKg} kg CO₂ over the next 24 hours.` });
  return lines;
}

export default function PondDigitalTwin() {
  useBodyOverflowHidden();
  const [selected, setSelected] = useState('p3');
  const [bubbles, setBubbles] = useState([]);

  useEffect(() => {
    setBubbles(Array.from({ length: 14 }).map((_, i) => ({
      id: i,
      size: 3 + Math.random() * 6,
      left: 8 + Math.random() * 84,
      baseDur: 4 + Math.random() * 4,
      delay: Math.random() * 5
    })));
  }, []);

  const p = PONDS[selected];
  const meta = PRESET_META[p.state] || {};
  const color = healthColor(p.health);
  const activity = Math.max(0.08, p.health / 100);
  const circumference = 150.8;

  const deltaSpan = (now, pred) => {
    const cls = pred >= now ? 'delta-up' : 'delta-down';
    const arrow = pred >= now ? '▲' : '▼';
    return <span className={cls}>{arrow}</span>;
  };

  const renderChart = () => {
    const w = 640, h = 170, padL = 30, padR = 10, padT = 10, padB = 24;
    const allVals = [...p.history, ...p.forecast, p.expected.biomass];
    const minV = Math.min(...allVals) - 0.2, maxV = Math.max(...allVals) + 0.2;
    const n = p.history.length + p.forecast.length - 1;
    const xAt = i => padL + (i / n) * (w - padL - padR);
    const yAt = v => padT + (1 - (v - minV) / (maxV - minV)) * (h - padT - padB);

    const histPts = p.history.map((v, i) => [xAt(i), yAt(v)]);
    const fcPts = p.forecast.map((v, i) => [xAt(i + p.history.length - 1), yAt(v)]);
    const baseline = [[xAt(0), yAt(p.expected.biomass)], [xAt(n), yAt(p.expected.biomass)]];
    const toPath = pts => 'M ' + pts.map(pt => pt.join(',')).join(' L ');
    const nowX = xAt(p.history.length - 1);

    return (
      <svg id="chartSvg" viewBox="0 0 640 170" width="100%" height="170" aria-label="Biomass trend chart" role="img">
        <line x1={padL} y1={padT} x2={padL} y2={h - padB} stroke="rgba(14,38,34,0.15)"/>
        <line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} stroke="rgba(14,38,34,0.15)"/>
        <line x1={nowX} y1={padT} x2={nowX} y2={h - padB} stroke="rgba(14,38,34,0.25)" strokeDasharray="3 4"/>
        <path d={toPath(baseline)} fill="none" stroke="#7FE0CC" strokeWidth="2" strokeDasharray="5 5"/>
        <path d={toPath(histPts)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={toPath(fcPts)} fill="none" stroke={color} strokeWidth="3" strokeDasharray="2 6" strokeLinecap="round" strokeLinejoin="round" opacity="0.75"/>
        {histPts.map((pt, i) => <circle key={i} cx={pt[0]} cy={pt[1]} r="3" fill={color}/>)}
        <circle cx={fcPts[fcPts.length - 1][0]} cy={fcPts[fcPts.length - 1][1]} r="3.5" fill={color} opacity="0.75"/>
        <text x={padL} y={h - 6} fontSize="10" fill="#3E5850" fontFamily="Inter">-24h</text>
        <text x={nowX} y={h - 6} fontSize="10" fill="#3E5850" fontFamily="Inter" textAnchor="middle">now</text>
        <text x={w - padR} y={h - 6} fontSize="10" fill="#3E5850" fontFamily="Inter" textAnchor="end">+24h</text>
      </svg>
    );
  };

  return (
    <>
      <Scene />
      <Navigation />
      
      <div className="dt-grid">
        <div id="tabsRow" className="glass" role="tablist" aria-label="Select pond">
          {Object.keys(PONDS).map(id => {
            const pond = PONDS[id];
            return (
              <button key={id} className={`tab-btn ${id === selected ? 'active' : ''}`} role="tab" aria-selected={id === selected} aria-label={pond.name} onClick={() => setSelected(id)}>
                <span className="dot" style={{ background: healthColor(pond.health) }}></span>{pond.name}
              </button>
            );
          })}
        </div>

        <div id="currentCard" className="glass" role="region" aria-label="Current pond readings">
          <h3>{p.name}</h3>
          <div className="status">{statusLabel(p.state)}</div>
          <div className="gauge-row">
            <svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true">
              <circle cx="29" cy="29" r="24" fill="none" stroke="rgba(14,38,34,0.1)" strokeWidth="7"/>
              <circle cx="29" cy="29" r="24" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - p.health / 100)} transform="rotate(-90 29 29)"/>
            </svg>
            <div>
              <div className="gauge-val">{p.health}%</div>
              <div className="gauge-label">Operational Health Score</div>
            </div>
          </div>
          <div className="metric-row"><span><span className="metric-tag mt-measured">Measured</span>Temperature</span><span>{p.temp.toFixed(1)} °C</span></div>
          <div className="metric-row"><span><span className="metric-tag mt-measured">Measured</span>pH</span><span>{p.ph.toFixed(2)}</span></div>
          <div className="metric-row"><span><span className="metric-tag mt-measured">Measured</span>Dissolved oxygen</span><span>{p.do.toFixed(1)} mg/L</span></div>
          <div className="metric-row"><span><span className="metric-tag mt-estimated">Estimated</span>Biomass</span><span>{p.now.biomass.toFixed(2)} g/L</span></div>
          <div className="metric-row"><span><span className="metric-tag mt-estimated">Estimated</span>CO₂ capture rate</span><span>{p.now.co2} kg/day</span></div>
        </div>

        <div id="pondStage">
          <div className={`pond-big-wrap ${meta.pulse || ''}`}>
            <div className="pond-tint" style={{
              opacity: meta.tint ? 1 : 0,
              background: meta.tint ? `radial-gradient(circle, ${tintColor(meta.tint)}, transparent 70%)` : 'transparent'
            }}></div>
            <div className="pond-ring" style={{
              opacity: meta.tint ? 0.9 : 0,
              borderColor: meta.tint ? ringColor(meta.tint) : 'transparent'
            }}></div>
            <div className="pond-big" style={{ background: `radial-gradient(circle at 35% 28%, ${color}, ${color} 40%, rgba(10,50,40,0.9) 100%)` }}>
              <div className="pond-surface"></div>
              <div className="bubbles">
                {bubbles.map(b => (
                  <div key={b.id} className="bubble" style={{
                    width: b.size + 'px', height: b.size + 'px', left: b.left + '%',
                    animationDuration: (b.baseDur / activity).toFixed(2) + 's',
                    animationDelay: b.delay + 's',
                    opacity: Math.max(0.25, activity)
                  }}></div>
                ))}
              </div>
              <div className="patches" style={{ opacity: p.health < 45 ? Math.min(1, (45 - p.health) / 25) : 0 }}></div>
            </div>
          </div>
          <div>
            <div className="pond-name">{p.name}</div>
            <div className="pond-sub">{statusLabel(p.state)} · prototype digital twin</div>
          </div>
        </div>

        <div id="compareCard" className="glass" role="region" aria-label="Now vs expected vs predicted">
          <h3>Now → expected → predicted</h3>
          <div className="sub">Measured state vs healthy-model baseline vs 24h prototype forecast</div>
          <div className="cmp-head"><span></span><span>Now</span><span>Expected</span><span>+24h</span></div>
          <div className="cmp-row"><span className="metric-name">Biomass g/L</span><span>{p.now.biomass.toFixed(2)}</span><span>{p.expected.biomass.toFixed(2)}</span><span>{p.predicted.biomass.toFixed(2)} {deltaSpan(p.now.biomass, p.predicted.biomass)}</span></div>
          <div className="cmp-row"><span className="metric-name">CO₂ kg/day</span><span>{p.now.co2}</span><span>{p.expected.co2}</span><span>{p.predicted.co2} {deltaSpan(p.now.co2, p.predicted.co2)}</span></div>
          <div className="cmp-row"><span className="metric-name">Health %</span><span>{p.now.health}</span><span>{p.expected.health}</span><span>{p.predicted.health} {deltaSpan(p.now.health, p.predicted.health)}</span></div>
        </div>

        <div id="narrativeCard" className="glass" role="region" aria-label="Prototype model narrative">
          <h3>What the prototype model is showing</h3>
          <div id="narrLines">
            {buildNarrative(p).map((l, i) => (
              <div key={i} className="narr-line"><span className={`narr-tag ${l.cls}`}>{l.tag}</span><span className="narr-text">{l.text}</span></div>
            ))}
          </div>
          <div className="narr-conf">Prototype model confidence: {p.confidence}%</div>
        </div>

        <div id="chartCard" className="glass" role="region" aria-label="Biomass history and forecast chart">
          <h3>Biomass — history and forecast</h3>
          <div className="sub">Solid: measured · dashed teal: prototype forecast · dashed aqua: expected healthy baseline</div>
          {renderChart()}
        </div>
      </div>
      <div className="demo-data-badge" aria-label="Prototype using simulated data">PROTOTYPE · Simulated Data</div>
    </>
  );
}
