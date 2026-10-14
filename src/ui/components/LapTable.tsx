import type { LapRow } from '../../engine/laps';
import { Zone, zoneIndex } from '../../engine/zones';
import { fmtDuration, fmtDistance, fmtSpeed } from '../../app/format';
type Now = { number: number; durationS: number; distanceM: number; avgPower: number; avgHr: number; avgCad: number; avgSpeedMs: number };
// Literal class strings so Tailwind can see them at build time (no dynamic bg-zone-${cls}).
const ZONE_BG: Record<string, string> = { z1: 'z1 bg-zone-z1', z2: 'z2 bg-zone-z2', z3: 'z3 bg-zone-z3', z4: 'z4 bg-zone-z4', z5: 'z5 bg-zone-z5', z6: 'z6 bg-zone-z6', z7: 'z7 bg-zone-z7' };
export default function LapTable({ rows, now, zones, unit, showNow = true }: { rows: LapRow[]; now: Now; zones: Zone[]; unit: 'metric' | 'imperial'; showNow?: boolean }) {
  const cls = (w: number) => ZONE_BG[zones[zoneIndex(zones, w)].cls] ?? '';
  // Vendor phone shows Lap, Time, Avg Power, Avg HR, Avg CAD; speed, distance and %dif HR appear from 600 px.
  const X = 'hidden tab:table-cell';
  const cell = (r: Now | LapRow, lap: string, dif: string) => (
    <>
      <td className="px-1">{lap}</td><td className="px-1 tabular-nums">{fmtDuration(r.durationS)}</td><td className={`px-1 ${X}`}>{fmtSpeed(r.avgSpeedMs, unit)}</td><td className={`px-1 ${X}`}>{fmtDistance(r.distanceM, unit)}</td>
      <td className="px-1">{Math.round(r.avgPower)}</td><td className="px-1">{Math.round(r.avgHr)}</td><td className={`px-1 ${X}`}>{dif}</td><td className="px-1">{Math.round(r.avgCad)}</td>
    </>
  );
  return (
    <div className="overflow-x-auto"><table className="w-full text-[14px] tab:text-[20px] text-center text-black">
      <thead><tr className="bg-white">{['Lap', 'Time', 'Avg Speed', 'Distance', 'Avg Power', 'Avg HR', '%dif HR', 'Avg CAD'].map((h) => <th key={h} className={`px-1 py-1 font-normal ${['Avg Speed', 'Distance', '%dif HR'].includes(h) ? X : ''}`}>{h}</th>)}</tr></thead>
      <tbody className="font-bold">
        {showNow && <tr className="bg-gg-zonebg">{cell(now, 'NOW', '')}</tr>}
        {[...rows].reverse().map((r) => <tr key={r.number} className={cls(r.avgPower)}>{cell(r, String(r.number), r.difHrPct === null ? '' : `${r.difHrPct >= 0 ? '+' : ''}${r.difHrPct.toFixed(1)}%`)}</tr>)}
      </tbody>
    </table></div>
  );
}
