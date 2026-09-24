interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

/** Tiny inline SVG line chart, no charting library required. */
export function Sparkline({ values, width = 240, height = 56 }: SparklineProps) {
  if (values.length < 2) return <div className="sparkline sparkline--empty">Train the model to see its progress.</div>;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const inset = 3;
  const step = (width - inset * 2) / (values.length - 1);
  const points = values.map((v, i) => `${inset + i * step},${height - inset - ((v - min) / range) * (height - inset * 2)}`).join(" ");

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label={`Training loss over ${values.length} epochs: ${values[0].toFixed(3)} to ${values[values.length - 1].toFixed(3)}`}>
      {[0.25, 0.75].map((fraction) => <line key={fraction} x1="0" x2={width} y1={height * fraction} y2={height * fraction} stroke="var(--line)" strokeDasharray="3 4" />)}
      <polygon points={`${inset},${height} ${points} ${width - inset},${height}`} fill="var(--orange-500)" opacity="0.06" />
      <polyline points={points} fill="none" stroke="var(--orange-500)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
