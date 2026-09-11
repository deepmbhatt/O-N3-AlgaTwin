const PondMetric = require("../models/PondMetric");
const {AppError} = require("../utils/response"); // Assuming your custom error class path
const { STATUS_CODE } = require("../utils/constants"); // Assuming your status codes path
const axios = require("axios"); // Or standard fetch, if you prefer

// Fetches the most recent real (non-simulation) pond reading
async function fetchLatestPondState() {
  const latestMetric = await PondMetric.findOne({ isSimulation: false })
    .sort({ timestamp: -1 });

  if (!latestMetric) {
    throw new AppError("No pond data found", STATUS_CODE.NOT_FOUND);
  }

  return latestMetric;
}

// Fetches historical data for your charts
async function fetchPondHistory(limit = 24) {
  const history = await PondMetric.find({ isSimulation: false })
    .sort({ timestamp: -1 })
    .limit(limit);
    
  return history.reverse(); // Reverse to get chronological order for charts
}

// Handles custom user metadata, calls AI, and saves the simulation state
async function processCustomSimulation(customSensorData) {
  try {
    // 1. Send the custom data to your AI Developer's Python/FastAPI service
    // Replace with actual AI service URL
    const aiResponse = await axios.post("http://ai-service-url/predict", customSensorData); 
    const predictedAiMetrics = aiResponse.data; 

    // 2. Save this simulation to DB so you have a record, but flag it!
    const simulationRecord = await PondMetric.create({
      isSimulation: true,
      sensorData: customSensorData,
      aiMetrics: predictedAiMetrics
    });

    return simulationRecord;
  } catch (error) {
    throw new AppError("AI Prediction Service Failed", STATUS_CODE.INTERNAL_SERVER_ERROR);
  }
}

module.exports = {
  fetchLatestPondState,
  fetchPondHistory,
  processCustomSimulation
};