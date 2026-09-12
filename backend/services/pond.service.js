const { AppError } = require("../utils/response");
const { STATUS_CODE } = require("../utils/constants");
const axios = require("axios");

const AI_SERVICE_URL = process.env.ALGATWIN_URL || "http://localhost:8000";
const AI_API_KEY = process.env.ALGATWIN_API_KEY || "";

/**
 * Build common headers for AI service calls.
 */
function aiHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (AI_API_KEY) {
    headers["X-API-Key"] = AI_API_KEY;
  }
  return headers;
}

// ── Simulation ──────────────────────────────────────────────────────────────

/**
 * Sends a simulation request to the AI service and returns the result.
 * No database storage — the result is returned directly to the caller.
 *
 * AI /simulate expects:
 *   { pond_id: string, changes: { water_temp_avg_c, nitrate_mg_l, ... }, image_data?: {...} }
 *
 * Supported change fields:
 *   water_temp_avg_c, sensor_ph, nitrate_mg_l, phosphorus_mg_l,
 *   par_umol_m2_s, global_light_w_m2, co2_ppm
 *
 * @param {string} pondId
 * @param {object} changes - key-value pairs from supported_change_fields
 * @param {object|null} imageData - Optional { filename, image_base64 }
 * @returns {object} The simulation result from the AI service
 */
async function processSimulation(pondId, changes, imageData = null) {
  const requestBody = {
    pond_id: pondId,
    changes
  };
  if (imageData) {
    requestBody.image_data = imageData;
  }

  try {
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/simulate`,
      requestBody,
      {
        headers: aiHeaders(),
        timeout: 30000
      }
    );

    // AI response shape: { data: { pond_id, dashboard, insights, baseline, simulation, ... } }
    return aiResponse.data.data;

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const detail = error.response.data?.detail || "Unknown AI error";
      if (status === 404) {
        throw new AppError(
          `Pond "${pondId}" has no streamed data yet — call /predict first. (AI: ${detail})`,
          STATUS_CODE.NOT_FOUND
        );
      }
      if (status === 422) {
        throw new AppError(
          `Invalid simulation input: ${detail}`,
          STATUS_CODE.BAD_REQUEST
        );
      }
      throw new AppError(
        `AI service error (${status}): ${detail}`,
        STATUS_CODE.INTERNAL_SERVER_ERROR
      );
    }
    throw new AppError(
      "Failed to reach AI prediction service",
      STATUS_CODE.INTERNAL_SERVER_ERROR
    );
  }
}

module.exports = {
  processSimulation
};