import { NavLink, Outlet } from 'react-router-dom';
import { usePondData } from '../context/pondDataStore';
import Navigation from './Navigation';

export default function AppShell() {
  const { connection, ponds, lastSync } = usePondData();
  const labels = {
    connected: 'Live API',
    empty: 'API ready',
    fallback: 'Demo fallback',
    offline: 'API offline',
    connecting: 'Connecting',
  };

  return (
    <div className={`app-shell connection-${connection}`}>
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="AlgaTwin Home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><b>AlgaTwin</b><small>Living intelligence for algae ponds</small></span>
        </NavLink>
        <div className="topbar-status">
          <span className={`api-pill api-${connection}`}><i />{labels[connection] || connection}</span>
          <span className="live-pill">
            <i /> {lastSync ? `Synced ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for API'}
          </span>
          <span className="avatar" aria-label="User avatar">AK</span>
        </div>
      </header>
      <aside className="sidebar">
        <Navigation />
        <div className="sidebar-foot">
          <span className="tiny-orbit" />
          <p>
            <b>{ponds.length || 3} ponds configured</b>
            <br />
            {connection === 'connected' ? 'Live model history loaded' : 'Waiting for live state'}
          </p>
        </div>
      </aside>
      <main className="app-main"><Outlet /></main>
    </div>
  );
}
