import { useState } from 'react';
import type { ReactNode } from 'react';
import Shell from './Shell';
import { useSettings } from '../app/settings-store';
import { useRiders } from '../app/rider-store';
import pkg from '../../package.json';

// Vendor preference list (docs/reference/vendor-screenshots/06-settings.jpg): dark page, teal category header, white bold
// titles over grey summaries, 40 px indent, controls right-aligned.
const ROW = 'flex items-center py-[14px] pl-[40px] pr-[16px]';
const TITLE = 'block text-[20px] font-bold leading-tight text-white';
const SUMMARY = 'block text-[18px] font-bold leading-tight text-gg-summary';
const CTRL = 'ml-3 flex-shrink-0 bg-gg-pref text-white border border-gg-summary px-2 py-1 text-[18px]';

const LB_PER_KG = 1 / 0.45359237;
const KG_PER_LB = 0.45359237;
type RiderField = 'weightKg' | 'ftpW' | 'wprimeKj';
const FIELDS: Record<RiderField, { title: string; unit: string; label: string }> = {
  weightKg: { title: 'Weight', unit: 'kg', label: 'Weight (kg)' },
  ftpW: { title: 'FTP', unit: 'W', label: 'FTP (W)' },
  wprimeKj: { title: 'W Prime', unit: 'kJ', label: "W' (kJ)" },
};

export default function SettingsScreen() {
  const s = useSettings();
  const rider = useRiders((st) => st.current());
  const saveRider = useRiders((st) => st.save);
  const [wheelDraft, setWheelDraft] = useState(String(s.wheelMm));
  const [editing, setEditing] = useState<RiderField | null>(null);
  const [draft, setDraft] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const imperial = s.unitSystem === 'imperial';
  const wheelOk = (v: string) => { const n = Number(v); return v.trim() !== '' && Number.isFinite(n) && n >= 1500 && n <= 4000; };
  const sel = (id: string, label: string, title: string, summary: string, value: string | number, opts: [string | number, string][], on: (v: string) => void) => (
    <div className={ROW}>
      <div className="flex-1 min-w-0"><span className={TITLE}>{title}</span><span className={SUMMARY}>{summary}</span></div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <select id={id} className={CTRL} value={String(value)} onChange={(e) => on(e.target.value)}>{opts.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}</select>
    </div>
  );
  const summaryOf = (f: RiderField): string => {
    if (!rider) return 'choose a rider first';
    if (f === 'weightKg') return imperial ? `weight equal to ${(rider.weightKg * LB_PER_KG).toFixed(1)} lb` : `weight equal to ${rider.weightKg.toFixed(1)} kg`;
    if (f === 'ftpW') return `Functional Threshold Power: ${rider.ftpW}Watts`;
    return `WP: ${rider.wprimeKj}KJ`;
  };
  const commit = async (f: RiderField) => {
    const n = Number(draft);
    if (!rider || !Number.isFinite(n) || n <= 0) return;
    // CP is left alone: a rider with no explicit CP follows FTP inside the engine.
    // Weight is stored in kg whatever unit is shown; the field is typed in lb when the unit system is imperial.
    const stored = f === 'weightKg' && imperial ? Math.round(n * KG_PER_LB * 100) / 100 : n;
    try { await saveRider({ ...rider, [f]: stored }); setSaveError(null); setEditing(null); }
    catch (e) { setSaveError(e instanceof Error && e.message ? e.message : 'Could not save'); }
  };
  const riderRow = (f: RiderField): ReactNode => {
    const { title } = FIELDS[f];
    const label = f === 'weightKg' && imperial ? 'Weight (lb)' : FIELDS[f].label;
    const open = editing === f && !!rider;
    return (
      <div>
        <button type="button" className={`${ROW} w-full text-left disabled:opacity-60`} disabled={!rider} aria-expanded={open} onClick={() => { setDraft(rider ? (f === 'weightKg' && imperial ? (rider.weightKg * LB_PER_KG).toFixed(1) : String(rider[f])) : ''); setSaveError(null); setEditing(open ? null : f); }}>
          <span className="flex-1 min-w-0"><span className={TITLE}>{title}</span><span className={SUMMARY}>{summaryOf(f)}</span></span>
        </button>
        {open && (
          <form className="flex items-center pl-[40px] pr-[16px] pb-[14px]" onSubmit={(e) => { e.preventDefault(); void commit(f); }}>
            <input aria-label={label} type="number" inputMode="decimal" step="any" min={0} autoFocus className="flex-1 min-w-0 bg-white text-black text-[24px] px-2 py-1" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button type="submit" className="ml-2 bg-gg-btn text-black font-bold text-[20px] px-4 py-2">OK</button>
            <button type="button" className="ml-2 bg-gg-btn text-black text-[20px] px-4 py-2" onClick={() => { setSaveError(null); setEditing(null); }}>Cancel</button>
          </form>
        )}
        {open && saveError && <p role="alert" className="mx-[40px] mb-[14px] bg-white text-red-700 font-bold text-[16px] px-2 py-1">Could not save: {saveError}</p>}
      </div>
    );
  };
  const countdown = s.countdownS < 3600 ? `${s.countdownS}s` : `${s.countdownS / 3600} h`;
  return (
    <Shell title="Settings" tone="pref" bare>
      <div className="pb-6">
        <h2 className="pt-[24px] pb-[10px] pl-[40px] text-[18px] font-bold text-gg-cat">Personal Settings</h2>
        <label className={ROW}>
          <span className="flex-1 min-w-0"><span className={TITLE}>Automatic sync</span><span className={SUMMARY}>Automatically save your activities on Strava</span></span>
          <input type="checkbox" className="ml-3 flex-shrink-0 w-6 h-6" disabled aria-label="Automatic sync (available in a later phase)" checked={false} readOnly />
        </label>
        {sel('unit', 'Unit system', 'Choose your units', s.unitSystem, s.unitSystem, [['metric', 'Metric'], ['imperial', 'Imperial']], (v) => s.set({ unitSystem: v as 'metric' | 'imperial' }))}
        {riderRow('weightKg')}
        {riderRow('ftpW')}
        {riderRow('wprimeKj')}
        {sel('countdown', 'Countdown before start', 'Countdown Timer', `delay before start: ${countdown}`, s.countdownS, [[0, 'None'], [5, '5 seconds'], [3600, '1 hour'], [7200, '2 hours'], [10800, '3 hours']], (v) => s.set({ countdownS: Number(v) as 0 | 5 | 3600 | 7200 | 10800 }))}
        {sel('smoothing', 'Power smoothing', 'Smoothing Power', s.smoothingN === 1 ? 'off' : `average over ${s.smoothingN} s`, s.smoothingN, [[1, 'Off'], [5, '5 s'], [10, '10 s'], [30, '30 s']], (v) => s.set({ smoothingN: Number(v) as 1 | 5 | 10 | 30 }))}
        <label className={ROW} htmlFor="wheel">
          <span className="flex-1 min-w-0"><span className={TITLE}>Wheel circumference (mm)</span><span className={SUMMARY}>1500–4000 mm</span></span>
          <input id="wheel" type="number" inputMode="numeric" min={1500} max={4000} className={`${CTRL} w-[110px] bg-white text-black`} value={wheelDraft} onChange={(e) => { const v = e.target.value; setWheelDraft(v); if (wheelOk(v)) s.set({ wheelMm: Number(v) }); }} onBlur={() => { if (!wheelOk(wheelDraft)) setWheelDraft(String(s.wheelMm)); }} />
        </label>
        <label className={ROW}>
          <span className="flex-1 min-w-0"><span className={TITLE}>Structured workout panel</span><span className={SUMMARY}>show the workout while riding (tablets)</span></span>
          <input type="checkbox" className="ml-3 flex-shrink-0 w-6 h-6" checked={s.structuredWorkoutEnabled} onChange={(e) => s.set({ structuredWorkoutEnabled: e.target.checked })} />
        </label>
        <div className={ROW}>
          <div className="flex-1 min-w-0"><span className={TITLE}>App version</span><span className={SUMMARY}>{pkg.version} · recording interval 1 s</span></div>
        </div>
      </div>
    </Shell>
  );
}
