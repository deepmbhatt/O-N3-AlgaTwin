import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navigation({ onNightToggle }) {
  return (
    <nav className="rail" aria-label="Main navigation">
      <NavLink className="brand" to="/" aria-label="Verdance home">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8 6 5 10 5 14a7 7 0 0 0 14 0c0-4-3-8-7-12z" fill="#F4F6F3"/></svg>
      </NavLink>
      
      <NavLink className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`} data-label="Command Center" to="/" aria-label="Command Center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 13l2.5 2.5L16 9"/></svg>
      </NavLink>
      
      <NavLink className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`} data-label="Pond Digital Twin" to="/pond-digital-twin" aria-label="Pond Digital Twin">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>
      </NavLink>
      
      <NavLink className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`} data-label="AI Intelligence" to="/ai-intelligence" aria-label="AI Intelligence">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/><circle cx="12" cy="12" r="4"/></svg>
      </NavLink>
      
      <NavLink className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`} data-label="Satellite Verification" to="/satellite-verification" aria-label="Satellite Verification">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4l6 6M13 3l8 8-3 3-8-8zM7 13l4 4-3 3-4-4z"/></svg>
      </NavLink>
      
      <NavLink className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`} data-label="Scenario Simulator" to="/scenario-simulator" aria-label="Scenario Simulator">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20V10M10 20V4M16 20v-7M4 10l6-6 6 3 4-3" /></svg>
      </NavLink>
      
      <NavLink className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`} data-label="Carbon MRV" to="/carbon-mrv" aria-label="Carbon MRV">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h10M4 18h13"/></svg>
      </NavLink>
      
      <NavLink className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`} data-label="Reports" to="/reports" aria-label="Reports">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h6M9 16h6"/></svg>
      </NavLink>
      
      {onNightToggle && (
        <button className="rail-item" onClick={onNightToggle} data-label="Toggle time of day" aria-label="Toggle day/night mode">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>
        </button>
      )}
    </nav>
  );
}
