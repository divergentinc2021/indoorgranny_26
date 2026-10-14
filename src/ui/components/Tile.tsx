// Vendor metric tile: small white caption over a flat cyan strip. No card, border, radius or shadow.
// 'main' = Power/HR/Cadence, 'small' = bottom info row, 'bare' = the elapsed strip (caption read by screen readers only).
// Tablet (>= 600 px): value 45 px (39 px small) black on cyan, caption 25 px, AVG/MAX line visible.
export default function Tile({ label, value, sub, size = 'main' }: { label: string; value: string | number; sub?: string; size?: 'main' | 'small' | 'bare' }) {
  const cap = size === 'bare' ? 'sr-only' : size === 'small' ? 'text-[14px]' : 'text-[14px] tab:text-[25px]';
  const val = size === 'small' ? 'text-[14px] tab:text-[39px]' : 'text-[25px] tab:text-[45px]';
  return (
    <div className="bg-gg-bg p-1">
      <div className={`text-white text-center leading-tight ${cap}`}>{label}</div>
      <div className={`bg-gg-strip text-white tab:text-black ${val} text-center tabular-nums leading-tight`}>{value}</div>
      {sub && <div className="hidden tab:block bg-gg-strip text-black text-[20px] text-center tabular-nums">{sub}</div>}
    </div>
  );
}
