import { useEffect, useRef, useState } from 'react';
import Shell from './Shell';
import { useWorkouts } from '../app/workout-store';
import { useClassPlans } from '../app/classplan-store';
import { isoDay } from '../engine/classplan';
import { fmtDuration } from '../app/format';
export default function WorkoutsScreen() {
  const { workouts, selectedId, select, add, remove, loadBundled } = useWorkouts();
  const cp = useClassPlans();
  const file = useRef<HTMLInputElement>(null); const planFile = useRef<HTMLInputElement>(null); const [msg, setMsg] = useState('');
  const loadClassBundled = cp.loadBundled;
  useEffect(() => { void loadBundled(); }, [loadBundled]);
  useEffect(() => { void loadClassBundled(); }, [loadClassBundled]);
  const today = isoDay(new Date());
  return (
    <Shell title="Structured workouts" tone="black">
      <input ref={file} type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setMsg(add(JSON.parse(await f.text())) ? 'Workout imported' : 'Not a valid workout file'); } catch { setMsg('Not a valid workout file'); } e.target.value = ''; }} />
      <h2 className="p-[5px] text-[20px] font-bold text-white border-b border-white">Class plans</h2>
      <ul>
        {cp.plans.map((p) => (
          <li key={p.id} className={`p-[5px] flex items-center border-b border-white ${p.id === cp.selectedId ? 'bg-gg-strip' : ''}`}>
            <button className="flex-1 text-left" onClick={() => { if (p.id === cp.selectedId) { cp.deselect(); setMsg('No class plan selected — START runs a normal ride'); } else { cp.select(p.id); setMsg(`${p.title} selected`); } }}>
              <div className={`text-[20px] font-bold ${p.id === cp.selectedId ? 'text-white' : 'text-gg-strip'}`}>{p.title}{p.dates.includes(today) && <span className="ml-2 align-middle rounded-full bg-gg-strip px-2 text-[12px] font-bold text-white">today</span>}</div>
              <div className="text-[20px] text-white">{fmtDuration(p.totalS)} · {p.intervals.length} intervals</div>
            </button>
            {p.source !== 'bundled' && <button className="ml-2 text-[14px] text-white underline" onClick={() => cp.remove(p.id)}>Remove</button>}
          </li>
        ))}
      </ul>
      <input ref={planFile} type="file" accept=".seconds,.json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const r = cp.importFile(await f.text()); setMsg(r.added > 0 ? `Added ${r.added} plans` : r.skipped > 0 ? 'Already imported' : 'Not a Seconds file'); } catch { setMsg('Not a Seconds file'); } e.target.value = ''; }} />
      <button className="mt-2 mb-4 bg-gg-strip text-white text-[20px] px-4 py-2" onClick={() => planFile.current?.click()}>Import .seconds</button>
      <h2 className="p-[5px] text-[20px] font-bold text-white border-b border-white">Structured workouts</h2>
      <ul>
        {workouts.map((w) => (
          <li key={w.id} className={`p-[5px] flex items-center border-b border-white ${w.id === selectedId ? 'bg-gg-strip' : ''}`}>
            <button className="flex-1 text-left" onClick={() => { select(w.id); setMsg(`${w.title} selected`); }}>
              <div className={`text-[20px] font-bold ${w.id === selectedId ? 'text-white' : 'text-gg-strip'}`}>{w.title}</div><div className="grid grid-cols-3 text-[20px] text-white"><span>{fmtDuration(w.totalduration)}</span><span>{w.type}</span><span>{w.wdate}</span></div>
            </button>
            <button className="ml-2 text-[14px] text-white underline" onClick={() => remove(w.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <button className="mt-4 bg-gg-strip text-white text-[20px] px-4 py-2" onClick={() => file.current?.click()}>Import JSON</button>
      {msg && <p className="mt-2 text-[14px] text-white" role="status">{msg}</p>}
    </Shell>
  );
}
