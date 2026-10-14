import { fmtDuration } from '../../app/format';
export default function CountdownModal({ left, onSkip }: { left: number; onSkip: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/80 flex items-center justify-center z-10" onClick={onSkip}>
      <div className="text-center"><div className="text-6xl font-heading font-bold tabular-nums">{left < 60 ? left : fmtDuration(left)}</div><div className="text-gg-muted mt-2">tap to start now</div></div>
    </div>
  );
}
