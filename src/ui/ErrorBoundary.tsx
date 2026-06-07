import { Component, type ErrorInfo, type ReactNode } from 'react';
import { APP_VERSION } from '../lib/version.ts';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string;
}

/** Global error boundary with a copyable diagnostic block (no raw stack in UI). */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: '' };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ error, info: info.componentStack ?? '' });
  }

  private diagnostic(): string {
    const { error, info } = this.state;
    return [
      `Faturlens ${APP_VERSION}`,
      `Error: ${error?.message ?? 'unknown'}`,
      `Stack: ${error?.stack ?? 'n/a'}`,
      `Component: ${info}`,
    ].join('\n');
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ maxWidth: '40rem', margin: '3rem auto', padding: '1.5rem' }}>
        <h2>Something went wrong</h2>
        <p>Faturlens hit an unexpected error. Your data stays on this device.</p>
        <button
          type="button"
          onClick={() => {
            const clipboard = (globalThis.navigator as Navigator | undefined)?.clipboard;
            void clipboard?.writeText(this.diagnostic());
          }}
        >
          Copy diagnostics
        </button>
      </div>
    );
  }
}
