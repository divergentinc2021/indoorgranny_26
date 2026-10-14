import { useEffect, useState } from 'react';
import Shell from './Shell';
import { useRiders } from '../app/rider-store';
import { newRider, Rider } from '../data/riders';
const num = (v: string, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
export default function RiderScreen() {
  const { riders, currentId, load, save, remove, select } = useRiders();
  const [edit, setEdit] = useState<Partial<Rider> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void load(); }, [load]);
  const field = (id: keyof Rider, label: string, type = 'text', required = false) => (
    <label className="block text-sm" htmlFor={`f-${id}`}>{label}
      <input id={`f-${id}`} type={type} required={required} className="mt-1 w-full rounded bg-gg-bg border border-gg-line px-2 py-1" value={String(edit?.[id] ?? '')} onChange={(e) => setEdit({ ...edit, [id]: e.target.value })} />
    </label>
  );
  return (
    <Shell title="Rider">
      {edit ? (
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { const r = newRider({ ...(edit as any), name: String(edit.name ?? ''), email: String(edit.email ?? ''), weightKg: num(String(edit.weightKg ?? ''), 70), ftpW: num(String(edit.ftpW ?? ''), 250), cpW: edit.cpW ? num(String(edit.cpW), 250) : undefined, wprimeKj: num(String(edit.wprimeKj ?? ''), 20), hrMax: num(String(edit.hrMax ?? ''), 180) }); await save(r); setError(null); setEdit(null); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save rider'); } }}>
          {field('name', 'Name', 'text', true)}{field('email', 'Email', 'email', true)}{field('weightKg', 'Weight (kg)', 'number')}{field('ftpW', 'FTP (W)', 'number')}{field('cpW', 'CP (W, blank = FTP)', 'number')}{field('wprimeKj', "W' (kJ)", 'number')}{field('hrMax', 'HR max (bpm)', 'number')}
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2"><button className="bg-gg-accent text-black font-semibold rounded px-4 py-2" type="submit">Save</button><button type="button" className="border border-gg-line rounded px-4 py-2" onClick={() => { setError(null); setEdit(null); }}>Cancel</button></div>
        </form>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-gg-line">
            {riders.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <button className={`text-left ${r.id === currentId ? 'text-gg-accent' : ''}`} aria-pressed={r.id === currentId} onClick={() => select(r.id)}>{r.name} <span className="text-gg-muted text-xs">FTP {r.ftpW} W · {r.weightKg} kg</span></button>
                <span className="flex gap-3 text-sm"><button aria-label={`Edit ${r.name}`} onClick={() => setEdit(r)}>Edit</button><button aria-label={`Delete ${r.name}`} className="text-red-400" onClick={() => void remove(r.id)}>Delete</button></span>
              </li>
            ))}
          </ul>
          <button className="bg-gg-accent text-black font-semibold rounded px-4 py-2" onClick={() => setEdit({})}>Add rider</button>
        </div>
      )}
    </Shell>
  );
}
