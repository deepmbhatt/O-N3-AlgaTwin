const toPoints = (values, width, height, pad) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((value, index) => {
    const x = pad + (index / Math.max(1, values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
};

export default function Sparkline({ values, label = 'Trend', tone = 'green', height = 150 }) {
  const width = 560;
  const points = toPoints(values, width, height, 12);
  const area = `12,${height - 10} ${points} ${width - 12},${height - 10}`;
  return (
    <div className={`sparkline sparkline-${tone}`} aria-label={label}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity=".26" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="12" x2={width - 12} y1={height * .34} y2={height * .34} className="chart-grid" />
        <line x1="12" x2={width - 12} y1={height * .67} y2={height * .67} className="chart-grid" />
        <polygon points={area} fill={`url(#spark-${tone})`} />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
