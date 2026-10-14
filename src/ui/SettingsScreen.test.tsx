import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsScreen from './SettingsScreen';
import { useSettings } from '../app/settings-store';
describe('SettingsScreen', () => {
  it('exposes the vendor keys and writes them to the store', () => {
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/unit system/i), { target: { value: 'imperial' } });
    fireEvent.change(screen.getByLabelText(/countdown/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/smoothing/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/wheel/i), { target: { value: '2096' } });
    fireEvent.click(screen.getByLabelText(/structured workout/i));
    expect(useSettings.getState()).toMatchObject({ unitSystem: 'imperial', countdownS: 5, smoothingN: 10, wheelMm: 2096, structuredWorkoutEnabled: true });
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
});
