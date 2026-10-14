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
      <div className="flex justify-end mb-2"><button className="text-sm font-bold text-red-700" onClick={() => setConfirmAll(true)}>Delete all</button></div>
      {confirmAll && <div role="dialog" className="mb-3 rounded-[15px] border-2 border-red-700 p-3 text-sm">Delete every session on this device? <button className="ml-2 font-bold text-red-700" onClick={async () => { await deleteAllSessions(); setConfirmAll(false); await reload(); }}>Yes, delete all</button> <button className="ml-2" onClick={() => setConfirmAll(false)}>No</button></div>}
      {rows.length === 0 && <p>No sessions yet.</p>}
      <ul>
        {rows.map((s) => (
          <li key={s.id} className="mb-2">
            <Link to={`/logs/${s.id}`} className="flex items-center bg-gg-strip text-white p-[5px]">
              <img src="/img/bike.png" alt="" width={48} height={48} className="flex-shrink-0 mr-[5px]" />
              <div className="flex-1 min-w-0">
              <div className="flex justify-between"><span>{fmtDate(s.startMs)}</span><span className="text-sm">{s.uploaded ? `#${s.uploaded.remoteId}` : ''}</span></div>
              <div className="flex justify-between text-sm mt-1"><span>{s.riderName}</span><span className="tabular-nums">{fmtDuration(s.durationS)}</span><span>{fmtDistance(s.distanceM, unit)}</span><span>{Math.round(s.calories)} kcal</span></div>
              </div>
            </Link>
            <button className="mt-1 text-xs font-bold text-gg-bg" aria-label={`Actions for ${fmtDate(s.startMs)}`} onClick={() => setOpen(open === s.id ? null : s.id)}>Actions</button>
            {open === s.id && (
              <div className="mt-2 flex text-sm">
                <button className="mr-2 border-2 border-gg-bg rounded-[15px] px-3 py-1 opacity-50" disabled title="Available after the portal is connected">Upload</button>
                <button className="mr-2 border-2 border-gg-bg rounded-[15px] px-3 py-1 bg-gg-strip text-white" onClick={() => void share(s)}>Share as FIT</button>
                <button className="border-2 border-red-700 text-red-700 rounded-[15px] px-3 py-1" onClick={async () => { await deleteSession(s.id); setOpen(null); await reload(); }}>Delete</button>
              </div>
            )}
            {err?.id === s.id && <p role="alert" className="mt-1 text-xs font-bold text-red-700">{err.msg}</p>}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
