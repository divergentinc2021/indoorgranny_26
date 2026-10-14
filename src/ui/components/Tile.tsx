export default function Tile({ label, value, sub, cls = '' }: { label: string; value: string | number; sub?: string; cls?: string }) {
  return (
    <div className={`rounded bg-gg-panel border border-gg-line p-2 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wide text-gg-muted">{label}</div>
      <div className="text-2xl font-heading font-semibold tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-xs text-gg-muted tabular-nums">{sub}</div>}
    </div>
  );
}
