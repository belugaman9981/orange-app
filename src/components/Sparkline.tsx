interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

/** Tiny inline SVG line chart, no charting library required. */
export function Sparkline({ values, width = 240, height = 56 }: SparklineProps) {
  if (values.length < 2) return <div className="sparkline sparkline--empty">no training history yet</div>;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(" ");

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--orange-500)" strokeWidth={2} />
    </svg>
  );
}
