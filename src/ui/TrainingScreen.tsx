import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from './Shell';
import Tile from './components/Tile';
import LapTable, { ZONE_BG } from './components/LapTable';
import RollingChart from './components/RollingChart';
import CountdownModal from './components/CountdownModal';
import WorkoutPanel from './components/WorkoutPanel';
import { useWakeLock } from './useWakeLock';
import { useRide } from '../app/ride-store';
import { useRiders } from '../app/rider-store';
import { useSettings } from '../app/settings-store';
import { useSensors } from '../app/sensor-store';
import { powerZones, zoneIndex, hrBand } from '../engine/zones';
import { fmtDuration, fmtDistance, fmtSpeed } from '../app/format';
import { useWorkouts } from '../app/workout-store';

const HR_BG: Record<string, string> = { z1: 'bg-sky-900/40', z2: 'bg-green-900/40', z3: 'bg-yellow-900/40', z4: 'bg-orange-900/40', z5: 'bg-red-900/50' };
const EMPTY_HIST = { hr: [] as number[], power: [] as number[], cad: [] as number[], wbal: [] as number[] };

export default function TrainingScreen() {
  const ride = useRide();
  const rider = useRiders((s) => s.current());
  const st = useSettings();
  const nav = useNavigate();
  const reconnectAll = useSensors((s) => s.reconnectAll);
  const [confirmStop, setConfirmStop] = useState(false);
  const [askSave, setAskSave] = useState(false);
  const [hist, setHist] = useState(EMPTY_HIST);
  const zones = useMemo(() => powerZones(rider?.ftpW ?? 250, rider?.powerZones), [rider]);
  const workout = useWorkouts((s) => s.selected());
  const riding = ride.state === 'recording' || ride.state === 'paused';
  useWakeLock(riding);
  useEffect(() => { void reconnectAll(); }, [reconnectAll]);
  useEffect(() => {
    if (!riding) return;
    const onPop = () => { history.pushState(null, '', location.href); alert('Stop the activity first.'); };
    history.pushState(null, '', location.href); window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [riding]);
  const v = ride.view;
  useEffect(() => {
    if (!v || ride.state !== 'recording') return;
    setHist((h) => ({ hr: [...h.hr, v.hr].slice(-800), power: [...h.power, v.powerSmooth].slice(-800), cad: [...h.cad, v.cadenceSmooth].slice(-800), wbal: [...h.wbal, v.wbalRemainingJ / 1000].slice(-800) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v?.elapsedS]);
  const unit = st.unitSystem;
  const wide = typeof window !== 'undefined' && window.innerWidth >= 600;
  const cur = ride.engine?.laps.current;

  return (
    <Shell title="Training" back={!riding}>
      {ride.countdownLeft !== null && <CountdownModal left={ride.countdownLeft} onSkip={() => { ride.discard(); ride.begin({ skipCountdown: true }); }} />}
      {confirmStop && <Dialog text="STOP this session?" yes="Yes, stop" onYes={() => { setConfirmStop(false); ride.stop(); setAskSave(true); }} onNo={() => setConfirmStop(false)} />}
      {askSave && <Dialog text="Do you want to save it?" yes="Save" no="Discard" onYes={async () => { setAskSave(false); await ride.save(); setHist(EMPTY_HIST); nav('/logs'); }} onNo={() => { setAskSave(false); ride.discard(); setHist(EMPTY_HIST); }} />}
      <div className="text-sm text-gg-muted mb-2">Rider: {rider?.name ?? 'Guest'}</div>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Elapsed" value={fmtDuration(v?.elapsedS ?? 0)} sub={`lap ${fmtDuration(v?.lapS ?? 0)}${v?.prevLapS != null ? ` · prev ${fmtDuration(v.prevLapS)}` : ''}`} />
        <Tile label="Power" value={Math.round(v?.powerSmooth ?? 0)} sub={`avg ${Math.round(v?.avgPower ?? 0)} · max ${Math.round(v?.maxPower ?? 0)}`} cls={ZONE_BG[zones[zoneIndex(zones, v?.powerSmooth ?? 0)].cls] ?? ''} />
        <Tile label="Heart rate" value={Math.round(v?.hr ?? 0)} sub={`avg ${Math.round(v?.avgHr ?? 0)} · max ${Math.round(v?.maxHr ?? 0)}`} cls={HR_BG[hrBand(v?.pctHrMax ?? 0)]} />
        <Tile label="Cadence" value={Math.round(v?.cadenceSmooth ?? 0)} sub={`avg ${Math.round(v?.avgCad ?? 0)} · max ${Math.round(v?.maxCad ?? 0)}`} />
        <Tile label="%FTP" value={Math.round(v?.pctFtp ?? 0)} sub={`FTP ${rider?.ftpW ?? 250} W`} />
        <Tile label="%HRmax" value={Math.round(v?.pctHrMax ?? 0)} sub={`HRmax ${rider?.hrMax ?? 180}`} />
        <Tile label="Speed" value={fmtSpeed(v?.speedMs ?? 0, unit)} />
        <Tile label="Distance" value={fmtDistance(v?.distanceM ?? 0, unit)} />
        <Tile label="W'bal" value={`${(v?.wbalPct ?? 0).toFixed(0)}%`} sub="expended" />
        <Tile label="kJ" value={(v?.kJ ?? 0).toFixed(0)} sub={`${Math.round(v?.calories ?? 0)} kcal`} />
      </div>
      <div className="mt-3 space-y-2">
        <RollingChart series={[{ label: 'HR', data: hist.hr, min: 45, max: 220, color: '#e74c3c' }, { label: 'Power', data: hist.power, min: 0, max: 550, color: '#f28c1b' }]} />
        <RollingChart series={[{ label: 'Cadence', data: hist.cad, min: 0, max: 150, color: '#3498db' }, { label: "W'bal kJ", data: hist.wbal, min: 0, max: 50, color: '#2ecc71' }]} height={90} />
      </div>
      {workout && st.structuredWorkoutEnabled && wide && v && (
        <div className="mt-3"><WorkoutPanel workout={workout} elapsedS={Math.max(0, v.elapsedS - 1)} ftpW={rider?.ftpW ?? 250} hrMax={rider?.hrMax ?? 180} pctFtp={v.pctFtp} pctHr={v.pctHrMax} /></div>
      )}
      <div className="mt-3"><LapTable rows={ride.lapRows} now={{ number: v?.lapNumber ?? 1, durationS: v?.lapS ?? 0, distanceM: cur?.distanceM ?? 0, avgPower: cur?.avgPower ?? 0, avgHr: cur?.avgHr ?? 0, avgCad: cur?.avgCad ?? 0, avgSpeedMs: v?.speedMs ?? 0 }} zones={zones} unit={unit} /></div>
      <div className="sticky bottom-0 mt-4 grid grid-cols-3 gap-2 bg-gg-bg py-2">
        {ride.state === 'idle' && <button className="col-span-3 bg-gg-accent text-black font-semibold rounded py-3" onClick={() => ride.begin()}>Start</button>}
        {ride.state === 'recording' && <><button className="border border-gg-line rounded py-3" onClick={() => ride.pause()}>Pause</button><button className="bg-gg-accent text-black font-semibold rounded py-3" onClick={() => ride.lap()}>Lap</button><button className="bg-red-700 rounded py-3" onClick={() => setConfirmStop(true)}>Stop</button></>}
        {ride.state === 'paused' && <><button className="bg-gg-accent text-black font-semibold rounded py-3" onClick={() => ride.resume()}>Restart</button><span /><button className="bg-red-700 rounded py-3" onClick={() => setConfirmStop(true)}>Stop</button></>}
        {ride.state === 'stopped' && !askSave && <button className="col-span-3 border border-gg-line rounded py-3" onClick={() => setAskSave(true)}>Save or discard</button>}
      </div>
    </Shell>
  );
}

function Dialog({ text, yes, no = 'No', onYes, onNo }: { text: string; yes: string; no?: string; onYes: () => void; onNo: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-10">
      <div className="bg-gg-panel border border-gg-line rounded p-5 w-full max-w-sm space-y-4">
        <p className="text-lg">{text}</p>
        <div className="flex gap-2"><button className="flex-1 bg-gg-accent text-black font-semibold rounded py-2" onClick={onYes}>{yes}</button><button className="flex-1 border border-gg-line rounded py-2" onClick={onNo}>{no}</button></div>
      </div>
    </div>
  );
}
