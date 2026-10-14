import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RiderScreen from './RiderScreen';
import { useRiders } from '../app/rider-store';
import { listRiders, putRider, deleteRider, newRider } from '../data/riders';

const mount = () => render(<MemoryRouter><RiderScreen /></MemoryRouter>);

describe('RiderScreen', () => {
  beforeEach(async () => {
    for (const r of await listRiders()) await deleteRider(r.id);
    useRiders.setState({ riders: [], currentId: null });
  });

  it('adds a rider with vendor defaults and selects it', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /add rider/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ann' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ann@x.za' } });
    fireEvent.change(screen.getByLabelText(/^ftp/i), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(useRiders.getState().riders.map((r) => r.name)).toEqual(['Ann']));
    const pick = await screen.findByRole('button', { name: /^Ann/ });
    expect(pick).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pick);
    expect(useRiders.getState().current()?.ftpW).toBe(300);
    expect(useRiders.getState().current()?.hrMax).toBe(180);
    expect(screen.getByRole('button', { name: /^Ann/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('stores CP only when one was typed; blank stays undefined', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /add rider/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ann' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ann@x.za' } });
    expect(screen.getByLabelText(/^cp/i)).toHaveValue(null);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(useRiders.getState().riders).toHaveLength(1));
    expect(useRiders.getState().riders[0].cpW).toBeUndefined();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Ann' }));
    expect(screen.getByLabelText(/^cp/i)).toHaveValue(null);
    fireEvent.change(screen.getByLabelText(/^cp/i), { target: { value: '260' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(useRiders.getState().riders[0].cpW).toBe(260));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Ann' }));
    fireEvent.change(screen.getByLabelText(/^cp/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(useRiders.getState().riders[0].cpW).toBeUndefined());
  });

  it('edits a rider in place, keeping id and power zones', async () => {
    const seed = newRider({ name: 'Ann', email: 'ann@x.za', powerZones: [['Z1', 150]] });
    await putRider(seed);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Ann' }));
    expect(screen.getByLabelText(/name/i)).toBeRequired();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    fireEvent.change(screen.getByLabelText(/^ftp/i), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(useRiders.getState().riders[0]?.ftpW).toBe(400));
    const { riders } = useRiders.getState();
    expect(riders).toHaveLength(1);
    expect(riders[0].id).toBe(seed.id);
    expect(riders[0].powerZones).toEqual([['Z1', 150]]);
    expect(await screen.findByRole('button', { name: 'Edit Ann' })).toBeInTheDocument();
  });

  it('deletes the current rider and clears the selection', async () => {
    const seed = newRider({ name: 'Ann', email: 'ann@x.za' });
    await putRider(seed);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /^Ann/ }));
    expect(useRiders.getState().currentId).toBe(seed.id);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ann' }));
    await waitFor(() => expect(useRiders.getState().riders).toEqual([]));
    expect(useRiders.getState().currentId).toBeNull();
    expect(screen.queryByRole('button', { name: /Ann/ })).not.toBeInTheDocument();
  });

  it('keeps the form open and shows an alert when saving fails', async () => {
    const realSave = useRiders.getState().save;
    useRiders.setState({ save: async () => { throw new Error('disk full'); } });
    try {
      mount();
      fireEvent.click(screen.getByRole('button', { name: /add rider/i }));
      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Bo' } });
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bo@x.za' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^save$/i })); });
      expect(await screen.findByRole('alert')).toHaveTextContent('disk full');
      expect(screen.getByLabelText(/name/i)).toHaveValue('Bo');
    } finally {
      act(() => { useRiders.setState({ save: realSave }); });
    }
  });
});
