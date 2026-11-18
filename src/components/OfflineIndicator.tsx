import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-14 md:top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-[var(--warn-bg)] border border-[var(--warn)]/30 px-3.5 py-2 text-xs font-medium text-[var(--warn)] shadow-[var(--shadow)]"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Đang ngoại tuyến · Thay đổi sẽ tự đồng bộ khi có mạng</span>
    </div>
  );
};
