import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  document.body.innerHTML = `<div style="color:red;padding:20px;font-family:monospace">
    ERROR: Root element not found.
  </div>`;
  throw new Error('Root element not found. Failed to mount React.');
}

// Top-level error boundary — shows the error in the window instead of a blank screen
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{
          color: '#f87171',
          background: '#0f0f0f',
          padding: '24px',
          fontFamily: 'monospace',
          fontSize: '13px',
          lineHeight: '1.6',
          height: '100vh',
          overflow: 'auto',
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '12px' }}>
            ⚠ React Render Error
          </h2>
          <strong>{err.message}</strong>
          <pre style={{ marginTop: '12px', whiteSpace: 'pre-wrap', opacity: 0.7 }}>
            {err.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
