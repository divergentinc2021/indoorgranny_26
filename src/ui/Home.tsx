import { Link } from 'react-router-dom';
import { useSettings } from '../app/settings-store';
import { useRiders } from '../app/rider-store';
import TermsDialog from './TermsDialog';
const TILES: [string, string][] = [['TRAINING', '/training'], ['ACTIVITY LOGS', '/logs'], ['SETTINGS', '/settings'], ['STRUCTURED WORKOUTS', '/workouts'], ['SENSORS', '/sensors']];
export default function Home() {
  const accepted = useSettings((s) => s.licenseAccepted);
  const set = useSettings((s) => s.set);
  const rider = useRiders((s) => s.current());
  return (
    <>
      {!accepted && <TermsDialog onAccept={() => set({ licenseAccepted: true })} />}
      <div inert={!accepted} className="min-h-full flex flex-col bg-white">
        <header className="relative bg-gg-bg px-4 py-3 text-white"><h1 className="text-center text-[20px]">Granny Gear</h1><Link to="/rider" className="absolute right-0 top-0 bottom-0 flex items-center px-3 max-w-[35%] truncate text-sm text-gg-strip">{rider ? rider.name : 'Choose rider'}</Link></header>
        <nav className="flex-1 flex flex-col p-[10px]">
          {TILES.map(([label, to]) => <Link key={to} to={to} className="flex-1 flex items-center justify-center m-[10px] min-h-[56px] bg-gg-strip text-[25px] text-white text-center">{label}</Link>)}
        </nav>
        <footer className="bg-gg-bg px-4 py-3 text-center text-[14px] text-white">indoorgranny_26 · phase 1</footer>
      </div>
    </>
  );
}
