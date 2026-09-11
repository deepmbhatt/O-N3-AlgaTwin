const cron = require("node-cron");
const axios = require("axios");
const PondMetric = require("../models/PondMetric");

const startPondCronJob = () => {
  // "*/5 * * * *" runs every 5 minutes.
  // (Change to "*/1 * * * *" during hackathon testing for faster updates)
  cron.schedule("*/5 * * * *", async () => {
    try {
      console.log(`[CRON] Fetching live pond data from AI service at ${new Date().toISOString()}`);

      // 1. Hit the AI Developer's service to get the latest pond record and metrics
      // Replace this URL with Deep's actual local/ngrok endpoint
      const AI_SERVICE_URL = "http://localhost:8000/api/live-pond-record"; 
      
      const aiResponse = await axios.get(AI_SERVICE_URL);
      const liveData = aiResponse.data;

      // 2. Fallback validation to ensure the AI service didn't send an empty payload
      if (!liveData || !liveData.sensorData || !liveData.aiMetrics) {
         console.warn("[CRON] Warning: Malformed or missing data from AI service.");
         return; 
      }

      // 3. Save this dynamically fetched data to your database as the true timeline
      const newRecord = await PondMetric.create({
        isSimulation: false, // Ensures this is part of the official MRV history
        sensorData: liveData.sensorData,
        aiMetrics: liveData.aiMetrics
      });

      console.log(`[CRON] Successfully saved new baseline tick. Record ID: ${newRecord._id}`);

    } catch (error) {
      console.error("[CRON] Failed to fetch or save baseline data:", error.message);
    }
  });

  console.log("[CRON] Pond Metric Fetcher Initialized (Pinging AI Service every 5 minutes)");
};

module.exports = startPondCronJob;