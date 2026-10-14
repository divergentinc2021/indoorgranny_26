import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { useSettings } from '../app/settings-store';
describe('Home', () => {
  it('shows the five vendor tiles and gates on terms', () => {
    useSettings.getState().set({ licenseAccepted: false });
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /terms of service and privacy/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    for (const t of ['TRAINING', 'ACTIVITY LOGS', 'SETTINGS', 'STRUCTURED WORKOUTS', 'SENSORS']) expect(screen.getByRole('link', { name: t })).toBeInTheDocument();
    expect(useSettings.getState().licenseAccepted).toBe(true);
  });

  it('names the terms dialog, focuses Accept and inerts the page behind it until accepted', () => {
    useSettings.getState().set({ licenseAccepted: false });
    render(<MemoryRouter><Home /></MemoryRouter>);
    const dialog = screen.getByRole('dialog', { name: /terms of service and privacy/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const accept = screen.getByRole('button', { name: /accept/i });
    expect(accept).toHaveFocus();
    const tile = screen.getByRole('link', { name: 'TRAINING', hidden: true });
    expect(tile.closest('[inert]')).not.toBeNull();
    expect(dialog.closest('[inert]')).toBeNull();
    fireEvent.click(accept);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TRAINING' }).closest('[inert]')).toBeNull();
  });
});

describe('Home terms dialog (phone parity)', () => {
  it('Decline closes the dialog but keeps the app gated; Review terms reopens it', () => {
    useSettings.getState().set({ licenseAccepted: false });
    render(<MemoryRouter><Home /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useSettings.getState().licenseAccepted).toBe(false);
    expect(screen.getByRole('link', { name: 'TRAINING', hidden: true }).closest('[inert]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /review terms/i }));
    expect(screen.getByRole('dialog', { name: /terms of service and privacy/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(screen.queryByRole('button', { name: /review terms/i })).not.toBeInTheDocument();
    expect(screen.getByText('improve your performance')).toBeInTheDocument();
  });
});

describe('Home decline gate (Chrome 81 has no `inert`)', () => {
  it('after Decline a full-screen overlay swallows taps and reopens the dialog; the gated page is aria-hidden', () => {
    useSettings.getState().set({ licenseAccepted: false });
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.queryByTestId('terms-gate')).not.toBeInTheDocument();     // dialog open: the dialog itself blocks
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    const gate = screen.getByTestId('terms-gate');
    expect(gate).toHaveClass('fixed', 'top-0', 'right-0', 'bottom-0', 'left-0');
    const tile = screen.getByRole('link', { name: 'TRAINING', hidden: true });
    expect(tile.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(tile.closest('[inert]')).not.toBeNull();
    fireEvent.click(gate);
    expect(screen.getByRole('dialog', { name: /terms of service and privacy/i })).toBeInTheDocument();
    expect(screen.queryByTestId('terms-gate')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(screen.queryByTestId('terms-gate')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TRAINING' }).closest('[aria-hidden="true"]')).toBeNull();
  });
});
