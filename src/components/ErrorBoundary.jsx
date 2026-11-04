import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[UNCAUGHT APPLICATION ERROR]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-6 text-center">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 max-w-md shadow-xl space-y-4">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-lg font-bold text-[var(--text-main)]">Something went wrong</h2>
            <p className="text-xs text-[var(--text-sec)]">
              {this.state.error?.message || 'An unexpected error occurred during rendering.'}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#635BFF] text-white text-xs font-semibold rounded-xl hover:bg-[#4942D9] transition-all cursor-pointer"
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

