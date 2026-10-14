import { useMemo } from 'react';
import { Workout, workoutAt, targetWatts } from '../../engine/workout';
export default function WorkoutPanel({ workout, elapsedS, ftpW, pctFtp, pctHr }: { workout: Workout; elapsedS: number; ftpW: number; hrMax: number; pctFtp: number; pctHr: number }) {
  const at = workoutAt(workout, elapsedS);
  const total = workout.timeS.reduce((a, b) => a + b, 0);
  const maxPct = Math.max(100, ...workout.pwrS, ...workout.hrS);
  const steps = useMemo(() => { let x = 0; return workout.timeS.map((t, i) => { const s = { x, w: t, v: workout.type === 'HR' ? workout.hrS[i] : workout.pwrS[i] }; x += t; return s; }); }, [workout]);
  const live = workout.type === 'HR' ? pctHr : pctFtp;
  return (
    <section className="rounded bg-gg-panel border border-gg-line p-3">
      <div className="flex justify-between text-sm"><span className="font-heading font-semibold">{workout.title}</span><span className="tabular-nums">{at ? `${at.remainingS}s left in step ${at.step + 1}/${workout.timeS.length}` : 'workout complete'}</span></div>
      <svg viewBox={`0 0 ${total} ${maxPct}`} preserveAspectRatio="none" className="w-full h-20 mt-2" role="img" aria-label="workout profile">
        {steps.map((s, i) => <rect key={i} x={s.x} y={maxPct - s.v} width={s.w} height={s.v} fill={i === at?.step ? '#f28c1b' : '#3a3a3a'} />)}
        <line x1={Math.min(elapsedS, total)} x2={Math.min(elapsedS, total)} y1={0} y2={maxPct} stroke="#f2f2f2" strokeWidth={total / 300} />
        <circle cx={Math.min(elapsedS, total)} cy={Math.max(0, maxPct - live)} r={total / 150} fill="#2ecc71" />
      </svg>
      {at && (
        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
          <div><div className="text-[11px] text-gg-muted">TARGET W</div><div className="text-xl tabular-nums">{targetWatts(at.pctFtp, ftpW)}</div></div>
          <div><div className="text-[11px] text-gg-muted">TARGET CAD</div><div className="text-xl tabular-nums">{at.cadence}</div></div>
          <div><div className="text-[11px] text-gg-muted">TARGET %HR</div><div className="text-xl tabular-nums">{at.pctHr}</div></div>
        </div>
      )}
    </section>
  );
}
