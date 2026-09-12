const asyncHandler = require("../middleware/asyncHandler");
const pondService = require("../services/pond.service");
const { sendSuccessResponse } = require("../utils/response"); // Assuming your path
const { STATUS_CODE } = require("../utils/constants");

// @route   GET /api/pond/latest
// @desc    Get the current live dashboard metrics
const getLatestMetrics = asyncHandler(async (req, res) => {
  const metrics = await pondService.fetchLatestPondState();

  return sendSuccessResponse(
    res,
    metrics,
    "Latest pond metrics retrieved successfully",
    STATUS_CODE.OK
  );
});

// @route   GET /api/pond/history
// @desc    Get data for line charts
const getHistoricalData = asyncHandler(async (req, res) => {
  // Parse limit from query, e.g., ?limit=12
  const limit = req.query.limit ? parseInt(req.query.limit) : 24; 
  const history = await pondService.fetchPondHistory(limit);

  return sendSuccessResponse(
    res,
    history,
    "Historical data retrieved successfully",
    STATUS_CODE.OK
  );
});

// @route   POST /api/pond/simulate
// @desc    Run scenario simulator with custom user inputs
const runSimulation = asyncHandler(async (req, res) => {
  const { temperature, co2Flow, lightIntensity, nutrientLevel } = req.body;

  // Basic validation
  if (!temperature || !co2Flow || !lightIntensity || !nutrientLevel) {
    throw new AppError("All sensor parameters are required for simulation", STATUS_CODE.BAD_REQUEST);
  }

  const customSensorData = { temperature, co2Flow, lightIntensity, nutrientLevel };
  
  const simulationResult = await pondService.processCustomSimulation(customSensorData);

  return sendSuccessResponse(
    res,
    simulationResult,
    "Simulation completed successfully",
    STATUS_CODE.OK
  );
});

module.exports = {
  getLatestMetrics,
  getHistoricalData,
  runSimulation
};