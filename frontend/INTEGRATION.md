# AlgaTwin frontend and API integration

The frontend is API-first and uses the FastAPI service in `dig_twin_hackout/alga_twin_api_package`.

## Local start

Terminal 1:

```bash
cd /home/student/Deep-Mtech/dig_twin_hackout/alga_twin_api_package
uvicorn alga_twin_api.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
cd /home/student/Deep-Mtech/O-N3-/frontend
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/algatwin/*` to port 8000.

## Screen-to-endpoint mapping

- While the dashboard tab is visible, it calls `POST /predict` every 15 seconds with a three-row burst, images enabled, and image base64 returned. The response is then refreshed from `GET /dashboard?limit=48`.
- Command Center's **Predict now** button triggers the same cycle immediately without waiting for the next timer tick.
- Scenario Lab calls `POST /simulate` using the selected pond's latest streamed baseline.
- Optional scenario images are converted to base64 and submitted as `image_data`.
- Remote Verification reads the image, classification, satellite output, and reflectance from the same prediction record.
- `GET /health` and `GET /models` are available in the API client for operational screens.

## Production configuration

Set `VITE_ALGATWIN_API_URL` to a public reverse-proxy path, for example `/algatwin`. The reverse proxy should forward that path to FastAPI and remove the prefix.

Do not place a permanent secret in `VITE_ALGATWIN_API_KEY`: every Vite variable is shipped to the browser. If API-key authentication is required, keep the key in your main backend and proxy AlgaTwin requests server-side.

Set `VITE_ALGATWIN_ALLOW_MOCK_FALLBACK=false` for strict production behavior. In fallback mode the interface is clearly labelled and simulation submission is disabled.

`VITE_ALGATWIN_AUTO_PREDICT=true` enables the browser-driven demonstration loop. `VITE_ALGATWIN_PREDICT_MS=15000` sets its interval. For a multi-user production deployment, run one server-side scheduler instead and set this flag to `false`, otherwise each open browser can advance the shared stream cursor.

## State behavior

The backend-provided health score, anomaly severity, anomaly probability, chlorophyll, turbidity, temperature, dissolved oxygen, and carbon uptake are transformed once by `src/lib/visualState.js`. All pond color, haze, fish activity, bubbles, warning zones, health indicators, and mascot mood use that state.

The browser never writes prediction records to MongoDB. The FastAPI service persists them when `ALGATWIN_MONGODB_URI` is configured.
