import { fmtDuration } from '../../app/format';
export default function CountdownModal({ left, onSkip }: { left: number; onSkip: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed top-0 right-0 bottom-0 left-0 bg-gg-bg flex items-center justify-center z-10" onClick={onSkip}>
      <div className="text-center"><div className="text-[120px] leading-none text-white tabular-nums">{left < 60 ? left : fmtDuration(left)}</div><div className="text-white text-[20px] mt-4">tap to start now</div></div>
    </div>
  );
}
