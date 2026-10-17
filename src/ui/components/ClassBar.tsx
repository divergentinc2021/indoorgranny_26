import type { ClassStatus } from '../../engine/classrun';
// Literal class maps so Tailwind keeps every zone (no dynamic bg-zone-${n}). Fill = a darker tone of the bar colour.
const ZONE_BAR: Record<number, string> = { 1: 'bg-zone-z1', 2: 'bg-zone-z2', 3: 'bg-zone-z3', 4: 'bg-zone-z4', 5: 'bg-zone-z5', 6: 'bg-zone-z6', 7: 'bg-zone-z7' };
const ZONE_FILL: Record<number, string> = { 1: 'bg-zonefill-z1', 2: 'bg-zonefill-z2', 3: 'bg-zonefill-z3', 4: 'bg-zonefill-z4', 5: 'bg-zonefill-z5', 6: 'bg-zonefill-z6', 7: 'bg-zonefill-z7' };
const mss = (s: number) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// During a class the LAP button becomes a progress bar: zone colour, a darker fill that grows left to right, interval name and time left. Tap = next interval.
export default function ClassBar({ status, onTap, className = '' }: { status: ClassStatus; onTap: () => void; className?: string }) {
  const iv = status.interval;
  const root = `relative overflow-hidden text-black font-bold text-[16px] leading-tight py-1 ${className}`;
  if (status.done || !iv) return <div role="button" aria-label="Next interval" className={`${root} bg-zone-z1 flex items-center justify-center text-center`}>Class done — free ride</div>;
  return (
    <div role="button" tabIndex={0} aria-label="Next interval" className={`${root} ${ZONE_BAR[iv.zone]}`} onClick={onTap} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); } }}>
      <div data-testid="class-fill" className={`absolute top-0 left-0 bottom-0 ${ZONE_FILL[iv.zone]}`} style={{ width: `${Math.round(status.pct * 100)}%` }} />
      <div className="relative px-1 text-center"><div className="truncate">{iv.displayName}</div><div className="tabular-nums">{mss(status.remainingS)}</div></div>
    </div>
  );
}
