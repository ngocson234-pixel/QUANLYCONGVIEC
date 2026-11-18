import React from 'react';
import {
  Bell,
  CheckSquare,
  Cloud,
  LayoutGrid,
  Network,
  NotebookText,
  Plus,
  Wallet,
} from 'lucide-react';
import { ViewKey } from '../types/soho';
import { useSoho } from '../context/SohoContext';
import { today } from '../lib/dateUtils';
import { PWAInstallButton } from './PWAInstallButton';

interface NavigationProps {
  activeView: ViewKey;
  onNavigate: (v: ViewKey) => void;
  onQuickAdd: () => void;
  onOpenAccount: () => void;
}

const NAV_ITEMS: Array<{
  key: ViewKey;
  label: string;
  mobileLabel: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { key: 'dashboard', label: 'Dashboard', mobileLabel: 'Tổng quan', Icon: LayoutGrid },
  { key: 'cong-viec', label: 'Công việc', mobileLabel: 'Việc', Icon: CheckSquare },
  { key: 'thu-nhap', label: 'Thu nhập', mobileLabel: 'Thu nhập', Icon: Wallet },
  { key: 'nhac-viec', label: 'Nhắc việc', mobileLabel: 'Nhắc', Icon: Bell },
  { key: 'ghi-chu', label: 'Ghi chú nhanh', mobileLabel: 'Ghi chú', Icon: NotebookText },
  { key: 'mindmap', label: 'Mindmap', mobileLabel: 'Sơ đồ', Icon: Network },
];

export const Sidebar: React.FC<NavigationProps> = ({
  activeView,
  onNavigate,
  onQuickAdd,
  onOpenAccount,
}) => {
  const { state, user, syncing } = useSoho();
  const t = today();
  const overdueCount = state.tasks.filter((x) => x.date < t && !x.done).length;

  return (
    <aside className="hidden md:flex flex-col w-[240px] shrink-0 sticky top-0 h-screen px-3.5 py-5 border-r border-[var(--line)] bg-[var(--side)]/55">
      {/* Brand mark */}
      <div className="px-3 pt-0.5 pb-5">
        <a
          href="#dashboard"
          aria-label="SOHO"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('dashboard');
          }}
          className="inline-block focus-visible:outline-2 focus-visible:outline-[var(--accent)] rounded-md"
        >
          <span role="img" aria-label="SOHO" className="soho-logo h-7 aspect-[360/87]" />
        </a>
      </div>

      {/* Navigation links */}
      <nav aria-label="Điều hướng chính" className="flex-1 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ key, label, Icon }) => {
          const isActive = activeView === key;
          return (
            <a
              key={key}
              href={`#${key}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(key);
              }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-[var(--card)] text-[var(--text)] font-semibold shadow-[var(--shadow)]'
                  : 'text-[var(--muted)] font-medium hover:bg-[var(--hover)] hover:text-[var(--text)]'
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span className="truncate">{label}</span>
              {key === 'dashboard' && overdueCount > 0 && (
                <span className="ml-auto text-xs font-mono-num text-[var(--danger)] font-semibold">
                  {overdueCount}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Primary Quick Add & Sync / PWA controls */}
      <div className="pt-4 space-y-2.5">
        <button
          type="button"
          onClick={onQuickAdd}
          className="w-full flex items-center justify-center gap-2 min-h-[44px] rounded-full text-sm font-semibold text-[var(--onbtn)] shadow-[var(--shadow-lg)] cursor-pointer transition-opacity hover:opacity-95 whitespace-nowrap"
          style={{ background: 'var(--btn)' }}
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Thêm nhanh</span>
        </button>

        <PWAInstallButton />

        <button
          type="button"
          onClick={onOpenAccount}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--card)] text-left cursor-pointer hover:bg-[var(--hover)] transition-colors"
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Ảnh đại diện'}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[var(--accent-bg)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-[var(--text)] truncate">
              {user ? user.displayName || 'Đã đồng bộ' : 'Đăng nhập đồng bộ'}
            </div>
            <div className="text-[11px] text-[var(--muted)] truncate">
              {user ? (syncing ? 'Đang đồng bộ...' : 'Đám mây sẵn sàng') : 'Web & Điện thoại'}
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
};

export const MobileNavigation: React.FC<NavigationProps> = ({
  activeView,
  onNavigate,
  onQuickAdd,
  onOpenAccount,
}) => {
  const { user } = useSoho();

  return (
    <>
      {/* Compact mobile top bar (48px) */}
      <header className="md:hidden sticky top-0 z-30 h-12 px-3 flex items-center justify-between gap-2 bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--line)] pt-[env(safe-area-inset-top,0px)]">
        <a
          href="#dashboard"
          aria-label="SOHO"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('dashboard');
          }}
          className="inline-block shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--accent)] rounded-md"
        >
          <span role="img" aria-label="SOHO" className="soho-logo h-5 aspect-[360/87]" />
        </a>

        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={onOpenAccount}
            aria-label="Tài khoản và đồng bộ"
            className="min-h-[36px] px-2.5 py-1 rounded-full border border-[var(--line)] bg-[var(--card)] text-xs font-medium text-[var(--text)] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                referrerPolicy="no-referrer"
                className="w-4 h-4 rounded-full object-cover"
              />
            ) : (
              <Cloud className="w-3.5 h-3.5 text-[var(--accent)]" />
            )}
            <span>{user ? 'Đồng bộ' : 'Đăng nhập'}</span>
          </button>
        </div>
      </header>

      {/* Mobile Floating Quick Add Button */}
      <button
        type="button"
        onClick={onQuickAdd}
        aria-label="Thêm nhanh"
        className="md:hidden fixed right-4 bottom-[calc(70px+env(safe-area-inset-bottom,0px))] z-40 w-12 h-12 rounded-full flex items-center justify-center text-[var(--onbtn)] shadow-[var(--shadow-lg)] cursor-pointer active:scale-95 transition-transform"
        style={{ background: 'var(--btn)' }}
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Fixed bottom tab bar (56px + safe area) */}
      <nav
        aria-label="Điều hướng di động"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)]/95 backdrop-blur-md border-t border-[var(--line)] pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="grid grid-cols-6 h-14">
          {NAV_ITEMS.map(({ key, mobileLabel, Icon }) => {
            const isActive = activeView === key;
            return (
              <a
                key={key}
                href={`#${key}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(key);
                }}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[10px] leading-none whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-[var(--accent)] font-semibold'
                    : 'text-[var(--muted)] font-medium'
                }`}
              >
                <Icon className="w-[19px] h-[19px] shrink-0" />
                <span className="truncate max-w-full px-0.5">{mobileLabel}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </>
  );
};
