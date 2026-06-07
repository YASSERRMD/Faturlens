import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../lib/version.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { Footer } from './Footer.tsx';

describe('Footer', () => {
  it('shows version, model id, and prompt versions', () => {
    render(<Footer />);
    expect(screen.getByText(new RegExp(`v${APP_VERSION}`))).toBeInTheDocument();
    expect(screen.getByText(/LFM2\.5-VL-1\.6B-ONNX/)).toBeInTheDocument();
    expect(screen.getByText(/PASS1_PROMPT_V1/)).toBeInTheDocument();
  });
});

function Boom(): React.JSX.Element {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  it('renders a fallback with a copy-diagnostics action on error', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy diagnostics/i })).toBeInTheDocument();
  });
});
