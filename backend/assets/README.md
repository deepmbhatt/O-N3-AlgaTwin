# AlgaTwin — Algae-Based Carbon Sequestration Monitoring Platform

## Overview

AlgaTwin is a monitoring and decision-support platform for algae farms that want to prove, measure, and optimize their carbon sequestration performance. The platform combines live sensor data, AI-based forecasting, and remote visual verification to make algae cultivation measurable, credible, and investable.

The solution is designed for:

- Algae farm operators
- Carbon credit verifiers
- Environmental researchers
- Investors and project developers

It helps users answer a critical question: how much carbon is being captured and how confident can we be in that claim?

---

## What our product does

AlgaTwin provides a unified operational dashboard that tracks the health of algae ponds in real time and links biological performance to measurable carbon outcomes.

### Core product capabilities

- Live pond monitoring using simulated IoT data such as:
  - water temperature
  - dissolved oxygen
  - pH
  - nutrient levels
  - light intensity
- AI-driven predictions for biomass growth and ecosystem health
- Carbon and environmental performance monitoring for algae cultivation sites
- Satellite and image-based verification using remote evidence and visual classification
- Scenario simulation to test interventions before applying them
- Operational reporting for decision-makers and verification stakeholders

### Why it matters

Algae cultivation is a promising route for carbon capture and circular bioeconomy value creation, but without trustworthy measurement, it is difficult to validate sequestration outcomes and attract funding. AlgaTwin solves that by turning pond operations into a transparent, data-backed system that supports both technical and financial decision-making.

---

## Product use cases

### 1. Farm operations
Operators can see the current health of a pond, detect stressful conditions, and run predictive checks before making changes to the cultivation system.

### 2. Carbon verification
Carbon credit verifiers and sustainability teams can review evidence from sensors, environmental models, and remote imagery to validate sequestration performance.

### 3. Research and modeling
Researchers can inspect pond trends, compare growth conditions, and study the relationship between environmental variables and carbon uptake.

### 4. Investment confidence
Investors gain visibility into whether algae farms are generating measurable carbon value and maintaining stable operational performance.

---

## Platform highlights

### Live command center
The dashboard gives a live view of pond behavior, model health, anomalies, and key environmental indicators.

### Scenario lab
Users can adjust environmental parameters and simulate expected changes without affecting the live system.

### Remote verification
AlgaTwin combines pond imagery and remote sensing signals to assess visual condition and provide evidence-based validation.

### Predictive intelligence
The platform uses modeled outputs to assess biomass trajectory, health signals, and likely operational responses.

---

## Screenshots from the project

### Dashboard overview
![Dashboard overview](./Screenshot%202026-09-12%20at%2014.57.01.png)

### Pond health monitoring
![Pond health monitoring](./Screenshot%202026-09-12%20at%2014.57.16.png)

### Scenario simulation interface
![Scenario simulation interface](./Screenshot%202026-09-12%20at%2014.57.28.png)

### Remote verification view
![Remote verification view](./Screenshot%202026-09-12%20at%2014.57.40.png)

### AI-driven evidence and model insights
![AI-driven evidence and model insights](./Screenshot%202026-09-12%20at%2014.57.49.png)

---

## Tech stack

### Frontend
- React
- Vite
- JavaScript / JSX
- React Router

### Backend
- Node.js
- Express.js
- JWT / auth middleware support
- MongoDB-ready integration

### AI and modeling layer
- Python
- FastAPI
- Pandas
- NumPy
- scikit-learn
- Joblib
- Uvicorn

### Data and environment
- CSV-based pond stream simulation
- API-driven prediction and scenario modeling
- Image and remote sensing support
- Docker support for deployment

---

## System requirements to recreate the project

### Minimum required software

- Node.js v18 or later
- npm or yarn
- Python 3.10+
- pip
- Docker (optional, for containerized setup)
- MongoDB (optional, for persistent storage)

### Recommended environment

- VS Code
- Git
- Python virtual environment
- Local terminal access for running backend and frontend services

### Dependency setup

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Backend
```bash
cd backend
npm install
npm run dev
```

#### Model API
```bash
cd model-api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn alga_twin_api.main:app --host 0.0.0.0 --port 8000
```

#### Optional Docker deployment
```bash
cd model-api
docker compose up --build
```

---

## Project folder structure

```text
AlgaTwin/
├── backend/
│   ├── assets/
│   │   ├── README.md
│   │   ├── Screenshot 2026-09-12 at 14.57.01.png
│   │   ├── Screenshot 2026-09-12 at 14.57.16.png
│   │   ├── Screenshot 2026-09-12 at 14.57.28.png
│   │   ├── Screenshot 2026-09-12 at 14.57.40.png
│   │   └── Screenshot 2026-09-12 at 14.57.49.png
│   ├── controllers/
│   ├── db/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── index.js
│   ├── package.json
│   └── ...
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── ...
├── model-api/
│   ├── alga_twin_api/
│   ├── data/
│   ├── examples/
│   ├── models/
│   ├── scripts/
│   ├── tests/
│   ├── requirements.txt
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── README.md
│   └── ...
├── README.md (optional project-level overview)
└── ...
```

---

## How the solution fits the problem statement

This platform addresses the challenge of monitoring algae-based carbon sequestration in a measurable and trustworthy way. By combining:

- live pond sensor data,
- forecast modeling,
- satellite/remotely sensed evidence,
- and image-based verification,

it creates a more reliable system for proving carbon capture performance and supporting investment in algae-based carbon removal and circular bioindustry projects.

---

## Summary

AlgaTwin is a practical carbon monitoring platform for algae cultivation sites. It turns raw environmental and operational data into a clear operational picture, supports predictive decision-making, and provides evidence-backed carbon monitoring that is suitable for technical teams, researchers, and sustainability stakeholders.

This solution provides a strong foundation for building a credible algae sequestration ecosystem around measurable, validated carbon performance.
