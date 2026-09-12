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
        <Route path="/" element={<CommandCenter />} />
        <Route path="/pond-digital-twin" element={<PondDigitalTwin />} />
        <Route path="/ai-intelligence" element={<AIIntelligence />} />
        <Route path="/satellite-verification" element={<SatelliteVerification />} />
        <Route path="/scenario-simulator" element={<ScenarioSimulator />} />
        <Route path="/carbon-mrv" element={<CarbonMRV />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Router>
  );
}

export default App;
