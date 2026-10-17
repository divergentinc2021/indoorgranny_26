import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell from './Shell';
import Tile from './components/Tile';
import LapTable from './components/LapTable';
import RollingChart from './components/RollingChart';
import CountdownModal from './components/CountdownModal';
import WorkoutPanel from './components/WorkoutPanel';
import ClassBar from './components/ClassBar';
import StartDialog from './components/StartDialog';
import { useWakeLock } from './useWakeLock';
import { useRide } from '../app/ride-store';
import { useRiders } from '../app/rider-store';
import { useSettings } from '../app/settings-store';
import { useSensors } from '../app/sensor-store';
import { powerZones, hrBand } from '../engine/zones';
import { fmtClock, fmtDuration, fmtDistance, fmtSpeed } from '../app/format';
import { useWorkouts } from '../app/workout-store';
import { useClassPlans } from '../app/classplan-store';

// Vendor button look: flat, no radius. Phone (screenshots): Android grey, black bold uppercase. Tablet: cyan, green START, orange LAP.
const BTN = 'py-3 text-[28px] font-bold uppercase tab:text-[38px] tab:font-normal tab:normal-case';
const GREY = `${BTN} bg-gg-btn text-black`;
const CYAN = `${GREY} tab:bg-gg-strip tab:text-white`;
// %HR max value strip by HR band (vendor colours, tokens `hr.z1..z5`). Literal class names so Tailwind keeps them; z1 is the resting cyan.
const HR_STRIP = { z1: 'bg-hr-z1 text-white', z2: 'bg-hr-z2 text-black', z3: 'bg-hr-z3 text-black', z4: 'bg-hr-z4 text-black', z5: 'bg-hr-z5 text-black' };
const EMPTY_HIST = { hr: [] as number[], power: [] as number[], cad: [] as number[], wbal: [] as number[] };

export default function TrainingScreen() {
  const ride = useRide();
  const rider = useRiders((s) => s.current());
  const st = useSettings();
  const nav = useNavigate();
  const reconnectAll = useSensors((s) => s.reconnectAll);
  const [confirmStop, setConfirmStop] = useState(false);
  const [askSave, setAskSave] = useState(false);
  const [askStart, setAskStart] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hist, setHist] = useState(EMPTY_HIST);
  const zones = useMemo(() => powerZones(rider?.ftpW ?? 250, rider?.powerZones), [rider]);
  const workout = useWorkouts((s) => s.selected());
  const riding = ride.state === 'recording' || ride.state === 'paused';
  // During the countdown classPhase is already set while state is still idle, so class controls also gate on state.
  const classRow = ride.state === 'recording' && ride.classPhase !== 'none';
  const planTitle = useClassPlans((s) => s.selected()?.title ?? null);
  useWakeLock(riding);
  useEffect(() => { useClassPlans.getState().autoPickToday(); void useClassPlans.getState().loadBundled().then(() => useClassPlans.getState().autoPickToday()); }, []);
  useEffect(() => { void reconnectAll(); }, [reconnectAll]);
  // Leaving during the countdown must cancel it, or a ghost ride would start (and record) with the screen gone.
  useEffect(() => () => { const s = useRide.getState(); if (s.countdownLeft !== null) s.discard(); }, []);
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
  const hrStrip = HR_STRIP[hrBand(v?.pctHrMax ?? 0)];
  // The dialog stays open on failure so the ride is never lost; Retry runs the same save again.
  const doSave = async () => {
    try { await ride.save(); setSaveError(null); setAskSave(false); setHist(EMPTY_HIST); nav('/logs'); }
    catch (e) { setSaveError(e instanceof Error && e.message ? e.message : 'Could not save'); }
  };

  return (
    <Shell title="Training" back={!riding} tone="navy" fill bar={<PhoneBar name={rider?.name ?? 'Guest'} signOut={!riding} />}>
      {ride.countdownLeft !== null && <CountdownModal left={ride.countdownLeft} onSkip={() => { const m = ride.classPhase; ride.discard(); ride.begin({ skipCountdown: true, ...(m === 'warmup' || m === 'class' ? { classMode: m } : {}) }); }} />}
      {askStart && planTitle && <StartDialog title={planTitle} onWarmUp={() => { setAskStart(false); ride.begin({ classMode: 'warmup' }); }} onStartClass={() => { setAskStart(false); ride.begin({ classMode: 'class' }); }} onCancel={() => setAskStart(false)} />}
      {confirmStop && <Dialog text="STOP this session?" yes="Yes, stop" onYes={() => { setConfirmStop(false); ride.stop(); setAskSave(true); }} onNo={() => setConfirmStop(false)} />}
      {askSave && <Dialog text="Do you want to save it?" yes={saveError ? 'Retry' : 'Save'} no="Discard" error={saveError} onYes={() => void doSave()} onNo={() => { setAskSave(false); setSaveError(null); ride.discard(); setHist(EMPTY_HIST); }} />}
      {ride.storageError && <div role="alert" className="bg-white text-red-700 font-bold text-[16px] px-2 py-1">{ride.storageError}</div>}
      <div className="hidden tab:block text-[14px] text-white px-1 mb-1">Rider: {rider?.name ?? 'Guest'}</div>
      <Tile size="bare" label="Elapsed" value={fmtClock(v?.elapsedS ?? 0)} sub={`lap ${fmtDuration(v?.lapS ?? 0)}${v?.prevLapS != null ? ` · prev ${fmtDuration(v.prevLapS)}` : ''}`} />
      <div className="grid grid-cols-3">
        <Tile label="Power" value={Math.round(v?.powerSmooth ?? 0)} sub={`avg ${Math.round(v?.avgPower ?? 0)} · max ${Math.round(v?.maxPower ?? 0)}`} />
        <Tile label="HR" value={Math.round(v?.hr ?? 0)} sub={`avg ${Math.round(v?.avgHr ?? 0)} · max ${Math.round(v?.maxHr ?? 0)}`} />
        <Tile label="Cadence" value={Math.round(v?.cadenceSmooth ?? 0)} sub={`avg ${Math.round(v?.avgCad ?? 0)} · max ${Math.round(v?.maxCad ?? 0)}`} />
      </div>
      <div className="hidden tab:grid grid-cols-4">
        <Tile size="small" label="Distance" value={fmtDistance(v?.distanceM ?? 0, unit)} />
        <Tile size="small" label="HR max" value={Math.round(v?.maxHr ?? 0)} />
        <Tile size="small" label="%HR max" strip={hrStrip} value={Math.round(v?.pctHrMax ?? 0)} sub={`HRmax ${rider?.hrMax ?? 180}`} />
        <Tile size="small" label="KJ" value={(v?.kJ ?? 0).toFixed(0)} sub={`${Math.round(v?.calories ?? 0)} kcal`} />
      </div>
      <div className="hidden tab:grid grid-cols-3">
        <Tile size="small" label="%FTP" value={Math.round(v?.pctFtp ?? 0)} sub={`FTP ${rider?.ftpW ?? 250} W`} />
        <Tile size="small" label={v?.speedSource === 'virtual' ? 'Speed (est.)' : 'Speed'} value={fmtSpeed(v?.speedMs ?? 0, unit)} />
        <Tile size="small" label="W'bal" value={`${(v?.wbalPct ?? 0).toFixed(0)}%`} sub="expended" />
      </div>
      <div data-testid="charts" className="hidden tab:block mt-3 space-y-2">
        <RollingChart series={[{ label: 'HR', data: hist.hr, min: 45, max: 220, color: '#e74c3c' }, { label: 'Power', data: hist.power, min: 0, max: 550, color: '#f28c1b' }]} />
        <RollingChart series={[{ label: 'Cadence', data: hist.cad, min: 0, max: 150, color: '#3498db' }, { label: "W'bal kJ", data: hist.wbal, min: 0, max: 50, color: '#2ecc71' }]} height={90} />
      </div>
      {workout && st.structuredWorkoutEnabled && wide && v && (
        <div className="mt-3"><WorkoutPanel workout={workout} elapsedS={Math.max(0, v.elapsedS - 1)} ftpW={rider?.ftpW ?? 250} hrMax={rider?.hrMax ?? 180} pctFtp={v.pctFtp} pctHr={v.pctHrMax} /></div>
      )}
      <div className="flex-1 min-h-0 flex flex-col mt-[10px] tab:mt-3 tab:block tab:flex-none"><LapTable fill rows={ride.lapRows} now={{ number: v?.lapNumber ?? 1, durationS: v?.lapS ?? 0, distanceM: cur?.distanceM ?? 0, avgPower: cur?.avgPower ?? 0, avgHr: cur?.avgHr ?? 0, avgCad: cur?.avgCad ?? 0, avgSpeedMs: v?.speedMs ?? 0 }} zones={zones} unit={unit} showNow={ride.state !== 'stopped'} /></div>
      {/* Phone order PAUSE | STOP | LAP; tablet STOP | PAUSE | LAP. */}
      <div className="flex-shrink-0 bg-gg-bg px-[10px] py-[5px] tab:sticky tab:bottom-0 tab:mt-4 tab:px-0 tab:py-2"><div className={`grid ${classRow ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
        {ride.state === 'idle' && <button className={`col-span-3 ${GREY} tab:bg-gg-on`} onClick={() => (useClassPlans.getState().selected() ? setAskStart(true) : ride.begin())}>Start</button>}
        {ride.state === 'recording' && !classRow && <><button className={`${CYAN} tab:order-2`} onClick={() => ride.pause()}>Pause</button><button className={`${CYAN} tab:order-1`} onClick={() => setConfirmStop(true)}>Stop</button><button className={`${BTN} tab:text-[48px] bg-gg-lap text-black tab:order-3`} onClick={() => ride.lap()}>Lap</button></>}
        {classRow && <><button className={`col-span-1 ${CYAN} text-[20px] tab:text-[38px] tab:order-2`} onClick={() => ride.pause()}>Pause</button><button className={`col-span-1 ${CYAN} text-[20px] tab:text-[38px] tab:order-1`} onClick={() => setConfirmStop(true)}>Stop</button>{ride.classPhase === 'warmup' ? <button className={`col-span-2 ${BTN} text-[20px] tab:text-[38px] bg-gg-lap text-black tab:order-3`} onClick={() => ride.startClass()}>Start class</button> : ride.classStatus ? <ClassBar className="col-span-2 tab:order-3" status={ride.classStatus} onTap={() => { if (!ride.classStatus?.done) ride.lap(); }} /> : <span className="col-span-2" />}</>}
        {ride.state === 'paused' && <><button className={`${CYAN} tab:order-2`} onClick={() => ride.resume()}>Restart</button><button className={`${CYAN} tab:order-1`} onClick={() => setConfirmStop(true)}>Stop</button><span className="tab:order-3" /></>}
        {ride.state === 'stopped' && !askSave && <button className={`col-span-3 ${CYAN}`} onClick={() => setAskSave(true)}>Save or discard</button>}
      </div></div>
      {/* Phone bottom row: Distance | Wbal | %HR max | KJ (the tablet rows and the charts above are tablet only). */}
      <div className="grid grid-cols-4 flex-shrink-0 tab:hidden">
        <Tile size="compact" label={`Distance\n(${unit === 'metric' ? 'km' : 'mi'})`} value={fmtDistance(v?.distanceM ?? 0, unit).split(' ')[0]} />
        <Tile size="compact" label={'Wbal\n(%exp)'} value={(v?.wbalPct ?? 0).toFixed(0)} />
        <Tile size="compact" label={'%HR\nmax'} strip={hrStrip} value={Math.round(v?.pctHrMax ?? 0)} />
        <Tile size="compact" label="KJ" value={(v?.kJ ?? 0).toFixed(0)} />
      </div>
    </Shell>
  );
}

// Phone action bar: logo slot, rider name, SIGN OUT (hidden while riding so a ride cannot be abandoned by accident).
function PhoneBar({ name, signOut }: { name: string; signOut: boolean }) {
  return (
    <>
      <h1 className="sr-only">Training</h1>
      <img src="/icons/icon-192.png" alt="" width={48} height={48} className="flex-shrink-0 w-[48px] h-[48px]" />
      <div className="flex-1 min-w-0 truncate ml-1 text-[20px] font-bold text-white">{name}</div>
      {signOut && <Link to="/rider" className="flex-shrink-0 ml-2 text-[18px] font-bold text-white">SIGN OUT</Link>}
    </>
  );
}

function Dialog({ text, yes, no = 'No', error, onYes, onNo }: { text: string; yes: string; no?: string; error?: string | null; onYes: () => void; onNo: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed top-0 right-0 bottom-0 left-0 bg-black/80 flex items-center justify-center p-6 z-10">
      <div className="bg-white text-gg-bg border-2 border-gg-bg rounded-[15px] p-5 w-full max-w-sm space-y-4">
        <p className="text-lg">{text}</p>
        {error && <p role="alert" className="text-red-700 font-bold text-sm">Could not save — your ride is still on screen, tap Save again</p>}
        <div className="flex"><button className="flex-1 mr-2 bg-gg-strip text-white border-2 border-gg-bg rounded-[15px] py-2" onClick={onYes}>{yes}</button><button className="flex-1 bg-white text-gg-bg border-2 border-gg-bg rounded-[15px] py-2" onClick={onNo}>{no}</button></div>
      </div>
    </div>
  );
}
