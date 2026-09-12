import React, { useState, useEffect, useRef } from 'react';
import Scene from '../components/Scene';
import Navigation from '../components/Navigation';

function useBodyOverflowHidden() {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
}

const BASELINE = { co2: 52, temp: 27.6, nutrient: 35, light: 620, ph: 6.68, harvest: 14 };
const IDEAL = { co2: 132, temp: 24.5, nutrient: 88, light: 780, ph: 7.05 };
const CURRENT = { health: 38, biomass: 3.05, co2capture: 23, anomalyRisk: 87 };

function closeness(val, ideal, range) { return Math.max(0, 1 - Math.abs(val - ideal) / range); }

function computeScenario(p) {
  const cCo2 = closeness(p.co2, IDEAL.co2, 100);
  const cTemp = closeness(p.temp, IDEAL.temp, 6);
  const cNutrient = closeness(p.nutrient, IDEAL.nutrient, 60);
  const cLight = closeness(p.light, IDEAL.light, 400);
  const cPh = closeness(p.ph, IDEAL.ph, 0.7);
  const score = (cCo2 * 0.28 + cTemp * 0.22 + cNutrient * 0.22 + cLight * 0.16 + cPh * 0.12);
  const health = Math.round(20 + score * 78);
  const biomass = 1.8 + (health / 100) * 2.6;
  const co2capture = Math.round((health / 100) * 165);
  const anomalyRisk = Math.max(3, Math.round(100 - health * 0.95));
  return { health, biomass, co2capture, anomalyRisk };
}

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

function tintFor(health) {
  if (health >= 80) return null;
  if (health >= 55) return 'rgba(217,138,61,0.5)';
  if (health >= 35) return 'rgba(201,106,46,0.5)';
  return 'rgba(178,66,47,0.55)';
}

const AnimatedNumber = ({ value, decimals, suffix, duration = 800 }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current === value) return;
    const start = performance.now();
    const from = prevValue.current;
    let animationFrameId;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = from + (value - from) * eased;
      setDisplayValue(val);
      if (t < 1) animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    prevValue.current = value;
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return <>{displayValue.toFixed(decimals)}{suffix}</>;
};

const Bubbles = ({ health }) => {
  const activity = Math.max(0.08, health / 100);
  const bubbles = useRef([...Array(10)].map(() => ({
    size: 3 + Math.random() * 5,
    left: (10 + Math.random() * 80),
    baseDur: 3.5 + Math.random() * 3,
    delay: Math.random() * 4
  }))).current;

  return (
    <div className="bubbles">
      {bubbles.map((b, i) => (
        <div key={i} className="bubble" style={{
          width: `${b.size}px`, height: `${b.size}px`,
          left: `${b.left}%`,
          animationDuration: `${(b.baseDur / activity).toFixed(2)}s`,
          animationDelay: `${b.delay}s`,
          opacity: Math.max(0.25, activity)
        }}></div>
      ))}
    </div>
  );
};

const PondVisual = ({ health }) => {
  const color = healthColor(health);
  const t = tintFor(health);

  return (
    <div className="pond-med-wrap">
      <div className="pond-tint" style={t ? { background: `radial-gradient(circle, ${t}, transparent 70%)`, opacity: 1 } : { opacity: 0 }}></div>
      <div className="pond-med" style={{ background: `radial-gradient(circle at 35% 28%, ${color}, ${color} 40%, rgba(10,50,40,0.9) 100%)` }}>
        <div className="pond-surface"></div>
        <Bubbles health={health} />
      </div>
    </div>
  );
};

export default function ScenarioSimulator() {
  useBodyOverflowHidden();
  const [params, setParams] = useState({ ...BASELINE });
  const [isRunning, setIsRunning] = useState(false);
  const [statusText, setStatusText] = useState('Adjust parameters, then run the scenario.');
  const [preview, setPreview] = useState(computeScenario(BASELINE));
  const [applied, setApplied] = useState(CURRENT);

  useEffect(() => {
    setPreview(computeScenario(params));
    setStatusText('Previewing live — run to see full simulated result.');
  }, [params]);

  const handleRun = () => {
    setIsRunning(true);
    setStatusText('Running simulated scenario…');
    setTimeout(() => {
      setApplied(computeScenario(params));
      setIsRunning(false);
      setStatusText('Prototype simulation complete. In production, this will connect to the ML prediction service.');
    }, 900);
  };

  const improvement = (applied.biomass - CURRENT.biomass) / CURRENT.biomass * 100;

  return (
    <>
      <Scene>
        <div className="veil"></div>
      </Scene>
      <Navigation />
      
      <div className="sim-grid">
        <div id="controls" className="glass" role="region" aria-label="Scenario parameter controls">
          <h3>Adjust Pond P3</h3>
          <div className="sub">Change operating parameters and preview the simulated outcome before applying.</div>
          <span className="proto-note">Prototype simulation — a deterministic formula, not a connected ML model. In production this will call the prediction service.</span>

          <div className="ctrl-row">
            <label className="ctrl-label" htmlFor="sldCo2"><span className="cname">CO₂ inlet flow</span><span className="cval">{params.co2} L/min</span></label>
            <div className="slider-track">
              <div className="baseline-marker" style={{ left: `${(BASELINE.co2 - 20) / (200 - 20) * 100}%` }}></div>
              <input type="range" id="sldCo2" min="20" max="200" value={params.co2} onChange={e => setParams(p => ({ ...p, co2: +e.target.value }))} />
            </div>
          </div>

          <div className="ctrl-row">
            <label className="ctrl-label" htmlFor="sldTemp"><span className="cname">Temperature target</span><span className="cval">{params.temp.toFixed(1)} °C</span></label>
            <div className="slider-track">
              <div className="baseline-marker" style={{ left: `${(BASELINE.temp * 10 - 180) / (320 - 180) * 100}%` }}></div>
              <input type="range" id="sldTemp" min="180" max="320" value={params.temp * 10} onChange={e => setParams(p => ({ ...p, temp: +e.target.value / 10 }))} />
            </div>
          </div>

          <div className="ctrl-row">
            <label className="ctrl-label" htmlFor="sldNutrient"><span className="cname">Nutrient availability</span><span className="cval">{params.nutrient}%</span></label>
            <div className="slider-track">
              <div className="baseline-marker" style={{ left: `${(BASELINE.nutrient - 0) / (100 - 0) * 100}%` }}></div>
              <input type="range" id="sldNutrient" min="0" max="100" value={params.nutrient} onChange={e => setParams(p => ({ ...p, nutrient: +e.target.value }))} />
            </div>
          </div>

          <div className="ctrl-row">
            <label className="ctrl-label" htmlFor="sldLight"><span className="cname">Light exposure</span><span className="cval">{params.light} µmol/m²/s</span></label>
            <div className="slider-track">
              <div className="baseline-marker" style={{ left: `${(BASELINE.light - 200) / (1000 - 200) * 100}%` }}></div>
              <input type="range" id="sldLight" min="200" max="1000" value={params.light} onChange={e => setParams(p => ({ ...p, light: +e.target.value }))} />
            </div>
          </div>

          <div className="ctrl-row">
            <label className="ctrl-label" htmlFor="sldPh"><span className="cname">pH target</span><span className="cval">{params.ph.toFixed(2)}</span></label>
            <div className="slider-track">
              <div className="baseline-marker" style={{ left: `${(BASELINE.ph * 100 - 600) / (800 - 600) * 100}%` }}></div>
              <input type="range" id="sldPh" min="600" max="800" value={params.ph * 100} onChange={e => setParams(p => ({ ...p, ph: +e.target.value / 100 }))} />
            </div>
          </div>

          <div className="ctrl-row">
            <div className="ctrl-label"><span className="cname">Harvest timing</span></div>
            <div className="stepper-row">
              <button className="stepper-btn" onClick={() => setParams(p => ({ ...p, harvest: Math.max(1, p.harvest - 1) }))}>–</button>
              <span className="stepper-val">{params.harvest} days</span>
              <button className="stepper-btn" onClick={() => setParams(p => ({ ...p, harvest: Math.min(30, p.harvest + 1) }))}>+</button>
            </div>
          </div>

          <button className={`run-btn ${isRunning ? 'running' : ''}`} onClick={handleRun} disabled={isRunning}>
            {isRunning ? 'Running simulated scenario…' : 'Run scenario'}
          </button>
        </div>

        <div id="stage" role="region" aria-label="Pond visual comparison">
          <div className="ponds-compare">
            <div className="pond-col">
              <span className="tag">Current</span>
              <PondVisual health={CURRENT.health} />
              <div className="pond-health-label">{CURRENT.health}% health</div>
            </div>

            <div className="arrow-between" aria-hidden="true">→</div>

            <div className="pond-col">
              <span className="tag">Simulated</span>
              <PondVisual health={preview.health} />
              <div className="pond-health-label">{preview.health}% health</div>
            </div>
          </div>
        </div>

        <div id="compare" className="glass" role="region" aria-label="Before vs after comparison">
          <h3>Before vs after</h3>
          <div className="cmp-metric">
            <div className="mname">Biomass</div>
            <div className="mvals">
              <span className="before">{CURRENT.biomass.toFixed(2)} g/L</span>
              <span className={`after ${applied.biomass >= CURRENT.biomass ? 'up' : 'down'}`}>
                <AnimatedNumber value={applied.biomass} decimals={2} suffix=" g/L" />
              </span>
            </div>
          </div>
          <div className="cmp-metric">
            <div className="mname">CO₂ capture rate</div>
            <div className="mvals">
              <span className="before">{CURRENT.co2capture} kg/day</span>
              <span className={`after ${applied.co2capture >= CURRENT.co2capture ? 'up' : 'down'}`}>
                <AnimatedNumber value={applied.co2capture} decimals={0} suffix=" kg/day" />
              </span>
            </div>
          </div>
          <div className="cmp-metric">
            <div className="mname">Operational health score</div>
            <div className="mvals">
              <span className="before">{CURRENT.health}%</span>
              <span className={`after ${applied.health >= CURRENT.health ? 'up' : 'down'}`}>
                <AnimatedNumber value={applied.health} decimals={0} suffix="%" />
              </span>
            </div>
          </div>
          <div className="cmp-metric">
            <div className="mname">Anomaly risk</div>
            <div className="mvals">
              <span className="before">{CURRENT.anomalyRisk}%</span>
              <span className={`after ${applied.anomalyRisk <= CURRENT.anomalyRisk ? 'up' : 'down'}`}>
                <AnimatedNumber value={applied.anomalyRisk} decimals={0} suffix="%" />
              </span>
            </div>
          </div>
          <div className="improvement-badge">
            <div className="ival" style={{ color: improvement >= 0 ? 'var(--algae)' : 'var(--red)' }}>
              {improvement >= 0 ? '+' : ''}<AnimatedNumber value={improvement} decimals={1} suffix="%" />
            </div>
            <div className="ilabel">Projected biomass change</div>
          </div>
          <div className="status-line">{statusText}</div>
        </div>
      </div>

      <div className="demo-data-badge" aria-label="Prototype using simulated data">PROTOTYPE · Simulated Data</div>
    </>
  );
}
