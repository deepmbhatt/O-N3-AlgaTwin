import LivingPond from '../components/LivingPond';
import Sparkline from '../components/Sparkline';
import { usePondData } from '../context/pondDataStore';
import { deriveVisualState } from '../lib/visualState';

const metricDefinitions = [
  ['Water temperature', 'water_temp_avg_c', 'deg C', '25-29'],
  ['Dissolved oxygen', 'do_mg_l', 'mg/L', '> 6.0'],
  ['pH', 'sensor_ph', '', '7.5-8.5'],
  ['Nitrate', 'nitrate_mg_l', 'mg/L', '20-60'],
  ['Phosphorus', 'phosphorus_mg_l', 'mg/L', '1.0-4.0'],
  ['PAR light', 'par_umol_m2_s', 'umol/m2/s', '350-700'],
];

export default function PondDigitalTwin() {
  const { snapshot, pondOptions, activePondId, setActivePondId, usingFallback, connection } = usePondData();
  const visual = deriveVisualState(snapshot);
  const d = snapshot?.dashboard || {};

  return (
    <div className={`page detail-page page-state-${visual.healthMode}`}>
      <header className="page-heading">
        <div>
          <span className="eyebrow">{activePondId} - digital twin</span>
          <h1>Read the system beneath the surface.</h1>
          <p>Observed conditions and model forecasts from the live prediction history.</p>
        </div>
        <select
          className="quiet-select"
          value={activePondId}
          onChange={e => setActivePondId(e.target.value)}
          aria-label="Select pond"
        >
          {pondOptions.map(p => (
            <option key={p.id} value={p.id}>{p.name} - {p.status}</option>
          ))}
        </select>
      </header>

      {usingFallback && (
        <div className={`data-notice notice-${connection}`}>
          <span>{connection === 'empty' ? 'API READY' : connection === 'fallback' ? 'DEMO FALLBACK' : 'CONNECTION'}</span>
          <p>Process a prediction burst from Command Center to populate this view with live API results.</p>
        </div>
      )}

      <section className={`detail-hero detail-${visual.healthMode}`}>
        <LivingPond
          snapshot={snapshot}
          visual={visual}
          compact
          title={`${activePondId.toUpperCase()} - LIVE`}
        />
        <div className="twin-summary">
          <div className="section-kicker">
            <span className={`status-badge status-${visual.healthMode}`}><i />{snapshot?.label || 'Active'}</span>
            <span>Model confidence {Math.round((1 - (d.anomaly_probability ?? 0.1)) * 100)}%</span>
          </div>
          <h2>{Math.round(d.health_score ?? 90)}<small>/100</small></h2>
          <p>Current ecosystem health</p>
          <div className="forecast-pair">
            <div>
              <span>Observed biomass</span>
              <b>{Number(d.current_biomass_g_l ?? 0).toFixed(3)} <small>g/L</small></b>
            </div>
            <div>
              <span>Predicted - 6 hours</span>
              <b>{Number(d.biomass_6h_g_l ?? d.current_biomass_g_l ?? 0).toFixed(3)} <small>g/L</small></b>
            </div>
          </div>
          <div className="confidence-bar">
            <i style={{ width: `${Math.round((1 - (d.anomaly_probability ?? 0.1)) * 100)}%` }} />
          </div>
          {visual.warningSeverity > 0 && (
            <div className="twin-warning">
              <b>{d.anomaly_severity || 'Ecosystem'} anomaly detected</b>
              <span>{Math.round((d.anomaly_probability ?? 0.1) * 100)}% probability across the combined model signal.</span>
            </div>
          )}
        </div>
      </section>

      <div className="detail-grid">
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
    </div>
  );
}
