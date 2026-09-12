# Backend and database handoff

This document is the implementation contract for the engineer integrating AlgaTwin with the application backend, MongoDB, cron scheduling and the dashboard.

## 1. Ownership

AlgaTwin service owns:

- circular CSV position;
- per-pond in-memory model history;
- model inference;
- prediction and simulation persistence when MongoDB is configured;
- read-only dashboard history responses.

Application backend owns:

- user authentication and authorization;
- mapping application ponds/users to `pond_id`;
- cron/job scheduling and overlap prevention;
- proxying dashboard responses to the frontend;
- WebSocket/SSE notifications if live push is required;
- MongoDB security, backups and retention.

The backend must use the exact `pond_id` strings returned by AlgaTwin. For the demonstration file they are `pond-01`, `pond-02` and `pond-03`.

## 2. Request flow

```text
Scheduled job
  -> POST /predict
  -> AlgaTwin reads next CSV burst
  -> runs models and image classification
  -> stores predictions
  -> returns data[]

Frontend/backend
  -> GET /dashboard
  -> receives latest + history without changing cursor

User
  -> POST /simulate
  -> uses selected pond's latest streamed baseline
  -> stores scenario
  -> returns scenario JSON without changing live state/cursor
```

## 3. Required environment

```dotenv
ALGATWIN_MODEL_DIR=models
ALGATWIN_STREAM_CSV=data/pond_iot_stream.csv
ALGATWIN_CORS_ORIGINS=http://localhost:3000,http://localhost:5173
ALGATWIN_API_KEY=replace-with-a-long-random-secret
ALGATWIN_MONGODB_URI=mongodb://mongo:27017
ALGATWIN_MONGODB_DATABASE=algatwin
ALGATWIN_HISTORY_LIMIT=1000
```

`ALGATWIN_HISTORY_LIMIT` only controls the in-memory fallback. MongoDB retention must be managed separately.

## 4. MongoDB collections

### ponds (application-owned, recommended)

```json
{
  "_id": "ObjectId",
  "pond_id": "pond-01",
  "name": "North Production Pond",
  "owner_id": "application-user-id",
  "active": true,
  "created_at": "Date"
}
```

```javascript
db.ponds.createIndex({ pond_id: 1 }, { unique: true });
```

AlgaTwin does not create this collection because user/tenant ownership belongs to the application.

### stream_cursors (AlgaTwin-owned)

```json
{
  "_id": "ObjectId",
  "stream_id": "pond_iot_stream.csv",
  "position": 3,
  "cycle": 0
}
```

```javascript
db.stream_cursors.createIndex({ stream_id: 1 }, { unique: true });
```

### predictions (AlgaTwin-owned)

Each document is one item from `POST /predict -> data[]`:

```json
{
  "_id": "ObjectId",
  "pond_id": "pond-01",
  "observed_at": "ISO-8601 string",
  "stream_row": 1,
  "stream_cycle": 0,
  "source_data": {
    "iot_data": {},
    "satellite_data": {},
    "image": {}
  },
  "dashboard": {},
  "insights": [],
  "results": {
    "digital_twin": {},
    "satellite": {},
    "image": {}
  }
}
```

Indexes created by the service:

```javascript
db.predictions.createIndex({ pond_id: 1, observed_at: -1 });
db.predictions.createIndex({ stream_cycle: 1, stream_row: 1 });
```

### simulations (AlgaTwin-owned)

```json
{
  "_id": "ObjectId",
  "pond_id": "pond-02",
  "created_at": "ISO-8601 string",
  "baseline_source_data": {},
  "submitted_image": {},
  "dashboard": {},
  "insights": [],
  "baseline": {},
  "simulation": {},
  "satellite": {},
  "image": {},
  "live_state_changed": false,
  "cursor_advanced": false
}
```

Index created by the service:

```javascript
db.simulations.createIndex({ pond_id: 1, created_at: -1 });
```

## 5. Cron task

Recommended default:

- interval: configurable;
- batch size: 3;
- request timeout: at least 30 seconds when images are enabled;
- concurrency: one active job;
- retry: only after determining whether the first request reached the service.

Example pseudocode:

```javascript
if (!(await acquireDistributedLock("algatwin-predict"))) return;

try {
  const response = await axios.post(
    process.env.ALGATWIN_URL + "/predict",
    { batch_size: 3, include_images: true, return_image_base64: true },
    {
      headers: { "X-API-Key": process.env.ALGATWIN_API_KEY },
      timeout: 30000
    }
  );

  websocket.publish("pond-update", response.data.data);
} finally {
  await releaseDistributedLock("algatwin-predict");
}
```

Do not have multiple workers call `/predict` concurrently. A network timeout after server completion is ambiguous because the cursor may already have advanced; log `stream_cycle` and `stream_row` for reconciliation.

## 6. Backend proxy routes

Suggested application routes:

```text
GET  /api/ponds/:pondId/dashboard
POST /api/ponds/:pondId/simulate
POST /internal/jobs/algatwin-predict
```

The internal cron route should not be publicly accessible.

Dashboard proxy:

```javascript
app.get("/api/ponds/:pondId/dashboard", async (req, res) => {
  const response = await axios.get(process.env.ALGATWIN_URL + "/dashboard", {
    params: { pond_id: req.params.pondId, limit: req.query.limit ?? 50 },
    headers: { "X-API-Key": process.env.ALGATWIN_API_KEY }
  });
  res.json(response.data);
});
```

Validate that the authenticated user owns `pond_id` before proxying.

## 7. Image handling

Prediction normally loads the mapped CSV image automatically. The response can include base64 for immediate display.

Simulation accepts an optional base64 image:

```json
{
  "pond_id": "pond-02",
  "changes": { "co2_ppm": 900 },
  "image_data": {
    "filename": "current.jpg",
    "image_base64": "..."
  }
}
```

Rules:

- maximum decoded size: 10 MB;
- supported: JPG, PNG, WebP;
- never trust client filename as a storage path;
- image output is supporting evidence, not a causal input to biomass simulation;
- consider object storage instead of MongoDB base64 for long-term production retention.

## 8. Retention and capacity

The demonstration images are small, but repeated circular predictions create new history indefinitely. Define a production retention policy, for example:

- keep detailed predictions for 30 days;
- archive aggregates separately;
- move images to S3-compatible object storage and store URLs;
- periodically delete expired simulation documents;
- monitor MongoDB document and database size.

Do not create a TTL index until timestamps are stored as BSON Date values. The current service stores ISO-8601 strings for portable JSON.

## 9. Security

- Put AlgaTwin on a private network.
- Set `ALGATWIN_API_KEY`; do not expose it to browser code.
- Apply authentication/authorization in the application backend.
- Enable MongoDB authentication and TLS in production.
- Restrict CORS to real frontend origins.
- Never load untrusted joblib files.
- Validate upload size at the reverse proxy as well as in FastAPI.

## 10. Deployment constraints

Run one Uvicorn worker/replica because model history and active engines are in process memory. MongoDB persists cursor/results but does not currently reconstruct rolling model state after restart. Horizontal scaling requires a distributed state/locking design.

Recommended start command:

```bash
python -m uvicorn alga_twin_api.main:app \
  --host 0.0.0.0 --port 8000 --workers 1
```

## 11. Backend completion checklist

- [ ] Create application `ponds` collection and unique `pond_id` index.
- [ ] Configure secured MongoDB connection.
- [ ] Configure API key and private service URL.
- [ ] Implement a single-owner cron/distributed lock.
- [ ] Call `POST /predict` with `batch_size: 3`.
- [ ] Proxy `GET /dashboard` after pond ownership validation.
- [ ] Proxy `POST /simulate` and optionally accept an image upload.
- [ ] Forward dashboard updates through WebSocket/SSE if required.
- [ ] Decide whether to retain base64 images or use object storage.
- [ ] Implement retention/backups/monitoring.
- [ ] Test cursor wrap from row 999 to row 1.
- [ ] Test service restart and MongoDB recovery behavior.
- [ ] Review dataset/model redistribution rights before public deployment.
