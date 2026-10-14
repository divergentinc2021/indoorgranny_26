import { useEffect, useRef, useState } from 'react';
import Shell from './Shell';
import { useWorkouts } from '../app/workout-store';
import { fmtDuration } from '../app/format';
export default function WorkoutsScreen() {
  const { workouts, selectedId, select, add, remove, loadBundled } = useWorkouts();
  const file = useRef<HTMLInputElement>(null); const [msg, setMsg] = useState('');
  useEffect(() => { void loadBundled(); }, [loadBundled]);
  return (
    <Shell title="Structured workouts">
      <ul className="divide-y divide-gg-line">
        {workouts.map((w) => (
          <li key={w.id} className="py-2 flex items-center justify-between">
            <button className={`text-left ${w.id === selectedId ? 'text-gg-accent' : ''}`} onClick={() => { select(w.id); setMsg(`${w.title} selected`); }}>
              <div>{w.title}</div><div className="text-xs text-gg-muted">{w.wdate} · {fmtDuration(w.totalduration)} · {w.type}</div>
            </button>
            <button className="text-xs text-red-400" onClick={() => remove(w.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <input ref={file} type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setMsg(add(JSON.parse(await f.text())) ? 'Workout imported' : 'Not a valid workout file'); } catch { setMsg('Not a valid workout file'); } e.target.value = ''; }} />
      <button className="mt-4 bg-gg-accent text-black font-semibold rounded px-4 py-2" onClick={() => file.current?.click()}>Import JSON</button>
      {msg && <p className="mt-2 text-sm text-gg-muted" role="status">{msg}</p>}
    </Shell>
  );
}
