import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Shell from './Shell';
import LapTable from './components/LapTable';
import RollingChart from './components/RollingChart';
import { getSession, getLaps, getSamples, SessionRecord } from '../data/sessions';
import type { LapRow } from '../engine/laps';
import type { Sample } from '../engine/ride';
import { powerZones } from '../engine/zones';
import { fmtDate, fmtDuration } from '../app/format';
import { useSettings } from '../app/settings-store';
export default function SessionDetail() {
  const { id } = useParams(); const unit = useSettings((s) => s.unitSystem);
  const [s, setS] = useState<SessionRecord | undefined>(); const [laps, setLaps] = useState<LapRow[]>([]); const [samples, setSamples] = useState<Sample[]>([]);
  useEffect(() => { const n = Number(id); void (async () => { setS(await getSession(n)); setLaps(await getLaps(n)); setSamples(await getSamples(n)); })(); }, [id]);
  if (!s) return <Shell title="Session">Loading…</Shell>;
  return (
    <Shell title={fmtDate(s.startMs)}>
      <p className="text-sm text-gg-muted mb-2">{s.riderName} · {fmtDuration(s.durationS)} · avg {Math.round(s.avgPower)} W · avg {Math.round(s.avgHr)} bpm · {Math.round(s.calories)} kcal</p>
      <RollingChart window={samples.length || 1} series={[{ label: 'HR', data: samples.map((x) => x.hr), min: 45, max: 220, color: '#e74c3c' }, { label: 'Power', data: samples.map((x) => x.power), min: 0, max: 550, color: '#f28c1b' }]} />
      <div className="mt-3"><LapTable rows={laps} now={{ number: laps.length + 1, durationS: 0, distanceM: 0, avgPower: 0, avgHr: 0, avgCad: 0, avgSpeedMs: 0 }} zones={powerZones(250)} unit={unit} /></div>
    </Shell>
  );
}
