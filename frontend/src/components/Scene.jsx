import React, { useState, useEffect } from 'react';

export default function Scene({ night, children }) {
  const [clouds, setClouds] = useState([]);

  useEffect(() => {
    // Generate clouds once on mount
    const newClouds = [];
    for (let i = 0; i < 4; i++) {
      const w = 90 + Math.random() * 90;
      const h = w * 0.4;
      newClouds.push({
        id: i,
        width: w + 'px',
        height: h + 'px',
        top: (8 + Math.random() * 18) + '%',
        left: (Math.random() * 80) + '%',
        animationDuration: (30 + Math.random() * 30) + 's',
        animationDirection: i % 2 ? 'alternate-reverse' : 'alternate'
      });
    }
    setClouds(newClouds);
  }, []);

  return (
    <div className={`scene ${night ? 'night' : ''}`} id="scene">
      <div className="sky"></div>
      <div className="sun"></div>
      <div className="hills">
        <div className="hill h1"></div>
        <div className="hill h2"></div>
      </div>
      <div id="clouds">
        {clouds.map(c => (
          <div key={c.id} className="cloud" style={{
            width: c.width,
            height: c.height,
            top: c.top,
            left: c.left,
            animationDuration: c.animationDuration,
            animationDirection: c.animationDirection
          }}></div>
        ))}
      </div>
      {children}
    </div>
  );
}
