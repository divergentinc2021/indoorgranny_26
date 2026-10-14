import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LogsScreen from './LogsScreen';
import { saveSession, listSessions } from '../data/sessions';
describe('LogsScreen', () => {
  it('lists sessions with vendor row fields and deletes one', async () => {
    await saveSession({ id: 1760000000000, riderId: 'r', riderName: 'Ann', sport: 'indoor_cycling', startMs: 1760000000000, durationS: 3600, distanceM: 25000, calories: 600, nSamples: 3600, avgPower: 150, maxPower: 300, avgHr: 140, maxHr: 170, avgCad: 85, uploaded: null, synced: false }, [], []);
    render(<MemoryRouter><LogsScreen /></MemoryRouter>);
    expect(await screen.findByText('Ann')).toBeInTheDocument();
    expect(screen.getByText('1:00:00')).toBeInTheDocument();
    expect(screen.getByText('25.00 km')).toBeInTheDocument();
    expect(screen.getByText(/600 kcal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(async () => expect(await listSessions()).toHaveLength(0));
  });
});
