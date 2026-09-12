import React, { useState } from 'react';
import Scene from '../components/Scene';
import Navigation from '../components/Navigation';

const SAT_PONDS = {
  p1: { name: 'Pond P1', coverage: 95, chlorophyll: 0.71, imagery: 4.21, ai: 4.28, capture: 'Drone multispectral', pos: { left: '12%', top: '22%', size: 150 } },
  p2: { name: 'Pond P2', coverage: 74, chlorophyll: 0.52, imagery: 3.30, ai: 3.62, capture: 'Satellite optical', pos: { left: '40%', top: '46%', size: 150 } },
  p3: { name: 'Pond P3', coverage: 48, chlorophyll: 0.29, imagery: 2.60, ai: 3.05, capture: 'Drone multispectral', pos: { left: '64%', top: '20%', size: 150 } },
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

function agreementFor(p) {
  const diff = Math.abs(p.imagery - p.ai);
  const avg = (p.imagery + p.ai) / 2;
  return Math.max(0, 100 - (diff / avg * 100));
}

function confidenceLabel(agreement) {
  if (agreement >= 93) return { label: 'High', cls: 'conf-high' };
  if (agreement >= 85) return { label: 'Medium', cls: 'conf-medium' };
  return { label: 'Low', cls: 'conf-low' };
}

export default function SatelliteVerification() {
  const [selectedId, setSelectedId] = useState('p1');

  const selectedPond = SAT_PONDS[selectedId];
  const agreement = agreementFor(selectedPond);
  const conf = confidenceLabel(agreement);

  const agreements = Object.values(SAT_PONDS).map(agreementFor);
  const farmAgreement = (agreements.reduce((a, b) => a + b, 0) / agreements.length).toFixed(1);

  return (
    <>
      <Scene>
        <div className="veil"></div>
      </Scene>
      <Navigation />
      
      <div className="page">
        <div className="summary-strip glass">
          <div className="s-item">Last satellite pass<b>2h 14m ago</b></div>
          <div className="s-item">Imagery source<b>Sentinel-2 + drone multispectral (simulated)</b></div>
          <div className="s-item">Farm-wide agreement<b>{farmAgreement}%</b></div>
          <div className="spacer"></div>
          <div className="badge">Imagery cross-check layer</div>
        </div>

        <div id="mapCard" className="glass">
          <div id="terrain"></div>
          <div className="grid-overlay"></div>
          <div className="scan-line"></div>
          <div className="pass-badge"><span className="liveDot"></span>Last pass 2h 14m ago (simulated)</div>
          <div className="compass">N</div>
          <div className="coord-tag">23.02°N, 72.57°E</div>
          <div className="scale-bar"><span className="bar"></span>250 m</div>
          
          <div id="pondsOnMap">
            {Object.entries(SAT_PONDS).map(([id, p]) => (
              <div 
                key={id} 
                className={`pond-boundary ${id === selectedId ? 'selected' : ''}`}
                style={{
                  left: p.pos.left, 
                  top: p.pos.top, 
                  width: `${p.pos.size}px`, 
                  height: `${p.pos.size * 0.8}px`
                }}
                onClick={() => setSelectedId(id)}
              >
                <div className="pond-fill" style={{ background: `radial-gradient(circle at 35% 30%, ${healthColor(p.coverage)}, rgba(10,50,40,0.85))` }}></div>
                <div className="pond-tag">{p.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div id="panel" className="glass">
          <h3 id="panelName">{selectedPond.name}</h3>
          <div className="sub">Prototype imagery cross-check</div>

          <div className="agree-hero">
            <div className="aval">{agreement.toFixed(1)}%</div>
            <div className="alabel">simulated agreement (AI vs. imagery)</div>
            <div className={`aconf ${conf.cls}`}>Prototype verification confidence: {conf.label}</div>
          </div>

          <div className="est-compare">
            <div className="est-box"><div className="elabel">AI estimate</div><div className="eval">{selectedPond.ai.toFixed(2)} g/L</div></div>
            <div className="est-box"><div className="elabel">Imagery estimate</div><div className="eval">{selectedPond.imagery.toFixed(2)} g/L</div></div>
          </div>

          <div className="metric-row"><span>Algae coverage</span><span>{selectedPond.coverage}%</span></div>
          <div className="metric-row"><span>Chlorophyll / vegetation proxy</span><span>{selectedPond.chlorophyll.toFixed(2)}</span></div>
          <div className="metric-row"><span>Imagery resolution</span><span>3 m / px</span></div>
          <div className="metric-row"><span>Capture method</span><span>{selectedPond.capture}</span></div>

          <div className="source-note">Prototype imagery estimates are derived independently for spatial cross-checking. Disagreement between AI and imagery reduces verification confidence in the MRV system.</div>
        </div>
      </div>

      <div className="demo-data-badge" aria-label="Prototype using simulated data">PROTOTYPE • SIMULATED DATA</div>
    </>
  );
}
