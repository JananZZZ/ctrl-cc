// Ctrl-CC ErrorBoundary — 应用级崩溃防护
// Catches React render errors and saves componentStack for diagnostics
import { Component, type ReactNode } from 'react';
import i18n from '../../i18n';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; stack: string; }

export class ErrorBoundary extends Component<Props, State> {
  private lastErrorKey = '';
  private lastErrorAt = 0;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, stack: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, stack: '' };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const stack = errorInfo.componentStack || '';

    const key = `${error.message}|${stack}`;
    const now = Date.now();
    if (this.lastErrorKey === key && now - this.lastErrorAt < 3000) return;
    this.lastErrorKey = key;
    this.lastErrorAt = now;

    this.setState({ stack });

    const detail = {
      message: error.message,
      stack: error.stack,
      componentStack: stack,
      time: new Date().toISOString(),
    };

    queueMicrotask(() => {
      try {
        localStorage.setItem('ctrlcc:last-react-error', JSON.stringify(detail));
      } catch {
        // ignore
      }
    });

    console.error('[Ctrl-CC] React error boundary caught', detail);
  }

  copyError = () => {
    const text = `Error: ${this.state.error?.message}\nStack: ${this.state.error?.stack}\nComponent: ${this.state.stack}`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32, background: 'var(--cc-bg)', color: 'var(--cc-text)' }}>
          <h1 style={{ fontSize: 'var(--cc-font-2xl)', fontWeight: 700, color: 'var(--cc-red)' }}>{i18n.t('error.crashTitle')}</h1>
          <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', maxWidth: 500, textAlign: 'center' }}>
            {this.state.error?.message || i18n.t('error.unknownError')}
          </p>
          {this.state.stack && (
            <pre style={{ maxWidth: 500, maxHeight: 200, overflow: 'auto', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', background: 'var(--cc-bg-muted)', padding: 12, borderRadius: 'var(--cc-radius-sm)', whiteSpace: 'pre-wrap' }}>
              {this.state.stack.slice(0, 2000)}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={this.copyError} style={{ padding: '10px 20px', borderRadius: 'var(--cc-radius-sm)', border: '1px solid var(--cc-border)', background: 'var(--cc-surface-solid)', color: 'var(--cc-text)', cursor: 'pointer', fontSize: 'var(--cc-font-md)', fontWeight: 600 }}>
              {i18n.t('error.copyError')}
            </button>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', borderRadius: 'var(--cc-radius-sm)', border: 'none', background: 'var(--cc-brand)', color: 'var(--cc-text-on-accent)', cursor: 'pointer', fontSize: 'var(--cc-font-md)', fontWeight: 600 }}>
              {i18n.t('error.refreshApp')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
