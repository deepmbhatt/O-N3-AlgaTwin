import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { snapshots } from '../data/mockData';
import { getDashboard, normalizePrediction, runPredictionBurst } from '../services/dataSource';
import { PondDataContext } from './pondDataStore';

const refreshMs = Math.max(5000, Number(import.meta.env.VITE_ALGATWIN_POLL_MS || 15000));
const predictMs = Math.max(5000, Number(import.meta.env.VITE_ALGATWIN_PREDICT_MS || 15000));
const autoPredict = import.meta.env.VITE_ALGATWIN_AUTO_PREDICT !== 'false';
const allowFallback = import.meta.env.VITE_ALGATWIN_ALLOW_MOCK_FALLBACK !== 'false';

export function PondDataProvider({ children }) {
  const [ponds, setPonds] = useState([]);
  const [activePondId, setActivePondId] = useState('pond-01');
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [lastPrediction, setLastPrediction] = useState(null);
  const predictionInFlight = useRef(false);
  const activePondIdRef = useRef(activePondId);

  useEffect(() => {
    activePondIdRef.current = activePondId;
  }, [activePondId]);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setBusy(true);
    try {
      const payload = await getDashboard(undefined, 48);
      const normalized = (payload.data || []).filter(item => item.latest).map(item => ({
        pond_id: item.pond_id,
        snapshot: normalizePrediction(item.latest, item.history || []),
        latestSimulation: item.latest_simulation || null,
      }));
      setPonds(normalized);
      setCursor(payload.cursor || null);
      setConnection(normalized.length ? 'connected' : 'empty');
      setError(normalized.length ? '' : 'API connected. The automatic predictor will create the first pond state shortly.');
      setLastSync(new Date());
      if (normalized.length && !normalized.some(item => item.pond_id === activePondIdRef.current)) {
        setActivePondId(normalized[0].pond_id);
      }
    } catch (requestError) {
      setConnection(allowFallback ? 'fallback' : 'offline');
      setError(requestError.message || 'Unable to reach the AlgaTwin API.');
    } finally {
      if (!quiet) setBusy(false);
    }
  }, []);

  const processNextBurst = useCallback(async ({ background = false } = {}) => {
    if (predictionInFlight.current) return null;
    predictionInFlight.current = true;
    if (!background) setBusy(true);
    setError('');
    try {
      const payload = await runPredictionBurst({ batchSize: 3, includeImages: true, returnImageBase64: true });
      setCursor(payload.cursor || null);
      setLastPrediction(new Date());
      await refresh({ quiet: true });
      return payload;
    } catch (requestError) {
      setConnection(allowFallback ? 'fallback' : 'offline');
      setError(requestError.message || 'Prediction burst failed.');
      if (!background) throw requestError;
      return null;
    } finally {
      predictionInFlight.current = false;
      if (!background) setBusy(false);
    }
  }, [refresh]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(kickoff);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        if (autoPredict) void processNextBurst({ background: true });
        else void refresh({ quiet: true });
      }
    }, autoPredict ? predictMs : refreshMs);
    return () => window.clearInterval(timer);
  }, [processNextBurst, refresh]);

  const activeEntry = useMemo(() => ponds.find(item => item.pond_id === activePondId) || ponds[0], [ponds, activePondId]);
  const snapshot = activeEntry?.snapshot || snapshots.healthy;
  const usingFallback = !activeEntry;
  const pondOptions = useMemo(() => ponds.length ? ponds.map(item => ({
    id: item.pond_id,
    name: item.pond_id.replace('-', ' ').replace(/\b\w/g, char => char.toUpperCase()),
    status: item.snapshot?.label || 'Active',
  })) : [
    { id: 'pond-01', name: 'Pond 01', status: connection === 'empty' ? 'Automatic stream pending' : 'Demo fallback' },
    { id: 'pond-02', name: 'Pond 02', status: 'Awaiting live data' },
    { id: 'pond-03', name: 'Pond 03', status: 'Awaiting live data' },
  ], [ponds, connection]);

  const value = useMemo(() => ({
    snapshot, ponds, pondOptions, activePondId, setActivePondId,
    connection, error, busy, cursor, lastSync, lastPrediction, usingFallback,
    refresh, processNextBurst, autoPredict, predictMs,
    latestSimulation: activeEntry?.latestSimulation || null,
  }), [snapshot, ponds, pondOptions, activePondId, connection, error, busy, cursor, lastSync, lastPrediction, usingFallback, refresh, processNextBurst, activeEntry]);

  return <PondDataContext.Provider value={value}>{children}</PondDataContext.Provider>;
}
