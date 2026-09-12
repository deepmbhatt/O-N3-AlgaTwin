import { useState } from 'react';
import LivingPond from '../components/LivingPond';
import { usePondData } from '../context/pondDataStore';
import { deriveVisualState } from '../lib/visualState';

const fixed = (value, digits = 3) => Number(value || 0).toFixed(digits);

export default function SatelliteVerification() {
  const [layer, setLayer] = useState('true color');
  const { snapshot, pondOptions, activePondId, setActivePondId, usingFallback, connection } = usePondData();
  const visual = deriveVisualState(snapshot);
  const satellite = snapshot?.raw?.results?.satellite || {};
  const reflectance = snapshot?.raw?.source_data?.satellite_data || {};
  const img = snapshot?.image || {};
  const imageConfidence = Math.round((img.confidence ?? 0.85) * 100);
  const ext = img.filename?.split('.').pop()?.toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const imageSource = img.base64 ? `data:${mime};base64,${img.base64}` : '/images/ghibli_algae_pond.png';

  return (
    <div className="page remote-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Remote verification - cross-checked evidence</span>
          <h1>Ground truth, viewed from above.</h1>
          <p>Image classification, remote reflectance and in-pond sensing cross-referenced from the same record.</p>
        </div>
        <div className="remote-actions">
          <select
            className="quiet-select"
            value={activePondId}
            onChange={e => setActivePondId(e.target.value)}
            aria-label="Select pond"
          >
            {pondOptions.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="segmented" role="group" aria-label="Satellite visual layer">
            {['true color', 'chlorophyll', 'turbidity'].map(x => (
              <button
                key={x}
                type="button"
                className={layer === x ? 'active' : ''}
                onClick={() => setLayer(x)}
                aria-pressed={layer === x}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
      </header>

      {usingFallback && (
        <div className={`data-notice notice-${connection}`}>
          <span>{connection === 'empty' ? 'API READY' : connection === 'fallback' ? 'DEMO EVIDENCE' : 'CONNECTION'}</span>
          <p>Process a prediction burst from Command Center to load the mapped pond image and remote model results.</p>
        </div>
      )}

      <div className="remote-grid">
        <section className="satellite-card">
          <div className={`satellite-image satellite-${layer.replace(' ', '-')}`}>
            <img src={imageSource} alt="Current pond visual evidence" />
            <div className="scan-line" />
            <span className="north-mark">N</span>
            <div className="pond-target"><i /><i /><i /></div>
            <div className="image-caption">
              <span>{img.filename || 'Pond visual evidence'}</span>
              <b>{snapshot?.observed_at ? new Date(snapshot.observed_at).toLocaleString() : 'Recent observation'}</b>
            </div>
          </div>
          <div className="evidence-footer">
            <div><span>Dataset</span><b>{reflectance.dataset || 'pending'}</b></div>
            <div><span>Latitude</span><b>{fixed(reflectance.latitude, 2)}</b></div>
            <div><span>Longitude</span><b>{fixed(reflectance.longitude, 2)}</b></div>
            <div><span>Stream row</span><b>{snapshot?.stream_row ?? 0}</b></div>
          </div>
        </section>

        <aside className="evidence-rail">
          <section className={`panel classification-card classification-${visual.healthMode}`}>
            <span className="eyebrow">Visual condition model</span>
            <div className="classification-head">
              <div>
                <h2>{img.state || 'OPTIMUM'}</h2>
                <p>{img.base64 ? 'Live mapped image classified.' : 'Awaiting API image evidence.'}</p>
              </div>
              <div className="confidence-ring" style={{ '--confidence': `${imageConfidence}%` }}>
                <span>{imageConfidence}<small>%</small></span>
              </div>
            </div>
            <div className="evidence-bars">
              <label>
                <span>Model confidence</span>
                <b>{imageConfidence}%</b>
                <i><em style={{ width: `${imageConfidence}%` }} /></i>
              </label>
              <label>
                <span>Uncertainty</span>
                <b>{100 - imageConfidence}%</b>
                <i><em className="uncertainty" style={{ width: `${100 - imageConfidence}%` }} /></i>
              </label>
            </div>
          </section>

          <section className="panel spectral-card">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Remote model signals</span>
                <h2>Spectral evidence</h2>
              </div>
              <span>API result</span>
            </div>
            <div className="spectral-list">
              <article>
                <span>Chlorophyll-a</span>
                <b>{fixed(satellite.chlorophyll_a ?? snapshot?.dashboard?.chlorophyll_a, 1)}</b>
                <small>ug/L model estimate</small>
              </article>
              <article>
                <span>Turbidity</span>
                <b>{fixed(satellite.turbidity ?? snapshot?.dashboard?.turbidity, 1)}</b>
                <small>NTU model estimate</small>
              </article>
              <article>
                <span>Red edge 1</span>
                <b>{fixed(reflectance.RE1, 4)}</b>
                <small>Surface reflectance</small>
              </article>
              <article>
                <span>Green band</span>
                <b>{fixed(reflectance.green, 4)}</b>
                <small>Surface reflectance</small>
              </article>
            </div>
          </section>
        </aside>
      </div>

      <section className={`verification-strip verify-${visual.healthMode}`}>
        <div>
          <span className="verify-icon">{visual.healthMode === 'critical' ? '!' : 'OK'}</span>
          <p>
            <b>{visual.healthMode === 'critical' ? 'Cross-source risk requires attention' : 'Cross-source evidence loaded'}</b>
            {snapshot?.insights?.find(item => item.code.includes('VISUAL'))?.message ||
              'Image, satellite and sensor evidence are cross-checked in the current prediction record.'}
          </p>
        </div>
        <div className="verification-mini">
          <LivingPond snapshot={snapshot} visual={visual} compact showCallouts={false} />
        </div>
      </section>
    </div>
  );
}
