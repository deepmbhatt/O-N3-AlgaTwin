const express = require("express");
const router = express.Router();
const pondController = require("../../controllers/pond.controller");

// SSE stream — frontend connects here for live prediction carousel
router.get("/stream", pondController.streamLiveData);

// Scenario Simulator — user submits custom parameters for custom predictions
router.post("/simulate", pondController.runSimulation);

module.exports = router;