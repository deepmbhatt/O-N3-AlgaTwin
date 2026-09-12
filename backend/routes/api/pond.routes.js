const express = require("express");
const router = express.Router();
const pondController = require("../../controllers/pond.controller");

// Baseline Stream Routes
router.get("/latest", pondController.getLatestMetrics);
router.get("/history", pondController.getHistoricalData);

// Scenario Simulator Route
router.post("/simulate", pondController.runSimulation);

module.exports = router;