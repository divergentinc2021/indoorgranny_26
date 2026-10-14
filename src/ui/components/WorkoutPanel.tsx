import { useMemo } from 'react';
import { Workout, workoutAt, targetWatts } from '../../engine/workout';
import { THEME } from '../theme';
export default function WorkoutPanel({ workout, elapsedS, ftpW, pctFtp, pctHr }: { workout: Workout; elapsedS: number; ftpW: number; hrMax: number; pctFtp: number; pctHr: number }) {
  const at = workoutAt(workout, elapsedS);
  const total = workout.timeS.reduce((a, b) => a + b, 0);
  const maxPct = Math.max(100, ...workout.pwrS, ...workout.hrS);
  const steps = useMemo(() => { let x = 0; return workout.timeS.map((t, i) => { const s = { x, w: t, v: workout.type === 'HR' ? workout.hrS[i] : workout.pwrS[i] }; x += t; return s; }); }, [workout]);
  const live = workout.type === 'HR' ? pctHr : pctFtp;
  return (
    <section className="bg-black p-[5px] text-zone-z4 text-[20px]">
      <div className="flex justify-between"><span className="font-bold">{workout.title}</span><span className="tabular-nums">{at ? `${at.remainingS}s left in step ${at.step + 1}/${workout.timeS.length}` : 'workout complete'}</span></div>
      <svg viewBox={`0 0 ${total} ${maxPct}`} preserveAspectRatio="none" className="w-full h-20 mt-2" role="img" aria-label="workout profile">
        {steps.map((s, i) => <rect key={i} x={s.x} y={maxPct - s.v} width={s.w} height={s.v} fill={i === at?.step ? THEME.strip : '#555555'} />)}
        <line x1={Math.min(elapsedS, total)} x2={Math.min(elapsedS, total)} y1={0} y2={maxPct} stroke={THEME.paper} strokeWidth={total / 300} />
        <circle cx={Math.min(elapsedS, total)} cy={Math.max(0, maxPct - live)} r={total / 150} fill={THEME.on} />
      </svg>
      {at && (
        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
          <div><div className="text-[14px]">TARGET W</div><div className="text-[20px] tabular-nums">{targetWatts(at.pctFtp, ftpW)}</div></div>
          <div><div className="text-[14px]">TARGET CAD</div><div className="text-[20px] tabular-nums">{at.cadence}</div></div>
          <div><div className="text-[14px]">TARGET %HR</div><div className="text-[20px] tabular-nums">{at.pctHr}</div></div>
        </div>
      )}
    </section>
  );
}
