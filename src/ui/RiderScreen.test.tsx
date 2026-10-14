import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RiderScreen from './RiderScreen';
import { useRiders } from '../app/rider-store';
describe('RiderScreen', () => {
  it('adds a rider with vendor defaults and selects it', async () => {
    render(<MemoryRouter><RiderScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /add rider/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ann' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ann@x.za' } });
    fireEvent.change(screen.getByLabelText(/^ftp/i), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(useRiders.getState().riders.map((r) => r.name)).toEqual(['Ann']));
    fireEvent.click(await screen.findByRole('button', { name: /Ann/ }));
    expect(useRiders.getState().current()?.ftpW).toBe(300);
    expect(useRiders.getState().current()?.hrMax).toBe(180);
  });
});
