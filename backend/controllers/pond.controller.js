const asyncHandler = require("../middleware/asyncHandler");
const pondService = require("../services/pond.service");
const { sendSuccessResponse, AppError } = require("../utils/response");
const { STATUS_CODE } = require("../utils/constants");
const { addSseClient } = require("../cron/dataSeeder");

// ── Supported simulation change fields (from AI API_CONTRACT) ──
const VALID_CHANGE_FIELDS = new Set([
  "water_temp_avg_c",
  "sensor_ph",
  "nitrate_mg_l",
  "phosphorus_mg_l",
  "par_umol_m2_s",
  "global_light_w_m2",
  "co2_ppm"
]);

// @route   GET /api/pond/stream
// @desc    SSE endpoint — frontend connects here to receive live prediction carousel data
const streamLiveData = (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  // Send an initial heartbeat so the client knows the connection is alive
  res.write("event: connected\ndata: {\"status\":\"connected\"}\n\n");

  // Register this client; the cron will broadcast to it
  const removeClient = addSseClient(res);

  // Clean up when the client disconnects
  req.on("close", () => {
    removeClient();
    console.log("[SSE] Client disconnected");
  });
};

// @route   POST /api/pond/simulate
// @desc    Run scenario simulator — forwards to AI service's POST /simulate
//
// Expected body:
//   {
//     "pond_id": "pond-02",
//     "changes": {
//       "water_temp_avg_c": 27.5,
//       "nitrate_mg_l": 50,
//       "global_light_w_m2": 280,
//       "co2_ppm": 900
//     },
//     "image_data": {                // optional
//       "filename": "photo.jpg",
//       "image_base64": "BASE64..."
//     }
//   }
const runSimulation = asyncHandler(async (req, res) => {
  const { pond_id, changes, image_data } = req.body;

  // Validate required fields
  if (!pond_id || typeof pond_id !== "string") {
    throw new AppError("pond_id is required", STATUS_CODE.BAD_REQUEST);
  }
  if (!changes || typeof changes !== "object" || Object.keys(changes).length === 0) {
    throw new AppError(
      "changes object is required with at least one parameter",
      STATUS_CODE.BAD_REQUEST
    );
  }

  // Validate that only supported change fields are submitted
  for (const key of Object.keys(changes)) {
    if (!VALID_CHANGE_FIELDS.has(key)) {
      throw new AppError(
        `Unsupported change field: "${key}". Supported: ${[...VALID_CHANGE_FIELDS].join(", ")}`,
        STATUS_CODE.BAD_REQUEST
      );
    }
    if (typeof changes[key] !== "number") {
      throw new AppError(
        `Change field "${key}" must be a number`,
        STATUS_CODE.BAD_REQUEST
      );
    }
  }

  // Validate optional image_data
  if (image_data) {
    if (!image_data.image_base64) {
      throw new AppError(
        "image_data must include image_base64",
        STATUS_CODE.BAD_REQUEST
      );
    }
  }

  const result = await pondService.processSimulation(pond_id, changes, image_data || null);

  return sendSuccessResponse(
    res,
    result,
    "Simulation completed successfully",
    STATUS_CODE.OK
  );
});

module.exports = {
  streamLiveData,
  runSimulation
};