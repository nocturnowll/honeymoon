import { Component, type ErrorInfo, type ReactNode } from 'react';
import { navigate } from '../lib/router';

interface Props { children: ReactNode; label?: string }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[larch-canyon] ${this.props.label ?? 'route'} failed`, error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <section className="card pad error-state" role="alert">
      <div className="eyebrow">Something went wrong</div>
      <h2>{this.props.label ?? 'This screen'} could not load</h2>
      <p className="hint">{this.state.error.message || 'Unknown error'}</p>
      <button className="btn" onClick={() => { this.setState({ error: null }); navigate('#/now'); }}>Back to Now</button>
    </section>;
  }
}
