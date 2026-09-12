import React, { useState, useEffect } from 'react';
import Scene from '../components/Scene';
import Navigation from '../components/Navigation';

// Lock body scroll for this fixed-layout page
function useBodyOverflowHidden() {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
}

const initialPonds = {
  p1: { name: 'Pond P1', health: 96, activity: 0.92, temp: 24.3, ph: 7.10, do: 8.3, turb: 11, co2in: 122, co2out: 16, light: 780, nutrient: 'Optimal', state: 'healthy' },
  p2: { name: 'Pond P2', health: 94, activity: 0.88, temp: 24.6, ph: 7.05, do: 8.1, turb: 13, co2in: 119, co2out: 18, light: 762, nutrient: 'Optimal', state: 'healthy' },
  p3: { name: 'Pond P3', health: 95, activity: 0.90, temp: 24.5, ph: 7.08, do: 8.2, turb: 12, co2in: 121, co2out: 17, light: 770, nutrient: 'Optimal', state: 'healthy' },
};

const PRESETS = {
  healthy: { health: 95, activity: 0.90, temp: 24.5, ph: 7.08, do: 8.2, turb: 12, co2in: 121, co2out: 17, nutrient: 'Optimal', tint: null, pulse: null, message: null },
  mild: { health: 78, activity: 0.62, temp: 25.4, ph: 6.92, do: 7.4, turb: 19, co2in: 104, co2out: 38, nutrient: 'Slightly low', tint: 'amber', pulse: 'pulse',
    message: { title: 'Mild Stress Detected', body: 'Productivity is trending 6% below expected behaviour. No intervention required yet — continue monitoring.' } },
  nutrient: { health: 70, activity: 0.52, temp: 25.1, ph: 6.85, do: 7.1, turb: 22, co2in: 98, co2out: 44, nutrient: 'Below optimal', tint: 'amber', pulse: 'pulse',
    message: { title: 'Possible Nutrient Stress', body: 'Nutrient concentration has dropped below optimal range. Productivity is currently 12% below expected behaviour.' } },
  heat: { health: 66, activity: 0.48, temp: 29.2, ph: 6.95, do: 6.6, turb: 24, co2in: 95, co2out: 47, nutrient: 'Optimal', tint: 'orange', pulse: 'pulse',
    message: { title: 'High Temperature Stress', body: 'Pond temperature has risen 4.7°C above target range, reducing growth efficiency and gas exchange.' } },
  co2fail: { health: 60, activity: 0.14, temp: 24.8, ph: 7.20, do: 5.9, turb: 20, co2in: 31, co2out: 6, nutrient: 'Optimal', tint: 'orange', pulse: 'pulse',
    message: { title: 'CO₂ Supply Disruption', body: 'Inlet CO₂ flow has dropped sharply. Absorption rate is critically reduced across this pond.' } },
  critical: { health: 38, activity: 0.08, temp: 27.6, ph: 6.68, do: 5.1, turb: 31, co2in: 52, co2out: 11, nutrient: 'Deficient', tint: 'red', pulse: 'pulse-fast',
    message: { title: 'Critical Anomaly — 87% probability', body: 'Biomass productivity has fallen 18%. Possible nutrient stress detected. Estimated 7-day carbon capture impact: −160 kg CO₂ if untreated.' } },
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
function dotColor(kind) { return ringColor(kind) || '#2FBE86'; }

const DEMO_TARGET = 'p3';

export default function CommandCenter() {
  useBodyOverflowHidden();
  const [night, setNight] = useState(false);
  const [ponds, setPonds] = useState(initialPonds);
  const [selectedPond, setSelectedPond] = useState('p1');
  const [kpis, setKpis] = useState({ co2: 0, health: 0, conf: 96, biomass: 0, anomalies: 0 });
  const [bubbles, setBubbles] = useState({});

  useEffect(() => {
    // Generate bubbles statically for each pond
    const newBubbles = {};
    Object.keys(ponds).forEach(id => {
      newBubbles[id] = Array.from({ length: 10 }).map((_, i) => ({
        id: i,
        size: 3 + Math.random() * 5,
        left: 10 + Math.random() * 80,
        baseDur: 3.5 + Math.random() * 3,
        delay: Math.random() * 4
      }));
    });
    setBubbles(newBubbles);
  }, []);

  useEffect(() => {
    const pondArr = Object.values(ponds);
    const health = pondArr.reduce((s, p) => s + p.health, 0) / pondArr.length;
    const co2 = pondArr.reduce((s, p) => s + p.activity * 158, 0);
    const biomass = 2.3 + (health / 100) * 2.1;
    const anomalies = pondArr.filter(p => p.state !== 'healthy').length;
    const criticalCount = pondArr.filter(p => p.state === 'critical').length;
    let conf = 97 - anomalies * 5 - criticalCount * 9;
    conf = Math.max(52, Math.min(98, conf));
    setKpis({ co2, health, conf, biomass, anomalies });
  }, [ponds]);

  const applyDemoState = (stateKey) => {
    const preset = PRESETS[stateKey];
    if (!preset) return;
    
    setPonds(prev => ({
      ...prev,
      [DEMO_TARGET]: {
        ...prev[DEMO_TARGET],
        health: preset.health, activity: preset.activity, temp: preset.temp, ph: preset.ph,
        do: preset.do, turb: preset.turb, co2in: preset.co2in, co2out: preset.co2out,
        nutrient: preset.nutrient, state: stateKey,
      }
    }));
    if (selectedPond !== DEMO_TARGET) setSelectedPond(DEMO_TARGET);
  };

  const p = ponds[selectedPond];
  const targetPond = ponds[DEMO_TARGET];
  const warningPreset = targetPond ? PRESETS[targetPond.state] : null;

  return (
    <>
      <Scene night={night}>
        <div className="ponds-layer" id="pondsLayer">
          {Object.keys(ponds).map(id => {
            const pond = ponds[id];
            const preset = PRESETS[pond.state];
            const hasTint = preset && preset.tint;
            const wrapClass = `pond-wrap ${id === selectedPond ? 'selected' : ''} ${hasTint ? (preset.pulse || 'pulse') : ''}`;
            const c = healthColor(pond.health);

            return (
              <div key={id} className={wrapClass} role="button" tabIndex="0" aria-label={`${pond.name} — click to inspect`} onClick={() => setSelectedPond(id)} onKeyDown={e => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPond(id); }}}>
                <div className="pond-tint" style={{
                  opacity: hasTint ? 1 : 0,
                  background: hasTint ? `radial-gradient(circle, ${tintColor(preset.tint)}, transparent 70%)` : 'transparent'
                }}></div>
                <div className="pond-ring" style={{
                  opacity: hasTint ? 0.9 : 0,
                  borderColor: hasTint ? ringColor(preset.tint) : 'transparent'
                }}></div>
                <div className="pond" style={{ background: `radial-gradient(circle at 35% 28%, ${c}, ${c} 40%, rgba(10,50,40,0.9) 100%)` }}>
                  <div className="pond-surface"></div>
                  <div className="bubbles">
                    {(bubbles[id] || []).map(b => {
                      const dur = b.baseDur / Math.max(0.15, pond.activity);
                      return (
                        <div key={b.id} className="bubble" style={{
                          width: b.size + 'px', height: b.size + 'px', left: b.left + '%',
                          animationDuration: dur + 's', animationDelay: b.delay + 's',
                          opacity: Math.max(0.25, pond.activity)
                        }}></div>
                      );
                    })}
                  </div>
                  <div className="patches" style={{ opacity: pond.health < 45 ? Math.min(1, (45 - pond.health) / 25) : 0 }}></div>
                </div>
                <div className="pond-label">
                  <span className="pname">{pond.name}</span>
                  <span className="phealth">{Math.round(pond.health)}% health</span>
                </div>
              </div>
            );
          })}
        </div>
      </Scene>

      <Navigation onNightToggle={() => setNight(!night)} />

      <div className="kpi-bar glass" role="region" aria-label="Farm KPIs">
        <div className="kpi hero">
          <div className="label">CO₂ Capture Estimate Today</div>
          <div className="value"><span className="num">{Math.round(kpis.co2)}</span><span className="unit">kg</span></div>
        </div>
        <div className="kpi">
          <div className="label">Farm Health Score</div>
          <div className="value"><span className="num">{Math.round(kpis.health)}</span><span className="unit">%</span></div>
        </div>
        <div className="kpi">
          <div className="label">Carbon Confidence Score</div>
          <div className="value"><span className="num">{Math.round(kpis.conf)}</span><span className="unit">%</span></div>
        </div>
        <div className="kpi">
          <div className="label">Biomass Estimate</div>
          <div className="value"><span className="num">{kpis.biomass.toFixed(2)}</span><span className="unit">g/L</span></div>
        </div>
        <div className="kpi">
          <div className="label">Active Anomalies</div>
          <div className="value"><span className="num">{kpis.anomalies}</span></div>
        </div>
      </div>

      <div className="env-panel glass" role="region" aria-label="Environmental sensor readings">
        <h3>{p.name}</h3>
        <div className="sub">Sensor readings (simulated)</div>
        <div className="env-row"><span>Temperature</span><span>{p.temp.toFixed(1)} °C</span></div>
        <div className="env-row"><span>pH</span><span>{p.ph.toFixed(2)}</span></div>
        <div className="env-row"><span>Dissolved oxygen</span><span>{p.do.toFixed(1)} mg/L</span></div>
        <div className="env-row"><span>Turbidity</span><span>{p.turb} NTU</span></div>
        <div className="env-row"><span>CO₂ inlet / outlet</span><span>{p.co2in} / {p.co2out} L/min</span></div>
        <div className="env-row"><span>Light intensity</span><span>{p.light} µmol/m²/s</span></div>
        <div className="env-row"><span>Nutrient status</span><span>{p.nutrient}</span></div>
      </div>

      <div className="demo-panel glass" role="region" aria-label="Demo scenario controls">
        <span className="dtitle">Demo scenarios — Pond P3</span>
        {Object.keys(PRESETS).map(key => (
          <button key={key} className={`demo-btn ${targetPond.state === key ? 'active' : ''}`} onClick={() => applyDemoState(key)} title={`Apply ${key} scenario`}>
            {key === 'healthy' ? 'Healthy' : key === 'mild' ? 'Mild Stress' : key === 'nutrient' ? 'Nutrient Stress' : key === 'heat' ? 'High Temperature' : key === 'co2fail' ? 'CO₂ Supply Failure' : 'Critical Anomaly'}
          </button>
        ))}
      </div>

      <div className={`warning-card glass ${warningPreset && warningPreset.message ? 'show' : ''}`} role="alert" aria-live="polite">
        <div className="wtitle"><span className="wdot" style={{ background: warningPreset ? dotColor(warningPreset.tint) : '' }}></span><span>{warningPreset?.message?.title || '—'}</span></div>
        <p>{warningPreset?.message?.body || '—'}</p>
      </div>

      <div className="demo-data-badge" aria-label="This is a prototype using simulated data">PROTOTYPE · Simulated Data</div>
    </>
  );
}
