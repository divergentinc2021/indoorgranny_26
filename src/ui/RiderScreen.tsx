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
      <input id={`f-${id}`} type={type} required={required} className="mt-1 w-full rounded-[15px] bg-white text-black border-2 border-gg-bg px-3 py-1" value={String(edit?.[id] ?? '')} onChange={(e) => setEdit({ ...edit, [id]: e.target.value })} />
    </label>
  );
  return (
    <Shell title="Rider">
      {edit ? (
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { const r = newRider({ ...(edit as any), name: String(edit.name ?? ''), email: String(edit.email ?? ''), weightKg: num(String(edit.weightKg ?? ''), 70), ftpW: num(String(edit.ftpW ?? ''), 250), cpW: edit.cpW ? num(String(edit.cpW), 250) : undefined, wprimeKj: num(String(edit.wprimeKj ?? ''), 20), hrMax: num(String(edit.hrMax ?? ''), 180) }); await save(r); setError(null); setEdit(null); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save rider'); } }}>
          {field('name', 'Name', 'text', true)}{field('email', 'Email', 'email', true)}{field('weightKg', 'Weight (kg)', 'number')}{field('ftpW', 'FTP (W)', 'number')}{field('cpW', 'CP (W, blank = FTP)', 'number')}{field('wprimeKj', "W' (kJ)", 'number')}{field('hrMax', 'HR max (bpm)', 'number')}
          {error && <p role="alert" className="text-red-700 font-bold text-sm">{error}</p>}
          <div className="flex"><button className="bg-gg-strip text-white border-2 border-gg-bg rounded-[15px] px-4 py-2 mr-2" type="submit">Save</button><button type="button" className="bg-white text-gg-bg border-2 border-gg-bg rounded-[15px] px-4 py-2" onClick={() => { setError(null); setEdit(null); }}>Cancel</button></div>
        </form>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-2">
            {riders.map((r) => (
              <li key={r.id} className="flex items-center bg-white border-2 border-gg-bg rounded-[15px] p-[5px]">
                <button className={`flex-1 text-left border-2 border-gg-bg rounded-[15px] px-3 py-2 ${r.id === currentId ? 'bg-gg-on text-black' : 'bg-gg-strip text-white'}`} aria-pressed={r.id === currentId} onClick={() => select(r.id)}>{r.name} <span className="text-xs">FTP {r.ftpW} W · {r.weightKg} kg</span></button>
                <span className="flex text-sm ml-2"><button aria-label={`Edit ${r.name}`} className="px-2 text-gg-bg font-bold" onClick={() => setEdit(r)}>Edit</button><button aria-label={`Delete ${r.name}`} className="px-2 text-red-700 font-bold" onClick={() => void remove(r.id)}>Delete</button></span>
              </li>
            ))}
          </ul>
          <button className="bg-gg-strip text-white border-2 border-gg-bg rounded-[15px] px-4 py-2" onClick={() => setEdit({})}>Add rider</button>
        </div>
      )}
    </Shell>
  );
}
