# AlgaTwin

Algae-Based Carbon Sequestration Monitoring Platform

A real-time MRV platform for industrial algae farms that combines IoT telemetry, AI-based growth modeling, and an interactive digital twin interface to track CO2 capture, biomass estimation, and pond health.

---

## Overview

AlgaTwin is built for industrial algae cultivation environments where operational monitoring, carbon accounting, and predictive intelligence must work together. The platform enables farm operators, verifiers, and researchers to track pond health, simulate future scenarios, and maintain a trustworthy historical record of actual operational performance.

The project addresses a critical gap in the carbon capture ecosystem: while algae farms can absorb CO2 and generate biomass, proving that value in a reliable and auditable way is difficult without a proper MRV system. AlgaTwin brings together:

- live environmental telemetry,
- AI-driven forecasting,
- simulation-based experimentation,
- and a digital twin-style operational dashboard.

This turns algae cultivation into a more measurable, transparent, and investable sustainability system.

---

## HackOut'26 Project

This project was built for HackOut'26 as a modern solution for algae-based carbon sequestration monitoring and performance verification.

---

## Team Members

- Nishant Prakash Asnani — Backend Developer
- Deep Bhat — AI Developer
- Kajal Varlani — Frontend Developer

---

## Key Features

### 1. Live Telemetry & Replay Stream
AlgaTwin continuously ingests pond telemetry and records it in a replayable historical ledger. This creates a reliable compliance trail for environmental monitoring and supports traceable performance assessments over time.

- real-time pond health monitoring
- historical replay for audit-ready review
- compliance-friendly time-series event logging

### 2. Interactive Scenario Simulator (Sandbox Mode)
Operators can change environmental parameters such as temperature, nitrate, light, and CO2 to understand how a pond may behave under different conditions without polluting the live audit trail.

- risk-free experimentation
- predictive impact analysis using AI models
- response testing for future operational decisions

### 3. Automated Anomaly Detection
The system flags pond conditions as Optimal, Mild Stress, or Critical to help teams identify when intervention is needed.

- early warning alerts
- operational stress classification
- rapid response support

### 4. Digital Twin Interface
The platform presents a digital twin of the pond environment so users can monitor system behavior in a more intuitive and visual way.

- live state visualization
- operational monitoring dashboard
- decision-friendly situational awareness

### 5. Carbon and Biomass Intelligence
The platform estimates the relationship between growth conditions, biomass output, and CO2 capture potential, helping operators make sustainability-oriented decisions with greater confidence.

---

## System Architecture

AlgaTwin is structured as a multi-layer platform that separates operational monitoring from predictive simulation.

```text
+---------------------------+
| Frontend / Dashboard      |
| React + Tailwind UI       |
+-------------+-------------+
              |
              v
+---------------------------+
| Backend API               |
| Node.js + Express.js      |
| Controller-Service Layer  |
+-------------+-------------+
              |
              +---------------------------+
              |                         |
              v                         v
+---------------------+   +---------------------------+
| MongoDB / Mongoose  |   | Python FastAPI AI Service |
| Event Store         |   | Growth & Prediction Model  |
+---------------------+   +---------------------------+
```

### Backend Architecture
The backend follows a clean controller-service pattern, ensuring modularity and clear separation of request handling, business logic, and persistence.

- controllers handle incoming API requests
- services manage business logic and orchestration
- database layer persists operational and predictive records

### Database Design
The database is designed around a time-series event model with a strong separation between live operational data and sandbox-generated forecasts.

#### Live vs. Simulation State Separation
A critical design principle in AlgaTwin is the distinction between:

- live baseline records representing actual pond conditions
- simulated records representing hypothetical conditions in sandbox mode

This is enforced using an `isSimulation` flag in the schema boundary:

```js
{
  pondId: "pond-01",
  timestamp: "2026-09-12T12:00:00Z",
  isSimulation: false,
  temperature: 28.3,
  nitrate: 19.4,
  co2_uptake: 0.62,
  biomass_estimate: 1.74
}
```

```js
{
  pondId: "pond-01",
  timestamp: "2026-09-12T12:15:00Z",
  isSimulation: true,
  temperature: 31.0,
  nitrate: 10.2,
  co2_uptake: 0.74,
  biomass_estimate: 1.92,
  scenarioLabel: "heat-stress-projection"
}
```

This makes it possible to:

- preserve an auditable baseline ledger for real operational data,
- run exploratory scenario analysis without contaminating compliance records,
- maintain a clean audit trail for both production and predictive states.

### Automation
Background cron jobs periodically fetch new pond records and AI predictions to keep operational views current.

- node-cron for scheduled jobs
- automated data sync and refresh
- periodic prediction runs for live monitoring

---

## API Endpoints Overview

The backend exposes a compact set of endpoints for current state, historical review, and scenario execution.

### Core endpoints

- `GET /latest` — fetch the most recent operational state for a pond or farm
- `GET /history` — fetch historical telemetry and event records
- `POST /simulate` — run a sandbox simulation with custom environment parameters

### Example summary

```http
GET /api/latest?pondId=pond-01
GET /api/history?pondId=pond-01&limit=50
POST /api/simulate
Content-Type: application/json
```

These endpoints allow the frontend and AI service to work together while preserving the distinction between live operational records and scenario outputs.

---

## Screenshot Gallery

Below are placeholder sections for final visuals. Replace each path with the actual image asset once the screenshots are added to the repository.

### Dashboard Overview
![Dashboard Overview](screenshots/dashboard.png)

Caption: Live pond dashboard showing telemetry, health scores, and carbon-related monitoring indicators.

### Historical Replay and Event Stream
![Historical Replay](screenshots/history.png)

Caption: Historical pond record timeline used to track live operational performance and audit retention.

### Scenario Simulator
![Scenario Simulator](screenshots/simulator.png)

Caption: Sandbox mode for adjusting environmental parameters and forecasting future pond response without altering baseline data.

### Anomaly Alert View
![Anomaly Detection](screenshots/anomaly.png)

Caption: System alerts identifying stress conditions and highlighting operational intervention needs.

### Digital Twin / Pond View
![Digital Twin](screenshots/twin.png)

Caption: Visualization of the pond state and operational health model presented as an interactive digital twin.

---

## Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- Axios
- Node-Cron

### AI / ML
- Python
- FastAPI
- Scikit-learn / ML modeling stack
- AI-driven growth and sequestration prediction layer

### Frontend
- React
- Tailwind CSS
- Clean squared-card UI
- Icon-based monitoring indicators
- Minimal rigid layout system for operational clarity

---

## Local Setup & Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Python 3.10+
- MongoDB running locally or via Docker
- Git

### 1. Clone the repository

```bash
git clone <repository-url>
cd AlgaTwin
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Update the environment variables in `.env` with your MongoDB connection details and app settings.

Run the backend:

```bash
npm start
```

### 3. AI service setup

```bash
cd model-api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn alga_twin_api.main:app --host 0.0.0.0 --port 8000
```

### 4. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

### 5. Optional Docker setup

If a containerized environment is available:

```bash
docker-compose up --build
```

---

## Project Goals

AlgaTwin aims to make algae-based carbon sequestration more measurable, operationally useful, and investment-friendly. By combining sensing, intelligence, and verification, the project creates a robust foundation for next-generation carbon MRV systems in industrial algae production.

---

## License

This project is developed for HackOut'26 and is intended for demonstration and collaborative technical exploration.

---

## Contact / Repository

For questions, collaboration, or extension ideas, please reach out via the project repository or internal team channels.
