import { Routes, Route } from 'react-router-dom';
import Home from './ui/Home';
import RiderScreen from './ui/RiderScreen';
import SensorsScreen from './ui/SensorsScreen';
import TrainingScreen from './ui/TrainingScreen';
import LogsScreen from './ui/LogsScreen';
import SessionDetail from './ui/SessionDetail';
import WorkoutsScreen from './ui/WorkoutsScreen';
import SettingsScreen from './ui/SettingsScreen';
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/rider" element={<RiderScreen />} />
      <Route path="/sensors" element={<SensorsScreen />} />
      <Route path="/training" element={<TrainingScreen />} />
      <Route path="/logs" element={<LogsScreen />} />
      <Route path="/logs/:id" element={<SessionDetail />} />
      <Route path="/workouts" element={<WorkoutsScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
    </Routes>
  );
}
