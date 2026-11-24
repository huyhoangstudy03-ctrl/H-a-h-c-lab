import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message || 'Đã xảy ra lỗi không mong muốn.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl my-12 rounded-xl border border-rose-200 bg-rose-50 p-6 text-slate-900">
          <h2 className="text-lg font-semibold text-rose-800">Đã xảy ra sự cố hiển thị</h2>
          <p className="mt-2 text-sm text-slate-700">{this.state.errorMessage}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Tải lại ứng dụng
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
