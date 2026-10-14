import { useEffect, useRef, useState } from 'react';
import Shell from './Shell';
import { useWorkouts } from '../app/workout-store';
import { fmtDuration } from '../app/format';
export default function WorkoutsScreen() {
  const { workouts, selectedId, select, add, remove, loadBundled } = useWorkouts();
  const file = useRef<HTMLInputElement>(null); const [msg, setMsg] = useState('');
  useEffect(() => { void loadBundled(); }, [loadBundled]);
  return (
    <Shell title="Structured workouts" tone="black">
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
      <input ref={file} type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setMsg(add(JSON.parse(await f.text())) ? 'Workout imported' : 'Not a valid workout file'); } catch { setMsg('Not a valid workout file'); } e.target.value = ''; }} />
      <button className="mt-4 bg-gg-strip text-white text-[20px] px-4 py-2" onClick={() => file.current?.click()}>Import JSON</button>
      {msg && <p className="mt-2 text-[14px] text-white" role="status">{msg}</p>}
    </Shell>
  );
}
