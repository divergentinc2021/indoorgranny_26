import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsScreen from './SettingsScreen';
import { useSettings } from '../app/settings-store';
import { useRiders } from '../app/rider-store';
import { newRider, type Rider } from '../data/riders';
describe('SettingsScreen', () => {
  beforeEach(() => { useSettings.getState().set({ unitSystem: 'metric' }); });
  it('exposes the vendor keys and writes them to the store', () => {
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/unit system/i), { target: { value: 'imperial' } });
    fireEvent.change(screen.getByLabelText(/countdown/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/smoothing/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/wheel/i), { target: { value: '2096' } });
    expect(screen.queryByLabelText(/structured workout/i)).toBeNull();
    expect(useSettings.getState()).toMatchObject({ unitSystem: 'imperial', countdownS: 5, smoothingN: 10, wheelMm: 2096 });
    expect(screen.getByText(/0\.1\.0/)).toBeInTheDocument();
  });
  it('lets the wheel circumference be typed and edited digit by digit', () => {
    useSettings.getState().set({ wheelMm: 2105 });
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    const input = screen.getByLabelText(/wheel/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2' } });
    expect(input.value).toBe('2'); expect(useSettings.getState().wheelMm).toBe(2105);
    fireEvent.change(input, { target: { value: '20' } });
    expect(input.value).toBe('20'); expect(useSettings.getState().wheelMm).toBe(2105);
    fireEvent.change(input, { target: { value: '2096' } });
    expect(input.value).toBe('2096'); expect(useSettings.getState().wheelMm).toBe(2096);
    fireEvent.change(input, { target: { value: '209' } }); // backspace keeps the draft
    expect(input.value).toBe('209'); expect(useSettings.getState().wheelMm).toBe(2096);
    fireEvent.blur(input); // out of range -> restored to the stored value
    expect(input.value).toBe('2096');
    expect(screen.getByText('1500–4000 mm')).toBeInTheDocument();
  });
  it('shows the vendor titles; rider rows are disabled until a rider is chosen', () => {
    useRiders.setState({ riders: [], currentId: null });
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    for (const t of ['Personal Settings', 'Automatic sync', 'Choose your units', 'Weight', 'FTP', 'W Prime', 'Countdown Timer', 'Smoothing Power']) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getAllByText('choose a rider first')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /^Weight/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /automatic sync/i })).toBeDisabled();
  });
  it('editing FTP leaves a blank CP blank, so the engine follows the new FTP', async () => {
    const rider = newRider({ name: 'Ann', email: 'a@x.za', weightKg: 85, ftpW: 250, wprimeKj: 20 });
    const save = vi.fn(async () => {});
    useRiders.setState({ riders: [rider], currentId: rider.id, save });
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^FTP/ }));
    fireEvent.change(screen.getByLabelText('FTP (W)'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const saved = (save.mock.calls[0] as unknown as [Rider])[0];
    expect(saved.ftpW).toBe(300);
    expect(saved.cpW).toBeUndefined();
  });
  it('an explicit CP is not moved by an FTP edit either', async () => {
    const rider = newRider({ name: 'Ann', email: 'a@x.za', ftpW: 250, cpW: 250 });
    const save = vi.fn(async () => {});
    useRiders.setState({ riders: [rider], currentId: rider.id, save });
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^FTP/ }));
    fireEvent.change(screen.getByLabelText('FTP (W)'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect((save.mock.calls[0] as unknown as [Rider])[0]).toMatchObject({ ftpW: 300, cpW: 250 });
  });
  it('edits the current rider weight inline and saves it through the rider store', async () => {
    const rider = newRider({ name: 'Ann', email: 'a@x.za', weightKg: 85, ftpW: 227, wprimeKj: 20 });
    const save = vi.fn(async () => {});
    useRiders.setState({ riders: [rider], currentId: rider.id, save });
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    expect(screen.getByText('weight equal to 85.0 kg')).toBeInTheDocument();
    expect(screen.getByText('Functional Threshold Power: 227Watts')).toBeInTheDocument();
    expect(screen.getByText('WP: 20KJ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Weight/ }));
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '82.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ ...rider, weightKg: 82.5 }));
  });
});

describe('SettingsScreen weight units and save errors', () => {
  beforeEach(() => { useSettings.getState().set({ unitSystem: 'metric' }); });
  afterEach(() => { useSettings.getState().set({ unitSystem: 'metric' }); });
  it('imperial: shows pounds and converts a typed value back to kg (storage stays kg)', async () => {
    const rider = newRider({ name: 'Ann', email: 'a@x.za', weightKg: 85, ftpW: 227, wprimeKj: 20 });
    const save = vi.fn(async () => {});
    useRiders.setState({ riders: [rider], currentId: rider.id, save });
    useSettings.getState().set({ unitSystem: 'imperial' });
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    expect(screen.getByText('weight equal to 187.4 lb')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Weight/ }));
    expect(screen.getByLabelText('Weight (lb)')).toHaveValue(187.4);
    fireEvent.change(screen.getByLabelText('Weight (lb)'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect((save.mock.calls[0] as unknown as [Rider])[0].weightKg).toBeCloseTo(90.72, 2);
  });
  it('metric: kg shown and stored as typed', async () => {
    const rider = newRider({ name: 'Ann', email: 'a@x.za', weightKg: 85 });
    const save = vi.fn(async () => {});
    useRiders.setState({ riders: [rider], currentId: rider.id, save });
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    expect(screen.getByText('weight equal to 85.0 kg')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Weight/ }));
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect((save.mock.calls[0] as unknown as [Rider])[0].weightKg).toBe(90);
  });
  it('a rejected save shows an alert and keeps the editor open', async () => {
    const rider = newRider({ name: 'Ann', email: 'a@x.za', weightKg: 85 });
    useRiders.setState({ riders: [rider], currentId: rider.id, save: async () => { throw new Error('disk full'); } });
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^Weight/ }));
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('disk full');
    expect(screen.getByLabelText('Weight (kg)')).toBeInTheDocument();
  });
});

describe('SettingsScreen class alerts', () => {
  it('has a Class alerts select that writes classAlerts and shows the chosen label', () => {
    useSettings.getState().set({ classAlerts: 'both' });
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    expect(screen.getByText('Class alerts')).toBeInTheDocument();
    expect(screen.getAllByText('Vibrate and beep')).toHaveLength(2);   // summary + option
    const select = screen.getByLabelText(/class alerts/i) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['Vibrate and beep', 'Vibrate', 'Beep', 'Off']);
    fireEvent.change(select, { target: { value: 'beep' } });
    expect(useSettings.getState().classAlerts).toBe('beep');
    expect(screen.getAllByText('Beep')).toHaveLength(2); expect(screen.getAllByText('Vibrate and beep')).toHaveLength(1);
  });
});
