require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');
const routes = require('./routes/index');
const bodyParser = require('body-parser');
const { dbconnection } = require('./db');
const { STATUS_CODE } = require('./utils/constants');
const { sendErrorResponse } = require('./utils/response');
const { startPondCronJob } = require('./cron/dataSeeder');


dbconnection();


app.use(cors());
app.use(express.json({ limit: '15mb' }));        // increased for base64 image uploads
app.use(bodyParser.json({ limit: '15mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
//Middleware to parse JSON and URL-encoded data


app.use('/api', routes);

app.use((err, req, res, next) => {
  console.log(err);
  return sendErrorResponse(
    res,
    {},
    err.message,
    err.statusCode || STATUS_CODE.INTERNAL_SERVER_ERROR
  );
});

// Start the cron job that pumps AI predictions to connected frontends via SSE
startPondCronJob();

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});