import { Component } from 'react';
import BrandMark from './BrandMark';

export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error, info) { console.error('Workspace render failed', error, info); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="fatal-state" id="main-content">
      <BrandMark className="brand-mark" />
      <p className="eyebrow">Welina clinical workspace</p>
      <h1>We couldn’t open this workspace.</h1>
      <p>Reload the page to try again. Your saved demo records stay on this device.</p>
      <button type="button" className="button button--primary" onClick={() => window.location.reload()}>Reload workspace</button>
    </main>;
  }
}
