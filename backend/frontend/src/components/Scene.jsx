import React from 'react';

const clouds = [
  { id: 0, width: '118px', height: '47px', top: '10%', left: '9%', animationDuration: '42s', animationDirection: 'alternate' },
  { id: 1, width: '146px', height: '58px', top: '18%', left: '31%', animationDuration: '55s', animationDirection: 'alternate-reverse' },
  { id: 2, width: '104px', height: '42px', top: '14%', left: '57%', animationDuration: '48s', animationDirection: 'alternate' },
  { id: 3, width: '161px', height: '64px', top: '23%', left: '72%', animationDuration: '59s', animationDirection: 'alternate-reverse' },
];

export default function Scene({ night, children }) {
  return (
    <div className={`scene ${night ? 'night' : ''}`} id="scene">
      <div className="sky"></div>
      <div className="sun"></div>
      <div className="hills"><div className="hill h1"></div><div className="hill h2"></div></div>
      <div id="clouds">{clouds.map(c => <div key={c.id} className="cloud" style={c}></div>)}</div>
      {children}
    </div>
  );
}
