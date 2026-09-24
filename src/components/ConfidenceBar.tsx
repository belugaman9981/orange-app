interface ConfidenceBarProps {
  label: string;
  value: string;
  confidence: number;
  tone?: "neutral" | "good" | "warn" | "bad";
}

export function ConfidenceBar({ label, value, confidence, tone = "neutral" }: ConfidenceBarProps) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="confidence-bar">
      <div className="confidence-bar__row">
        <span className="confidence-bar__label">{label}</span>
        <span className={`badge tone-${tone}`}>{value}</span>
      </div>
      <div className="confidence-bar__track" role="progressbar" aria-label={`${label} confidence`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`confidence-bar__fill tone-${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="confidence-bar__pct">{pct}% confident</span>
    </div>
  );
}
