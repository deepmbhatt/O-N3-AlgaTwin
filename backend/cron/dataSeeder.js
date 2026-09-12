const cron = require("node-cron");
const axios = require("axios");

const AI_SERVICE_URL = process.env.ALGATWIN_URL || "http://localhost:8000";
const AI_API_KEY = process.env.ALGATWIN_API_KEY || "";

// Connected SSE clients
const sseClients = new Set();

/**
 * Register a new SSE client (called from the /api/pond/stream route).
 * Returns a cleanup function to remove the client on disconnect.
 */
function addSseClient(res) {
  sseClients.add(res);
  return () => sseClients.delete(res);
}

/**
 * Broadcast a JSON event to every connected SSE client.
 */
function broadcast(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

// Simple in-process lock to prevent overlapping /predict calls.
let isRunning = false;

const startPondCronJob = () => {
  cron.schedule("*/5 * * * *", async () => {
    if (isRunning) {
      console.log("[CRON] Previous predict job still running — skipping this tick.");
      return;
    }
    isRunning = true;

    try {
      console.log(`[CRON] Calling POST /predict at ${new Date().toISOString()}`);

      const headers = { "Content-Type": "application/json" };
      if (AI_API_KEY) {
        headers["X-API-Key"] = AI_API_KEY;
      }

      const aiResponse = await axios.post(
        `${AI_SERVICE_URL}/predict`,
        {
          batch_size: 3,
          include_images: true,
          return_image_base64: true
        },
        {
          headers,
          timeout: 30000
        }
      );

      // AI response: { data: [...predictionRecords], cursor: {...}, message: "..." }
      const predictions = aiResponse.data.data;
      const cursor = aiResponse.data.cursor;

      if (!Array.isArray(predictions) || predictions.length === 0) {
        console.warn("[CRON] /predict returned no records. Skipping broadcast.");
        return;
      }

      // Push the entire burst to all connected frontends via SSE
      broadcast("pond-update", {
        predictions,
        cursor,
        receivedAt: new Date().toISOString()
      });

      console.log(
        `[CRON] Broadcast ${predictions.length} prediction(s) to ${sseClients.size} client(s). ` +
        `Cursor → row ${cursor?.next_row}, cycle ${cursor?.cycle}.`
      );

    } catch (error) {
      if (error.response) {
        console.error(
          `[CRON] AI service error ${error.response.status}:`,
          error.response.data?.detail || error.response.data
        );
      } else {
        console.error("[CRON] Failed to reach AI service:", error.message);
      }
    } finally {
      isRunning = false;
    }
  });

  console.log("[CRON] Pond data pump initialized (POST /predict every 5 minutes → SSE broadcast)");
};

module.exports = { startPondCronJob, addSseClient, sseClients };