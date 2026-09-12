import { NavLink } from 'react-router-dom';

const navItems = [
  {
    to: '/',
    label: 'Command Center',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </svg>
    ),
  },
  {
    to: '/pond-digital-twin',
    label: 'Pond Digital Twin',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v3M23 12h-3M12 23v-3M1 12h3" />
      </svg>
    ),
  },
  {
    to: '/ai-intelligence',
    label: 'AI Intelligence',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    to: '/satellite-verification',
    label: 'Satellite Verification',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 4l12 12-4 4L4 8zM14 6l4-4M6 14l-4 4" />
        <path d="M14 14c-2.4 2.4-6.3 2.4-8.7 0M17 17c-4 4-10.5 4-14.5 0" />
      </svg>
    ),
  },
  {
    to: '/scenario-simulator',
    label: 'Scenario Simulator',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </svg>
    ),
  },
  {
    to: '/carbon-mrv',
    label: 'Carbon MRV',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2C8 6 5 10 5 14a7 7 0 0 0 14 0c0-4-3-8-7-12z" />
        <path d="M12 10v6M9 13l3 3 3-3" />
      </svg>
    ),
  },
  {
    to: '/reports',
    label: 'Reports',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M9 12h6M9 16h6" />
      </svg>
    ),
  },
];

export default function Navigation() {
  return (
    <nav aria-label="Main navigation">
      {navItems.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          {icon}
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
