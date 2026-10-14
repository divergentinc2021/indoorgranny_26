import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../app/settings-store';
import { useRiders } from '../app/rider-store';
import TermsDialog from './TermsDialog';
const TILES: [string, string][] = [['TRAINING', '/training'], ['ACTIVITY LOGS', '/logs'], ['SETTINGS', '/settings'], ['STRUCTURED WORKOUTS', '/workouts'], ['SENSORS', '/sensors']];
export default function Home() {
  const accepted = useSettings((s) => s.licenseAccepted);
  const set = useSettings((s) => s.set);
  const rider = useRiders((s) => s.current());
  // Decline closes the dialog but the app stays gated; "Review terms" in the top strip opens it again.
  const [open, setOpen] = useState(true);
  const showTerms = !accepted && open;
  return (
    <>
      {showTerms && <TermsDialog onAccept={() => set({ licenseAccepted: true })} onDecline={() => setOpen(false)} />}
      <div className="min-h-full flex flex-col bg-white">
        <header className="relative bg-gg-bg px-4 py-3 text-white">
          {!accepted && <button inert={showTerms} className="absolute left-0 top-0 bottom-0 flex items-center px-3 max-w-[30%] truncate text-sm text-gg-strip" onClick={() => setOpen(true)}>Review terms</button>}
          <h1 className="text-center text-[20px]">Granny Gear</h1>
          <span inert={!accepted}><Link to="/rider" className="absolute right-0 top-0 bottom-0 flex items-center px-3 max-w-[30%] truncate text-sm text-gg-strip">{rider ? rider.name : 'Choose rider'}</Link></span>
        </header>
        <div inert={!accepted} className="flex-1 flex flex-col">
          <nav className="flex-1 flex flex-col p-[10px]">
            {TILES.map(([label, to]) => <Link key={to} to={to} className="flex-1 flex items-center justify-center m-[10px] min-h-[56px] bg-gg-strip text-[25px] text-white text-center">{label}</Link>)}
          </nav>
          <footer className="bg-gg-bg px-4 py-3 text-center text-[20px] text-white">improve your performance</footer>
        </div>
      </div>
    </>
  );
}
