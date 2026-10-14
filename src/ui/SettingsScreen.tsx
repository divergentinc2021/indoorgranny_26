import { useState } from 'react';
import Shell from './Shell';
import { useSettings } from '../app/settings-store';
import pkg from '../../package.json';
export default function SettingsScreen() {
  const s = useSettings();
  const [wheelDraft, setWheelDraft] = useState(String(s.wheelMm));
  const wheelOk = (v: string) => { const n = Number(v); return v.trim() !== '' && Number.isFinite(n) && n >= 1500 && n <= 4000; };
  const sel = (id: string, label: string, value: string | number, opts: [string | number, string][], on: (v: string) => void) => (
    <label className="block text-sm" htmlFor={id}>{label}<select id={id} className="mt-1 w-full bg-white text-black border border-gg-bg px-2 py-1" value={String(value)} onChange={(e) => on(e.target.value)}>{opts.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}</select></label>
  );
  return (
    <Shell title="Settings">
      <div className="space-y-4">
        {sel('unit', 'Unit system', s.unitSystem, [['metric', 'Metric'], ['imperial', 'Imperial']], (v) => s.set({ unitSystem: v as 'metric' | 'imperial' }))}
        {sel('countdown', 'Countdown before start', s.countdownS, [[0, 'None'], [5, '5 seconds'], [3600, '1 hour'], [7200, '2 hours'], [10800, '3 hours']], (v) => s.set({ countdownS: Number(v) as 0 | 5 | 3600 | 7200 | 10800 }))}
        {sel('smoothing', 'Power smoothing', s.smoothingN, [[1, 'Off'], [5, '5 s'], [10, '10 s'], [30, '30 s']], (v) => s.set({ smoothingN: Number(v) as 1 | 5 | 10 | 30 }))}
        <label className="block text-sm" htmlFor="wheel">Wheel circumference (mm)<input id="wheel" type="number" inputMode="numeric" min={1500} max={4000} className="mt-1 w-full bg-white text-black border border-gg-bg px-2 py-1" value={wheelDraft} onChange={(e) => { const v = e.target.value; setWheelDraft(v); if (wheelOk(v)) s.set({ wheelMm: Number(v) }); }} onBlur={() => { if (!wheelOk(wheelDraft)) setWheelDraft(String(s.wheelMm)); }} /><span className="block text-xs mt-1">1500–4000 mm</span></label>
        <label className="flex items-center text-sm"><input type="checkbox" className="mr-2" checked={s.structuredWorkoutEnabled} onChange={(e) => s.set({ structuredWorkoutEnabled: e.target.checked })} />Structured workout panel (tablets)</label>
        <p className="text-sm">Recording interval: 1 s · App version {pkg.version}</p>
      </div>
    </Shell>
  );
}
