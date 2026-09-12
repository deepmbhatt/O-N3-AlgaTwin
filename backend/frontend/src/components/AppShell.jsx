import { NavLink, Outlet } from 'react-router-dom';
import { usePondData } from '../context/pondDataStore';

const nav = [
  ['/', 'Command center', 'grid'],
  ['/scenario-lab', 'Scenario lab', 'sliders'],
  ['/remote-verification', 'Remote verification', 'satellite'],
];

function NavIcon({ type }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    rings: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3M23 12h-3M12 23v-3M1 12h3"/></>,
    sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></>,
    satellite: <><path d="M8 4l12 12-4 4L4 8zM14 6l4-4M6 14l-4 4"/><path d="M14 14c-2.4 2.4-6.3 2.4-8.7 0M17 17c-4 4-10.5 4-14.5 0"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

export default function AppShell() {
  const { connection, ponds, lastSync } = usePondData();
  const labels = { connected: 'Live API', empty: 'API ready', fallback: 'Demo fallback', offline: 'API offline', connecting: 'Connecting' };
  return (
    <div className={`app-shell connection-${connection}`}>
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark"><i/><i/><i/></span>
          <span><b>AlgaTwin</b><small>Living intelligence for algae ponds</small></span>
        </NavLink>
        <div className="topbar-status">
          <span className={`api-pill api-${connection}`}><i/>{labels[connection]}</span>
          <span className="live-pill"><i/> {lastSync ? `Synced ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for API'}</span>
          <span className="avatar">AK</span>
        </div>
      </header>
      <aside className="sidebar">
        <nav>{nav.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}><NavIcon type={icon}/><span>{label}</span></NavLink>)}</nav>
        <div className="sidebar-foot"><span className="tiny-orbit"/><p><b>{ponds.length || 3} ponds configured</b><br/>{connection === 'connected' ? 'Live model history loaded' : 'Waiting for live state'}</p></div>
      </aside>
      <main className="app-main"><Outlet/></main>
    </div>
  );
}
