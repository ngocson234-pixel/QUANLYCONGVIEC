import React from 'react';
import { BellRing, CheckSquare, Cloud, Laptop, Monitor, Moon, NotebookPen, Smartphone, Sun, Wallet, X } from 'lucide-react';
import { ThemeMode } from '../types/soho';
import { useSoho } from '../context/SohoContext';
import { PWAInstallButton } from './PWAInstallButton';

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (action: 'task' | 'rem' | 'inc' | 'note') => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ open, onClose, onSelect }) => {
  if (!open) return null;

  const actions: Array<{
    key: 'task' | 'rem' | 'inc' | 'note';
    title: string;
    desc: string;
    Icon: React.FC<{ className?: string }>;
  }> = [
    { key: 'task', title: 'Công việc', desc: 'Việc cần làm theo hạn', Icon: CheckSquare },
    { key: 'rem', title: 'Nhắc việc', desc: 'Đúng ngày, đúng giờ', Icon: BellRing },
    { key: 'inc', title: 'Khoản thu', desc: 'Ghi tiền nhận được', Icon: Wallet },
    { key: 'note', title: 'Ghi chú', desc: 'Ý tưởng, caption nhanh', Icon: NotebookPen },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thêm nhanh"
        className="w-full max-w-md rounded-3xl bg-[var(--card)] border border-[var(--line)] p-5 shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold">Thêm nhanh</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-[var(--muted)] mb-4">Bạn muốn ghi lại gì ngay lúc này?</p>
        <div className="grid grid-cols-2 gap-2.5">
          {actions.map(({ key, title, desc, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className="flex flex-col items-start gap-1.5 p-4 rounded-2xl border border-[var(--line)] bg-[var(--inp)] hover:border-[var(--accent)] text-left cursor-pointer transition-colors"
            >
              <Icon className="w-5 h-5 text-[var(--accent)]" />
              <span className="font-semibold text-sm text-[var(--text)]">{title}</span>
              <span className="text-xs text-[var(--muted)]">{desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ open, onClose }) => {
  const { state, user, syncing, signInWithGoogle, signOutUser, setTheme } = useSoho();

  if (!open) return null;

  const themes: Array<{ key: ThemeMode; label: string; Icon: React.FC<{ className?: string }> }> = [
    { key: 'system', label: 'Hệ thống', Icon: Monitor },
    { key: 'light', label: 'Sáng', Icon: Sun },
    { key: 'dark', label: 'Tối', Icon: Moon },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Đồng bộ và cài đặt"
        className="w-full max-w-md rounded-3xl bg-[var(--card)] border border-[var(--line)] p-6 shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Đồng bộ & Thiết bị</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cloud sync section */}
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--inp)] p-4 mb-4">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Ảnh đại diện'}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border border-[var(--line)]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--accent-bg)] text-[var(--accent)] font-bold flex items-center justify-center">
                    {(user.displayName || user.email || 'S').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">
                    {user.displayName || 'Tài khoản SOHO'}
                  </div>
                  <div className="text-xs text-[var(--muted)] truncate">{user.email}</div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-xs">
                <span className="text-[var(--ok)] font-medium">
                  {syncing ? 'Đang đồng bộ...' : 'Đã bật đồng bộ thời gian thực'}
                </span>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="px-3 py-1.5 rounded-full border border-[var(--line)] text-[var(--muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]/40 cursor-pointer"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                <Cloud className="w-4 h-4 text-[var(--accent)]" />
                <span>Đồng bộ Web & Điện thoại</span>
              </div>
              <p className="text-xs text-[var(--muted)] mb-3 leading-relaxed">
                Đăng nhập cùng một tài khoản Google trên máy tính và điện thoại để tự động đồng bộ công việc, thu nhập, ghi chú và mindmap theo thời gian thực.
              </p>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="w-full min-h-[42px] rounded-full text-sm font-semibold bg-[var(--accent)] text-[var(--onacc)] cursor-pointer hover:opacity-95"
              >
                Đăng nhập với Google
              </button>
            </div>
          )}
        </div>

        {/* Cross-device install section */}
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--inp)] p-4 mb-4">
          <div className="flex items-center gap-2 font-semibold text-sm mb-1.5">
            <Smartphone className="w-4 h-4 text-[var(--accent)]" />
            <span>Dùng như app trên điện thoại</span>
          </div>
          <p className="text-xs text-[var(--muted)] leading-relaxed mb-3">
            Mở liên kết này trên trình duyệt điện thoại (Safari trên iPhone hoặc Chrome trên Android), sau đó chọn cài đặt lên màn hình chính để mở toàn màn hình và dùng cả khi ngoại tuyến.
          </p>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-2">
            <Laptop className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate font-mono-num">{window.location.origin}</span>
          </div>
          <PWAInstallButton />
        </div>

        {/* Theme switcher */}
        <div>
          <div className="text-xs font-semibold text-[var(--muted)] mb-2">Giao diện hiển thị</div>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--well)]">
            {themes.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => void setTheme(key)}
                className={`flex items-center justify-center gap-1.5 min-h-[38px] rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  state.theme === key
                    ? 'bg-[var(--card)] text-[var(--text)] shadow-xs font-semibold'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const MergeConflictModal: React.FC = () => {
  const { pendingMergePrompt, resolveMergeKeepCloud, resolveMergeUploadLocal } = useSoho();
  if (!pendingMergePrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl bg-[var(--card)] border border-[var(--line)] p-6 shadow-[var(--shadow-lg)]"
      >
        <h3 className="text-lg font-bold mb-2">Đồng bộ dữ liệu thiết bị</h3>
        <p className="text-sm text-[var(--muted)] mb-5 leading-relaxed">
          Tài khoản của bạn đã có dữ liệu trên đám mây, đồng thời thiết bị này cũng có dữ liệu ngoại tuyến chưa đồng bộ. Bạn muốn xử lý thế nào?
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={resolveMergeKeepCloud}
            className="w-full min-h-[44px] rounded-full text-sm font-semibold bg-[var(--accent)] text-[var(--onacc)] cursor-pointer"
          >
            Dùng dữ liệu đang có trên đám mây
          </button>
          <button
            type="button"
            onClick={() => void resolveMergeUploadLocal()}
            className="w-full min-h-[44px] rounded-full text-sm font-medium border border-[var(--line)] bg-[var(--inp)] text-[var(--text)] hover:bg-[var(--hover)] cursor-pointer"
          >
            Gộp dữ liệu từ máy này lên đám mây
          </button>
        </div>
      </div>
    </div>
  );
};
