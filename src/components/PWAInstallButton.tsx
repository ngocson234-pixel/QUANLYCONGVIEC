import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--accent)] text-[var(--onacc)] whitespace-nowrap shrink-0 cursor-pointer transition-opacity hover:opacity-90'
            : 'w-full flex items-center justify-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--accent-bg)] text-[var(--accent)] whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:opacity-90'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{compact ? 'Cài app' : 'Cài đặt lên thiết bị'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            compact
              ? 'inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--line)] bg-[var(--card)] text-[var(--text)] whitespace-nowrap shrink-0 cursor-pointer'
              : 'w-full flex items-center justify-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium border border-[var(--line)] bg-[var(--card)] text-[var(--text)] whitespace-nowrap shrink-0 cursor-pointer hover:bg-[var(--hover)]'
          }
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>{compact ? 'Cài iOS' : 'Cài lên màn hình chính'}</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIOSGuide(false);
            }}
          >
            <div className="w-full max-w-sm rounded-3xl bg-[var(--card)] border border-[var(--line)] p-6 shadow-[var(--shadow-lg)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold">Cài SOHO trên iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Đóng hướng dẫn"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-[var(--muted)] mb-4">
                Mở trang này bằng trình duyệt <strong>Safari</strong>, sau đó làm theo 2 bước:
              </p>
              <ol className="space-y-3 text-sm mb-5">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--accent-bg)] text-[var(--accent)] font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Chạm vào biểu tượng <Share className="inline w-4 h-4 mx-0.5 text-[var(--accent)]" />{' '}
                    <strong>Chia sẻ</strong> trên thanh công cụ Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--accent-bg)] text-[var(--accent)] font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Cuộn xuống và chọn <PlusSquare className="inline w-4 h-4 mx-0.5 text-[var(--accent)]" />{' '}
                    <strong>Thêm vào MH chính</strong> (Add to Home Screen).
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-full text-sm font-semibold bg-[var(--accent)] text-[var(--onacc)] cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
