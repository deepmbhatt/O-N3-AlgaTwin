import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { PondDataProvider } from './context/PondDataContext';
import CommandCenter from './pages/CommandCenter';
import ScenarioSimulator from './pages/ScenarioSimulator';
import SatelliteVerification from './pages/SatelliteVerification';

export default function App() {
  return <BrowserRouter><PondDataProvider><Routes><Route element={<AppShell/>}>
    <Route path="/" element={<CommandCenter/>}/>
    <Route path="/digital-twin" element={<Navigate to="/" replace/>}/>
    <Route path="/scenario-lab" element={<ScenarioSimulator/>}/>
    <Route path="/remote-verification" element={<SatelliteVerification/>}/>
    <Route path="/pond-digital-twin" element={<Navigate to="/" replace/>}/>
    <Route path="/scenario-simulator" element={<Navigate to="/scenario-lab" replace/>}/>
    <Route path="/satellite-verification" element={<Navigate to="/remote-verification" replace/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Route></Routes></PondDataProvider></BrowserRouter>;
}
