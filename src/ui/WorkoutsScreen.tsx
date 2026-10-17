import { useEffect, useRef, useState } from 'react';
import Shell from './Shell';
import { useClassPlans } from '../app/classplan-store';
import { isoDay } from '../engine/classplan';
import { fmtDuration } from '../app/format';
export default function WorkoutsScreen() {
  const cp = useClassPlans();
  const planFile = useRef<HTMLInputElement>(null); const [msg, setMsg] = useState('');
  const loadClassBundled = cp.loadBundled;
  useEffect(() => { void loadClassBundled(); }, [loadClassBundled]);
  const today = isoDay(new Date());
  return (
    <Shell title="Class plans" tone="black">
      <h2 className="p-[5px] text-[20px] font-bold text-white border-b border-white">Class plans</h2>
      <ul>
        {cp.plans.map((p) => (
          <li key={p.id} className={`p-[5px] flex items-center border-b border-white ${p.id === cp.selectedId ? 'bg-gg-strip' : ''}`}>
            <button className="flex-1 text-left" onClick={() => { if (p.id === cp.selectedId) { cp.deselect(); setMsg('No class plan selected — START runs a normal ride'); } else { cp.select(p.id); setMsg(`${p.title} selected`); } }}>
              <div className={`text-[20px] font-bold ${p.id === cp.selectedId ? 'text-white' : 'text-gg-strip'}`}>{p.title}{p.dates.includes(today) && <span className={`ml-2 align-middle rounded-full ${p.id === cp.selectedId ? 'bg-gg-bg' : 'bg-gg-strip'} px-2 text-[12px] font-bold text-white`}>today</span>}</div>
              <div className="text-[20px] text-white">{fmtDuration(p.totalS)} · {p.intervals.length} intervals</div>
            </button>
            {p.source !== 'bundled' && <button className="ml-2 text-[14px] text-white underline" onClick={() => cp.remove(p.id)}>Remove</button>}
          </li>
        ))}
      </ul>
      <input ref={planFile} type="file" accept=".seconds,.json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const r = cp.importFile(await f.text()); setMsg(r.added > 0 ? `Added ${r.added} plans` : r.skipped > 0 ? 'Already imported' : 'Not a Seconds file'); } catch { setMsg('Not a Seconds file'); } e.target.value = ''; }} />
      <button className="mt-2 mb-4 bg-gg-strip text-white text-[20px] px-4 py-2" onClick={() => planFile.current?.click()}>Import .seconds</button>
      {msg && <p className="mt-2 text-[14px] text-white" role="status">{msg}</p>}
    </Shell>
  );
}
