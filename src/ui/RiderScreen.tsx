import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Shell from './Shell';
import { useRiders } from '../app/rider-store';
import { newRider, Rider } from '../data/riders';
const num = (v: string, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
// CP is only stored when the user typed a usable number; blank means "follow FTP" (the engine falls back).
const cpTyped = (v: unknown) => { const n = Number(v); return v !== undefined && v !== '' && Number.isFinite(n) && n > 0 ? n : undefined; };
export default function RiderScreen() {
  const { riders, currentId, load, save, remove, select } = useRiders();
  const [edit, setEdit] = useState<Partial<Rider> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void load(); }, [load]);
  const field = (id: keyof Rider, label: string, type = 'text', required = false) => (
    <label className="block text-sm text-white" htmlFor={`f-${id}`}>{label}
      <input id={`f-${id}`} type={type} required={required} className="mt-1 w-full bg-white text-black border border-gg-summary px-3 py-1" value={String(edit?.[id] ?? '')} onChange={(e) => setEdit({ ...edit, [id]: e.target.value })} />
    </label>
  );
  return (
    <Shell title="Rider" tone="cyan" bar={false} bare>
      {/* Vendor login look: logo slot (also the way home) + welcome line, then the content on solid cyan. */}
      <div className="flex items-center p-[10px] tab:hidden">
        <Link to="/" aria-label="Home" className="flex-shrink-0"><img src="/icons/icon-192.png" alt="" width={48} height={48} className="w-[48px] h-[48px]" /></Link>
        <h1 className="ml-2 text-[26px] leading-tight text-white">WELCOME TO GRANNY GEAR</h1>
      </div>
      <div className="p-[10px]">
      {edit ? (
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { const r = newRider({ ...(edit as any), name: String(edit.name ?? ''), email: String(edit.email ?? ''), weightKg: num(String(edit.weightKg ?? ''), 70), ftpW: num(String(edit.ftpW ?? ''), 250), cpW: cpTyped(edit.cpW), wprimeKj: num(String(edit.wprimeKj ?? ''), 20), hrMax: num(String(edit.hrMax ?? ''), 180) }); await save(r); setError(null); setEdit(null); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save rider'); } }}>
          {field('name', 'Name', 'text', true)}{field('email', 'Email', 'email', true)}{field('weightKg', 'Weight (kg)', 'number')}{field('ftpW', 'FTP (W)', 'number')}{field('cpW', 'CP (W, blank = FTP)', 'number')}{field('wprimeKj', "W' (kJ)", 'number')}{field('hrMax', 'HR max (bpm)', 'number')}
          {error && <p role="alert" className="bg-white text-red-700 font-bold text-sm px-2 py-1">{error}</p>}
          <div className="flex"><button className="bg-gg-btn text-black text-[20px] px-4 py-2 mr-2" type="submit">Save</button><button type="button" className="bg-gg-btn text-black text-[20px] px-4 py-2" onClick={() => { setError(null); setEdit(null); }}>Cancel</button></div>
        </form>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-2">
            {riders.map((r) => (
              <li key={r.id} className="flex items-center bg-white text-black p-[5px]">
                <button className={`flex-1 text-left px-3 py-2 ${r.id === currentId ? 'bg-gg-on text-black' : 'bg-gg-btn text-black'}`} aria-pressed={r.id === currentId} onClick={() => select(r.id)}>{r.name} <span className="text-xs">FTP {r.ftpW} W · {r.weightKg} kg</span></button>
                <span className="flex text-sm ml-2"><button aria-label={`Edit ${r.name}`} className="px-2 text-gg-bg font-bold" onClick={() => setEdit(r)}>Edit</button><button aria-label={`Delete ${r.name}`} className="px-2 text-red-700 font-bold" onClick={() => void remove(r.id)}>Delete</button></span>
              </li>
            ))}
          </ul>
          <button className="bg-gg-btn text-black text-[20px] px-4 py-2" onClick={() => setEdit({})}>Add rider</button>
        </div>
      )}
      </div>
    </Shell>
  );
}
