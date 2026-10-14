import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Shell from './Shell';
import { listSessions, deleteSession, deleteAllSessions, getLaps, getSamples, SessionRecord } from '../data/sessions';
import { buildFit, fitFileName } from '../data/fit';
import { shareOrDownload } from './share';
import { fmtDate, fmtDuration, fmtDistance } from '../app/format';
import { useSettings } from '../app/settings-store';
export default function LogsScreen() {
  const [rows, setRows] = useState<SessionRecord[]>([]); const [open, setOpen] = useState<number | null>(null); const [confirmAll, setConfirmAll] = useState(false); const [err, setErr] = useState<{ id: number; msg: string } | null>(null);
  const unit = useSettings((s) => s.unitSystem);
  const reload = async () => setRows(await listSessions());
  useEffect(() => { void reload(); }, []);
  const share = async (s: SessionRecord) => { setErr(null); try { const bytes = buildFit(s, await getLaps(s.id), await getSamples(s.id)); await shareOrDownload(fitFileName(s), bytes, 'application/vnd.ant.fit'); } catch (e) { setErr({ id: s.id, msg: `Could not share: ${e instanceof Error ? e.message : String(e)}` }); } };
  return (
    <Shell title="Activity logs">
      <div className="flex justify-end mb-2"><button className="text-sm text-red-400" onClick={() => setConfirmAll(true)}>Delete all</button></div>
      {confirmAll && <div role="dialog" className="mb-3 rounded border border-red-700 p-3 text-sm">Delete every session on this device? <button className="ml-2 text-red-400" onClick={async () => { await deleteAllSessions(); setConfirmAll(false); await reload(); }}>Yes, delete all</button> <button className="ml-2" onClick={() => setConfirmAll(false)}>No</button></div>}
      {rows.length === 0 && <p className="text-gg-muted">No sessions yet.</p>}
      <ul className="divide-y divide-gg-line">
        {rows.map((s) => (
          <li key={s.id} className="py-3">
            <Link to={`/logs/${s.id}`} className="block">
              <div className="flex justify-between"><span>{fmtDate(s.startMs)}</span><span className="text-gg-muted text-sm">{s.uploaded ? `#${s.uploaded.remoteId}` : ''}</span></div>
              <div className="flex justify-between text-sm mt-1"><span>{s.riderName}</span><span className="tabular-nums">{fmtDuration(s.durationS)}</span><span>{fmtDistance(s.distanceM, unit)}</span><span>{Math.round(s.calories)} kcal</span></div>
            </Link>
            <button className="mt-1 text-xs text-gg-accent" aria-label={`Actions for ${fmtDate(s.startMs)}`} onClick={() => setOpen(open === s.id ? null : s.id)}>Actions</button>
            {open === s.id && (
              <div className="mt-2 flex gap-3 text-sm">
                <button className="border border-gg-line rounded px-3 py-1 text-gg-muted" disabled title="Available after the portal is connected">Upload</button>
                <button className="border border-gg-line rounded px-3 py-1" onClick={() => void share(s)}>Share as FIT</button>
                <button className="border border-red-700 text-red-400 rounded px-3 py-1" onClick={async () => { await deleteSession(s.id); setOpen(null); await reload(); }}>Delete</button>
              </div>
            )}
            {err?.id === s.id && <p role="alert" className="mt-1 text-xs text-red-400">{err.msg}</p>}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
