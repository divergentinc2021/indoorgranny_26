import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Shell from './Shell';
import { listSessions, deleteSession, deleteAllSessions, getLaps, getSamples, SessionRecord } from '../data/sessions';
import { buildFit, fitFileName } from '../data/fit';
import { shareOrDownload } from './share';
import { fmtDate, fmtDuration, fmtDistance } from '../app/format';
import { useSettings } from '../app/settings-store';
export default function LogsScreen() {
  const [rows, setRows] = useState<SessionRecord[]>([]); const [open, setOpen] = useState<number | null>(null); const [confirmAll, setConfirmAll] = useState(false); const [err, setErr] = useState<{ id: number; msg: string } | null>(null); const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const unit = useSettings((s) => s.unitSystem);
  const reload = async () => setRows(await listSessions());
  useEffect(() => { void reload(); }, []);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 6000); return () => clearTimeout(t); }, [notice]);
  const share = async (s: SessionRecord) => { setErr(null); setNotice(null); try { const name = fitFileName(s); const bytes = buildFit(s, await getLaps(s.id), await getSamples(s.id)); const how = await shareOrDownload(name, bytes, 'application/vnd.ant.fit'); if (how === 'downloaded') setNotice({ id: s.id, text: `Saved to Downloads as ${name}. Open it from Wahoo, Garmin Connect or strava.com/upload.` }); } catch (e) { setErr({ id: s.id, msg: `Could not share: ${e instanceof Error ? e.message : String(e)}` }); } };
  return (
    <Shell title="Activity logs">
      <div className="flex justify-end mb-2"><button className="text-sm font-bold text-red-700" onClick={() => setConfirmAll(true)}>Delete all</button></div>
      {confirmAll && <div role="dialog" className="mb-3 rounded-[15px] border-2 border-red-700 p-3 text-sm">Delete every session on this device? <button className="ml-2 font-bold text-red-700" onClick={async () => { await deleteAllSessions(); setConfirmAll(false); await reload(); }}>Yes, delete all</button> <button className="ml-2" onClick={() => setConfirmAll(false)}>No</button></div>}
      {rows.length === 0 && <p>No sessions yet.</p>}
      <ul>
        {rows.map((s) => (
          <li key={s.id} className="mb-2">
            <div className="flex items-stretch bg-gg-strip text-white">
            <Link to={`/logs/${s.id}`} className="flex-1 min-w-0 flex items-center p-[5px]">
              <img src="/img/bike.png" alt="" width={48} height={48} className="flex-shrink-0 mr-[5px]" />
              <div className="flex-1 min-w-0">
              <div className="flex justify-between"><span>{fmtDate(s.startMs)}</span><span className="text-sm">{s.uploaded ? `#${s.uploaded.remoteId}` : ''}</span></div>
              <div className="flex justify-between text-sm mt-1"><span>{s.riderName}</span><span className="tabular-nums">{fmtDuration(s.durationS)}</span><span>{fmtDistance(s.distanceM, unit)}</span><span>{Math.round(s.calories)} kcal</span></div>
              </div>
            </Link>
            <button className="flex-shrink-0 px-3 font-bold text-sm border-l-2 border-white" onClick={() => void share(s)}>Download FIT</button>
            </div>
            <button className="mt-1 text-xs font-bold text-gg-bg" aria-label={`Actions for ${fmtDate(s.startMs)}`} onClick={() => setOpen(open === s.id ? null : s.id)}>Actions</button>
            {open === s.id && (
              <div className="mt-2 flex text-sm">
                <button className="mr-2 border-2 border-gg-bg rounded-[15px] px-3 py-1 opacity-50" disabled title="Available after the portal is connected">Upload</button>
                <button className="border-2 border-red-700 text-red-700 rounded-[15px] px-3 py-1" onClick={async () => { await deleteSession(s.id); setOpen(null); await reload(); }}>Delete</button>
              </div>
            )}
            {notice?.id === s.id && <p role="status" className="mt-1 text-xs font-bold text-gg-bg">{notice.text}</p>}
            {err?.id === s.id && <p role="alert" className="mt-1 text-xs font-bold text-red-700">{err.msg}</p>}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
