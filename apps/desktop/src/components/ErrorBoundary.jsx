import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    window.location.reload();
  };

  handleReport = () => {
    const error = this.state.error;
    const body = [
      `**Error:** ${error?.message || 'Unknown error'}`,
      ``,
      `**Stack:**`,
      '```',
      error?.stack || 'No stack trace',
      '```',
    ].join('\n');
    const url = `https://github.com/Aljayz/nexube/issues/new?title=${encodeURIComponent('Bug Report: ' + (error?.message || 'Unknown error'))}&body=${encodeURIComponent(body)}`;
    window.electron?.shell?.openExternal?.(url);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full px-xl text-center">
          <AlertTriangle className="w-12 h-12 text-warning mb-md" />
          <h2 className="text-lg font-bold text-text-primary mb-sm">Something went wrong</h2>
          <p className="text-sm text-text-muted mb-lg max-w-sm">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <div className="flex gap-md">
            <button onClick={this.handleRetry} className="btn-primary">
              Try Again
            </button>
            <button onClick={this.handleReport} className="btn-secondary">
              Report
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
