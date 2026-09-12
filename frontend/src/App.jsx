import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { PondDataProvider } from './context/PondDataContext';
import CommandCenter from './pages/CommandCenter';
import PondDigitalTwin from './pages/PondDigitalTwin';
import AIIntelligence from './pages/AIIntelligence';
import SatelliteVerification from './pages/SatelliteVerification';
import ScenarioSimulator from './pages/ScenarioSimulator';
import CarbonMRV from './pages/CarbonMRV';
import Reports from './pages/Reports';

export default function App() {
  return (
    <BrowserRouter>
      <PondDataProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<CommandCenter />} />
            <Route path="/pond-digital-twin" element={<PondDigitalTwin />} />
            <Route path="/digital-twin" element={<Navigate to="/pond-digital-twin" replace />} />
            <Route path="/ai-intelligence" element={<AIIntelligence />} />
            <Route path="/satellite-verification" element={<SatelliteVerification />} />
            <Route path="/remote-verification" element={<Navigate to="/satellite-verification" replace />} />
            <Route path="/scenario-simulator" element={<ScenarioSimulator />} />
            <Route path="/scenario-lab" element={<Navigate to="/scenario-simulator" replace />} />
            <Route path="/carbon-mrv" element={<CarbonMRV />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </PondDataProvider>
    </BrowserRouter>
  );
}
