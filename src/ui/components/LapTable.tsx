import type { LapRow } from '../../engine/laps';
import { Zone, zoneIndex } from '../../engine/zones';
import { fmtClock, fmtDistance, fmtSpeed } from '../../app/format';
type Now = { number: number; durationS: number; distanceM: number; avgPower: number; avgHr: number; avgCad: number; avgSpeedMs: number };
// Literal class strings so Tailwind can see them at build time (no dynamic bg-zone-${cls}).
const ZONE_BG: Record<string, string> = { z1: 'z1 bg-zone-z1', z2: 'z2 bg-zone-z2', z3: 'z3 bg-zone-z3', z4: 'z4 bg-zone-z4', z5: 'z5 bg-zone-z5', z6: 'z6 bg-zone-z6', z7: 'z7 bg-zone-z7' };
// fill = the Training screen's phone layout: a cyan scroll area that takes the remaining height, under a white header band
// that stays put (sticky th; Chrome 81 does not support sticky on thead/tr). From 600 px it reverts to the plain table.
export default function LapTable({ rows, now, zones, unit, showNow = true, fill = false }: { rows: LapRow[]; now: Now; zones: Zone[]; unit: 'metric' | 'imperial'; showNow?: boolean; fill?: boolean }) {
  const cls = (w: number) => ZONE_BG[zones[zoneIndex(zones, w)].cls] ?? '';
  // Vendor phone shows Lap, Time, Avg Power, Avg HR, Avg CAD; speed, distance and %dif HR appear from 600 px.
  const X = 'hidden tab:table-cell';
  const cell = (r: Now | LapRow, lap: string, dif: string, lapCls = '') => (
    <>
      <td className={`px-1 ${lapCls}`}>{lap}</td><td className={`px-1 ${X}`}>{'name' in r ? r.name ?? '' : ''}</td><td className="px-1 tabular-nums whitespace-nowrap">{fmtClock(r.durationS)}</td><td className={`px-1 ${X}`}>{fmtSpeed(r.avgSpeedMs, unit)}</td><td className={`px-1 ${X}`}>{fmtDistance(r.distanceM, unit)}</td>
      <td className="px-1">{Math.round(r.avgPower)}</td><td className="px-1">{Math.round(r.avgHr)}</td><td className={`px-1 ${X}`}>{dif}</td><td className="px-1">{Math.round(r.avgCad)}</td>
    </>
  );
  const root = fill ? 'flex-1 min-h-0 overflow-auto bg-gg-strip tab:flex-none tab:overflow-x-auto tab:overflow-y-visible tab:bg-transparent' : 'overflow-x-auto';
  const table = fill ? 'w-full text-[20px] text-center text-black' : 'w-full text-[14px] tab:text-[20px] text-center text-black';
  const th = fill ? 'sticky top-0 bg-white font-bold tab:static tab:font-normal' : 'font-normal';
  return (
    <div className={root}><table className={table}>
      <thead><tr className="bg-white">{['Lap', 'Name', 'Time', 'Avg Speed', 'Distance', 'Avg Power', 'Avg HR', '%dif HR', 'Avg CAD'].map((h) => <th key={h} className={`px-1 py-1 ${th} ${['Name', 'Avg Speed', 'Distance', '%dif HR'].includes(h) ? X : ''}`}>{h}</th>)}</tr></thead>
      <tbody className="font-bold">
        {showNow && <tr className="tab:bg-gg-zonebg">{cell(now, 'now', '', 'tab:uppercase')}</tr>}
        {[...rows].reverse().map((r) => <tr key={r.number} className={cls(r.avgPower)}>{cell(r, String(r.number), r.difHrPct === null ? '' : `${r.difHrPct >= 0 ? '+' : ''}${r.difHrPct.toFixed(1)}%`)}</tr>)}
      </tbody>
    </table></div>
  );
}
