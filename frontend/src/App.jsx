import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CommandCenter from './pages/CommandCenter';
import PondDigitalTwin from './pages/PondDigitalTwin';
import AIIntelligence from './pages/AIIntelligence';
import SatelliteVerification from './pages/SatelliteVerification';
import ScenarioSimulator from './pages/ScenarioSimulator';
import CarbonMRV from './pages/CarbonMRV';
import Reports from './pages/Reports';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/command-center.html" />} />
        <Route path="/command-center.html" element={<CommandCenter />} />
        <Route path="/pond-digital-twin.html" element={<PondDigitalTwin />} />
        <Route path="/ai-intelligence.html" element={<AIIntelligence />} />
        <Route path="/satellite-verification.html" element={<SatelliteVerification />} />
        <Route path="/scenario-simulator.html" element={<ScenarioSimulator />} />
        <Route path="/carbon-mrv.html" element={<CarbonMRV />} />
        <Route path="/reports.html" element={<Reports />} />
      </Routes>
    </Router>
  );
}

export default App;
