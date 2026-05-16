interface Props {
  label: string;
  value: string | number;
  hint?: string;
  color?: string;
}

export function CcKpiCard({ label, value, hint, color = 'var(--cc-text)' }: Props) {
  return (
    <div className="cc-kpi-card">
      <div className="cc-kpi-value" style={{ color }}>{value}</div>
      <div className="cc-kpi-label">{label}</div>
      {hint && <div className="cc-kpi-sub">{hint}</div>}
    </div>
  );
}
