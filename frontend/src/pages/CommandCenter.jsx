import { useMemo } from 'react';
import LivingPond from '../components/LivingPond';
import Mascot from '../components/Mascot';
import Sparkline from '../components/Sparkline';
import { usePondData } from '../context/pondDataStore';
import { deriveVisualState } from '../lib/visualState';

function Metric({ label, value, unit, detail, tone = '', level }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <div><b>{value}</b><em>{unit}</em></div>
      <small>{detail}</small>
      {level && <span className="metric-level">{level}</span>}
    </article>
  );
}

const metricDefinitions = [
  ['Water temperature', 'water_temp_avg_c', 'deg C', '25-29'],
  ['Dissolved oxygen', 'do_mg_l', 'mg/L', '> 6.0'],
  ['pH', 'sensor_ph', '', '7.5-8.5'],
  ['Nitrate', 'nitrate_mg_l', 'mg/L', '20-60'],
  ['Phosphorus', 'phosphorus_mg_l', 'mg/L', '1.0-4.0'],
  ['PAR light', 'par_umol_m2_s', 'umol/m2/s', '350-700'],
];

export default function CommandCenter() {
  const {
    snapshot,
    pondOptions,
    activePondId,
    setActivePondId,
    connection,
    error,
    busy,
    processNextBurst,
    usingFallback,
    cursor,
    autoPredict,
    predictMs,
    lastPrediction,
  } = usePondData();

  const visual = useMemo(() => deriveVisualState(snapshot), [snapshot]);
  const d = snapshot?.dashboard || {};
  const anomalyPct = Math.round((d.anomaly_probability ?? 0.1) * 100);
  const adverse = visual.warningSeverity >= 1 || (d.health_score ?? 85) < 75;

  return (
    <div className={`page command-page page-state-${visual.healthMode}`}>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Command center + digital twin</span>
          <h1>Your pond, alive in real time.</h1>
          <p>Live biology, water quality, carbon performance and forecasts in one operational view.</p>
        </div>
        <div className="heading-actions">
          <div className="auto-predict-status">
            <i />
            <span>
              <b>{autoPredict ? 'Auto prediction on' : 'Auto prediction off'}</b>
              <small>{autoPredict ? `Every ${Math.round(predictMs / 1000)} seconds` : 'Dashboard refresh only'}</small>
            </span>
          </div>
          <label className="select-field">
            <span>Pond</span>
            <select
              value={activePondId}
              onChange={e => setActivePondId(e.target.value)}
              aria-label="Select active pond"
            >
              {pondOptions.map(p => (
                <option key={p.id} value={p.id}>{p.name} - {p.status}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="burst-button"
            onClick={() => void processNextBurst()}
            disabled={busy}
          >
            <i />{busy ? 'Processing...' : 'Predict now'}
          </button>
        </div>
      </header>

      {(error || usingFallback) && (
        <div className={`data-notice notice-${connection}`}>
          <span>{connection === 'empty' ? 'API READY' : connection === 'fallback' ? 'DEMO FALLBACK' : 'CONNECTION'}</span>
          <p>{error || 'Showing demonstration data until the API returns live history.'}</p>
        </div>
      )}

      <div className={`anomaly-banner anomaly-${d.anomaly_severity || 'normal'} ${adverse ? 'is-adverse' : ''}`}>
        <div className="anomaly-signal"><span><i /><i /><i /></span></div>
        <div>
          <small>{adverse ? 'Active ecosystem signal' : 'Continuous anomaly watch'}</small>
          <b>{adverse ? (snapshot?.insights?.[0]?.message || 'Ecosystem condition requires review.') : 'No adverse pattern detected across the current sensor window.'}</b>
        </div>
        <div className="anomaly-score">
          <strong>{anomalyPct}%</strong>
          <span>anomaly probability</span>
        </div>
        <div className="state-key">
          <span className="key-healthy">Healthy</span>
          <span className="key-stressed">Watch</span>
          <span className="key-critical">Critical</span>
        </div>
      </div>

      <div className="command-grid">
        <div className={`scene-panel scene-alert-${d.anomaly_severity || 'normal'}`}>
          <LivingPond
            snapshot={snapshot}
            visual={visual}
            title={`${activePondId.replace('-', ' ').toUpperCase()} - ${snapshot?.label || 'LIVE'}`}
          />
          <div className={`health-orb health-${visual.healthMode}`}>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r="20" />
              <circle
                cx="24"
                cy="24"
                r="20"
                style={{ strokeDashoffset: 126 - 1.26 * (d.health_score ?? 90) }}
              />
            </svg>
            <span><b>{Math.round(d.health_score ?? 90)}</b><small>health</small></span>
          </div>
        </div>

        <aside className="insight-rail">
          <div className="rail-heading">
            <div>
              <span className="eyebrow">Current model reading</span>
              <h2>{snapshot?.label || 'Active'} ecosystem</h2>
            </div>
            <span className={`status-badge status-${visual.healthMode}`}><i />{d.anomaly_severity || 'normal'}</span>
          </div>
          <Mascot message={snapshot?.insights?.[0]?.message || 'Ecosystem nominal.'} mood={visual.mascotMood} />
          <div className="mini-trend">
            <div>
              <span>Biomass trajectory</span>
              <b>{Number(d.current_biomass_g_l ?? 0).toFixed(3)} <small>g/L</small></b>
            </div>
            <span className={(d.biomass_6h_g_l ?? 0) >= (d.current_biomass_g_l ?? 0) ? 'trend-up' : 'trend-down'}>
              {(d.biomass_6h_g_l ?? 0) >= (d.current_biomass_g_l ?? 0) ? '+' : '-'} 6h {Number(d.biomass_6h_g_l ?? d.current_biomass_g_l ?? 0).toFixed(3)}
            </span>
            <Sparkline values={(snapshot?.history || []).map(x => x.biomass)} height={94} />
          </div>
          <div className="insight-list">
            {(snapshot?.insights || []).slice(0, 3).map((item, index) => (
              <div key={item.code || index} className={`insight-item severity-${item.severity || 'info'}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p><b>{(item.code || 'INSIGHT').replaceAll('_', ' ')}</b>{item.message}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className="metrics-row">
        <Metric
          label="Water temperature"
          value={Number(snapshot?.iot?.water_temp_avg_c ?? 0).toFixed(1)}
          unit="deg C"
          detail="Preferred: 25-29"
          tone={snapshot?.iot?.water_temp_avg_c > 32 ? 'metric-danger' : snapshot?.iot?.water_temp_avg_c < 24 ? 'metric-warning' : ''}
          level={snapshot?.iot?.water_temp_avg_c > 32 ? 'HIGH' : null}
        />
        <Metric
          label="Dissolved oxygen"
          value={Number(snapshot?.iot?.do_mg_l ?? 0).toFixed(1)}
          unit="mg/L"
          detail="Preferred: above 6.0"
          tone={snapshot?.iot?.do_mg_l < 4 ? 'metric-danger' : snapshot?.iot?.do_mg_l < 6 ? 'metric-warning' : ''}
          level={snapshot?.iot?.do_mg_l < 4 ? 'CRITICAL' : null}
        />
        <Metric
          label="pH balance"
          value={Number(snapshot?.iot?.sensor_ph ?? 0).toFixed(2)}
          unit="pH"
          detail="Preferred: 7.5-8.5"
          tone={snapshot?.iot?.sensor_ph > 9 || snapshot?.iot?.sensor_ph < 7 ? 'metric-danger' : snapshot?.iot?.sensor_ph > 8.5 ? 'metric-warning' : ''}
        />
        <Metric
          label="CO2 concentration"
          value={Math.round(visual.co2Ppm)}
          unit="ppm"
          detail="Controls the visible gas bubbles"
          tone={visual.co2Ppm > 900 ? 'metric-danger' : visual.co2Ppm > 650 ? 'metric-warning' : ''}
        />
      </section>

      <section className="unified-twin-section">
        <div className="unified-section-heading">
          <div>
            <span className="eyebrow">Digital twin detail</span>
            <h2>Read the system beneath the surface.</h2>
            <p>Observed chemistry and model trajectory stay with the live pond in one view.</p>
          </div>
          <span className="prediction-stamp">
            {lastPrediction ? `Last predicted ${lastPrediction.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Waiting for first automatic prediction'}
          </span>
        </div>
        <div className="detail-grid command-detail-grid">
          <section className="panel sensor-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Sensor field</span>
                <h2>Water chemistry</h2>
              </div>
              <span>preferred range</span>
            </div>
            <div className="sensor-grid">
              {metricDefinitions.map(([label, key, unit, range]) => {
                const value = snapshot?.iot?.[key];
                const numVal = Number(value || 0);
                const alert =
                  (key === 'do_mg_l' && numVal < 4) ||
                  (key === 'water_temp_avg_c' && numVal > 32) ||
                  (key === 'sensor_ph' && (numVal > 9 || numVal < 7));
                return (
                  <article key={key} className={alert ? 'sensor-alert' : ''}>
                    <span>{label}</span>
                    <b>{numVal.toFixed(key === 'sensor_ph' ? 2 : 1)} <small>{unit}</small></b>
                    <em>Target {range}</em>
                    {alert && <strong>OUTSIDE RANGE</strong>}
                  </article>
                );
              })}
            </div>
          </section>
          <section className="panel forecast-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Model trajectory</span>
                <h2>Biomass history</h2>
              </div>
              <span className={(d.biomass_6h_g_l ?? 0) >= (d.current_biomass_g_l ?? 0) ? 'trend-up' : 'trend-down'}>
                Observed + forecast
              </span>
            </div>
            <Sparkline values={(snapshot?.history || []).map(x => x.biomass)} height={190} />
            <div className="chart-axis">
              <span>Oldest</span>
              <span>History</span>
              <span>Latest</span>
              <span>6h forecast</span>
            </div>
          </section>
        </div>
      </section>

      <footer className="replay-strip">
        <div>
          <span className="live-dot" />
          <b>Stream row {snapshot?.stream_row ?? 0}</b>
          <small>{snapshot?.observed_at ? new Date(snapshot.observed_at).toLocaleString() : 'Recent stream'}</small>
        </div>
        <div className="replay-track">
          <i style={{ width: `${Math.max(4, (snapshot?.stream_row ?? 0) / Math.max(9.99, (cursor?.total_rows || 999) / 100))}%` }} />
        </div>
        <span>Cycle {snapshot?.stream_cycle ?? 0} - circular stream</span>
      </footer>
    </div>
  );
}
