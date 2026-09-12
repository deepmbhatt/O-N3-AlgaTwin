const mongoose = require("mongoose");

/**
 * PondMetric schema — aligned with AlgaTwin AI service response.
 *
 * Prediction records come from POST /predict → response.data.data[]
 * Simulation records come from POST /simulate → response.data
 *
 * See: alga_twin_api_package/API_CONTRACT.json  (shared_schemas.prediction_record)
 * See: alga_twin_api_package/BACKEND_DATABASE_HANDOFF.md  (§4 predictions / simulations)
 */
const pondMetricSchema = new mongoose.Schema(
  {
    pond_id: {
      type: String,
      required: true,
      index: true
    },
    observed_at: {
      type: String,       // ISO-8601 string (AI service stores strings, not BSON Date)
      required: true
    },
    stream_row: {
      type: Number
    },
    stream_cycle: {
      type: Number
    },
    isSimulation: {
      type: Boolean,
      default: false
    },

    // ── Source data (raw sensor + satellite + image metadata) ──
    source_data: {
      stream_row: Number,
      stream_cycle: Number,
      time_step: Number,
      pond_id: String,
      observed_at: String,
      condition_label: String,
      condition_severity: Number,
      record_provenance: String,
      iot_data: { type: mongoose.Schema.Types.Mixed },
      satellite_data: { type: mongoose.Schema.Types.Mixed },
      image: { type: mongoose.Schema.Types.Mixed }
    },

    // ── Dashboard-ready metrics (compact frontend view) ──
    dashboard: {
      current_biomass_g_l: Number,
      biomass_6h_g_l: Number,
      biomass_24h_g_l: Number,
      health_score: Number,
      health_band: String,
      anomaly_probability: Number,
      anomaly_severity: String,
      gross_co2_uptake_rate_g_l_h: Number,
      chlorophyll_a: Number,
      turbidity: Number,
      image_state: String,
      image_confidence: Number,
      // Simulation-only dashboard extras
      simulated_biomass_g_l: Number,
      biomass_delta_g_l: Number,
      relative_biomass_delta_pct: Number,
      simulated_health_score: Number,
      simulation_classification: String
    },

    // ── Insights array ──
    insights: [
      {
        severity: String,
        code: String,
        message: String
      }
    ],

    // ── Full model results ──
    results: {
      digital_twin: { type: mongoose.Schema.Types.Mixed },
      satellite: { type: mongoose.Schema.Types.Mixed },
      image: { type: mongoose.Schema.Types.Mixed }
    },

    // ── Simulation-specific fields ──
    changes: { type: mongoose.Schema.Types.Mixed },              // user-submitted changes
    baseline_source_data: { type: mongoose.Schema.Types.Mixed },  // snapshot of baseline
    submitted_image: { type: mongoose.Schema.Types.Mixed },       // user-uploaded image
    baseline: { type: mongoose.Schema.Types.Mixed },              // full baseline twin state
    simulation: { type: mongoose.Schema.Types.Mixed },            // full scenario result
    live_state_changed: Boolean,
    cursor_advanced: Boolean,
    image_is_supporting_evidence_only: Boolean
  },
  { timestamps: true }
);

// Indexes matching the AI service / handoff contract
pondMetricSchema.index({ pond_id: 1, observed_at: -1 });
pondMetricSchema.index({ stream_cycle: 1, stream_row: 1 });
pondMetricSchema.index({ pond_id: 1, isSimulation: 1, createdAt: -1 });

module.exports = mongoose.model("PondMetric", pondMetricSchema);