import type { LapRow } from '../../engine/laps';
import { Zone, zoneIndex } from '../../engine/zones';
import { fmtDuration, fmtDistance, fmtSpeed } from '../../app/format';
type Now = { number: number; durationS: number; distanceM: number; avgPower: number; avgHr: number; avgCad: number; avgSpeedMs: number };
// Literal class strings so Tailwind can see them at build time (no dynamic bg-zone-${cls}).
export const ZONE_BG: Record<string, string> = { z1: 'z1 bg-zone-z1/20', z2: 'z2 bg-zone-z2/20', z3: 'z3 bg-zone-z3/20', z4: 'z4 bg-zone-z4/20', z5: 'z5 bg-zone-z5/20', z6: 'z6 bg-zone-z6/20', z7: 'z7 bg-zone-z7/20' };
export default function LapTable({ rows, now, zones, unit, showNow = true }: { rows: LapRow[]; now: Now; zones: Zone[]; unit: 'metric' | 'imperial'; showNow?: boolean }) {
  const cls = (w: number) => ZONE_BG[zones[zoneIndex(zones, w)].cls] ?? '';
  const cell = (r: Now | LapRow, lap: string, dif: string) => (
    <>
      <td className="px-1">{lap}</td><td className="px-1 tabular-nums">{fmtDuration(r.durationS)}</td><td className="px-1">{fmtSpeed(r.avgSpeedMs, unit)}</td><td className="px-1">{fmtDistance(r.distanceM, unit)}</td>
      <td className="px-1">{Math.round(r.avgPower)}</td><td className="px-1">{Math.round(r.avgHr)}</td><td className="px-1">{dif}</td><td className="px-1">{Math.round(r.avgCad)}</td>
    </>
  );
  return (
    <div className="overflow-x-auto"><table className="w-full text-xs">
      <thead><tr>{['Lap', 'Time', 'Avg Speed', 'Distance', 'Avg Power', 'Avg HR', '%dif HR', 'Avg CAD'].map((h) => <th key={h} className="text-left px-1 py-1 text-gg-muted font-normal">{h}</th>)}</tr></thead>
      <tbody>
        {showNow && <tr className={cls(now.avgPower)}>{cell(now, 'NOW', '')}</tr>}
        {[...rows].reverse().map((r) => <tr key={r.number} className={cls(r.avgPower)}>{cell(r, String(r.number), r.difHrPct === null ? '' : `${r.difHrPct >= 0 ? '+' : ''}${r.difHrPct.toFixed(1)}%`)}</tr>)}
      </tbody>
    </table></div>
  );
}
