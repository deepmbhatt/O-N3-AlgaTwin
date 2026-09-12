const API_BASE = (import.meta.env.VITE_ALGATWIN_API_URL || '/algatwin').replace(/\/$/, '');
const API_KEY = import.meta.env.VITE_ALGATWIN_API_KEY || '';

export const DATA_MODE = 'api';

class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, options = {}) {
  const headers = { Accept: 'application/json', ...options.headers };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.detail || `Request failed with status ${response.status}`;
    throw new ApiError(typeof detail === 'string' ? detail : JSON.stringify(detail), response.status, detail);
  }
  return payload;
}

export const getApiHealth = () => request('/health');
export const getModels = () => request('/models');

export async function getDashboard(pondId, limit = 48) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (pondId) query.set('pond_id', pondId);
  return request(`/dashboard?${query}`);
}

export function runPredictionBurst(options = {}) {
  return request('/predict', {
    method: 'POST',
    body: JSON.stringify({
      batch_size: options.batchSize ?? 3,
      reset: options.reset ?? false,
      include_images: options.includeImages ?? true,
      return_image_base64: options.returnImageBase64 ?? true,
      images_by_pond: options.imagesByPond ?? {},
    }),
  });
}

export function runScenario(pondId, changes, imageData) {
  return request('/simulate', {
    method: 'POST',
    body: JSON.stringify({ pond_id: pondId, changes, image_data: imageData || null }),
  });
}

export function fileToImageData(file) {
  if (!file) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.onload = () => resolve({ filename: file.name, image_base64: String(reader.result).split(',')[1] });
    reader.readAsDataURL(file);
  });
}

const number = (value, fallback = 0) => value == null || Number.isNaN(Number(value)) ? fallback : Number(value);

export function normalizePrediction(record, history = []) {
  const dashboard = record.dashboard || {};
  const source = record.source_data || {};
  const iot = source.iot_data || {};
  const resultImage = record.results?.image || {};
  const sourceImage = source.image || {};
  const historyRows = history.length ? [...history].reverse() : [record];
  return {
    pond_id: record.pond_id || source.pond_id || 'pond-unknown',
    observed_at: record.observed_at || source.observed_at || new Date().toISOString(),
    stream_row: number(record.stream_row ?? source.stream_row),
    stream_cycle: number(record.stream_cycle ?? source.stream_cycle),
    label: dashboard.health_band === 'critical' ? 'Critical' : dashboard.health_band === 'watch' ? 'Stressed' : 'Healthy',
    dashboard: {
      current_biomass_g_l: number(dashboard.current_biomass_g_l),
      biomass_6h_g_l: number(dashboard.biomass_6h_g_l, number(dashboard.current_biomass_g_l)),
      biomass_24h_g_l: number(dashboard.biomass_24h_g_l, number(dashboard.current_biomass_g_l)),
      health_score: number(dashboard.health_score),
      health_band: dashboard.health_band || 'unknown',
      anomaly_probability: number(dashboard.anomaly_probability),
      anomaly_severity: dashboard.anomaly_severity || 'normal',
      gross_co2_uptake_rate_g_l_h: number(dashboard.gross_co2_uptake_rate_g_l_h),
      chlorophyll_a: number(dashboard.chlorophyll_a),
      turbidity: number(dashboard.turbidity),
      image_state: dashboard.image_state || resultImage.state || 'NO IMAGE',
      image_confidence: number(dashboard.image_confidence ?? resultImage.confidence),
    },
    iot: {
      water_temp_avg_c: number(iot.water_temp_avg_c), sensor_ph: number(iot.sensor_ph),
      do_mg_l: number(iot.do_mg_l), nitrate_mg_l: number(iot.nitrate_mg_l),
      phosphorus_mg_l: number(iot.phosphorus_mg_l), par_umol_m2_s: number(iot.par_umol_m2_s),
      global_light_w_m2: number(iot.global_light_w_m2), salinity_g_l: number(iot.salinity_g_l), co2_ppm: number(iot.co2_ppm, 400),
    },
    image: {
      state: dashboard.image_state || resultImage.state || 'NO IMAGE',
      confidence: number(dashboard.image_confidence ?? resultImage.confidence),
      filename: sourceImage.filename || null,
      base64: sourceImage.base64 || null,
    },
    insights: record.insights?.length ? record.insights : [{ severity: 'info', code: 'NO_INSIGHTS', message: 'No active model insight for this reading.' }],
    history: historyRows.map((item) => ({
      label: new Date(item.observed_at || item.source_data?.observed_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      biomass: number(item.dashboard?.current_biomass_g_l),
      health: number(item.dashboard?.health_score),
    })),
    raw: record,
  };
}
