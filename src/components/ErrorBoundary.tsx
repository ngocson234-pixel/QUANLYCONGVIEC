import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--text)]">
          <div className="max-w-md w-full rounded-3xl p-6 bg-[var(--card)] border border-[var(--line)] shadow-[var(--shadow)]">
            <h1 className="text-xl font-bold mb-2">Đã xảy ra sự cố kết nối</h1>
            <p className="text-sm text-[var(--muted)] mb-4">
              Ứng dụng gặp lỗi khi đồng bộ dữ liệu. Vui lòng tải lại trang hoặc đăng xuất rồi đăng nhập lại.
            </p>
            {this.state.message && (
              <pre className="text-xs p-3 rounded-xl bg-[var(--inp)] border border-[var(--line)] overflow-auto max-h-32 mb-4 text-[var(--muted)]">
                {this.state.message}
              </pre>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-full text-sm font-semibold bg-[var(--accent)] text-[var(--onacc)] cursor-pointer"
            >
              Tải lại ứng dụng
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
