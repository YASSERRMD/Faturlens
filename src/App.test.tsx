import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';

describe('App', () => {
  it('renders the product name', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Faturlens' })).toBeInTheDocument();
  });

  it('renders the privacy tagline', () => {
    render(<App />);
    expect(screen.getByText(/no data leaves your machine/i)).toBeInTheDocument();
  });
});
