const mongoose = require("mongoose");

const pondMetricSchema = new mongoose.Schema(
  {
    timestamp: { 
      type: Date, 
      default: Date.now, 
      index: true 
    },
    isSimulation: { 
      type: Boolean, 
      default: false 
    },
    sensorData: {
      temperature: { type: Number, required: true },
      co2Flow: { type: Number, required: true },
      lightIntensity: { type: Number, required: true },
      nutrientLevel: { type: Number, required: true }
    },
    aiMetrics: {
      farmHealthPct: { type: Number },
      biomassEstimate: { type: Number }, // in g/L
      co2CapturedKg: { type: Number },
      anomalyStatus: {
        level: { type: String, enum: ['Optimal', 'Mild Stress', 'Critical'], default: 'Optimal' },
        message: { type: String, default: 'All systems operational' }
      },
      insightText: { type: String }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PondMetric", pondMetricSchema);