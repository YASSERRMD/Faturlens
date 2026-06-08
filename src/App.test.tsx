import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';
import { DeviceProfileProvider } from './capability/useDeviceProfile.tsx';

function renderApp() {
  return render(
    <DeviceProfileProvider>
      <App />
    </DeviceProfileProvider>,
  );
}

describe('App', () => {
  it('renders the product name', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Faturlens' })).toBeInTheDocument();
  });

  it('renders the privacy tagline', () => {
    renderApp();
    expect(screen.getByText(/no data leaves your machine/i)).toBeInTheDocument();
  });
});
