import React from 'react';
import { Check } from 'lucide-react';
import { Priority } from '../types/soho';
import { PRI_LABELS, WDS, diffDays, pad, today } from '../lib/dateUtils';

interface TaskRowProps {
  kind: 't' | 'r';
  id: string;
  title: string;
  date: string;
  time: string;
  done: boolean;
  pri?: Priority;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  kind,
  id,
  title,
  date,
  time,
  done,
  pri,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const d = diffDays(date, today());
  let dateLabel = '';
  let dateTone = 'text-[var(--muted)]';

  if (d === 0) {
    dateLabel = 'Hôm nay';
    dateTone = 'text-[var(--accent)] font-semibold';
  } else if (d === 1) {
    dateLabel = 'Ngày mai';
  } else if (d === -1) {
    dateLabel = done ? 'Hôm qua' : 'Quá hạn 1 ngày';
    if (!done) dateTone = 'text-[var(--danger)] font-semibold';
  } else if (d < 0) {
    dateLabel = `Quá hạn ${-d} ngày`;
    if (!done) dateTone = 'text-[var(--danger)] font-semibold';
  } else {
    const dt = new Date(`${date}T00:00:00`);
    dateLabel = `${WDS[dt.getDay()]}, ${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}`;
  }

  return (
    <div className="group flex items-start gap-2.5 px-2 py-2 rounded-xl transition-colors hover:bg-[var(--hover)]">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-label={done ? 'Bỏ đánh dấu xong' : 'Đánh dấu xong'}
        className={`relative mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer transition-colors before:content-[''] before:absolute before:-inset-2.5 ${
          done
            ? 'bg-[var(--text)] border-[var(--text)] text-[var(--bg)]'
            : 'border-[var(--muted)] bg-transparent text-transparent hover:border-[var(--accent)]'
        }`}
      >
        <Check className="w-3 h-3 stroke-[3]" />
      </button>

      <div className="flex-1 min-w-0">
        <div
          className={`text-[15px] leading-snug break-words ${
            done ? 'line-through text-[var(--muted)]' : 'text-[var(--text)]'
          }`}
        >
          {title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--muted)] tabular-nums">
          <span className={dateTone}>{dateLabel}</span>
          {time && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">{time}</span>
            </>
          )}
          {kind === 't' && pri && pri !== 'low' && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className={
                  pri === 'high'
                    ? 'text-[var(--danger)] font-semibold'
                    : 'text-[var(--accent)] font-medium'
                }
              >
                Ưu tiên {PRI_LABELS[pri].toLowerCase()}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={() => onEdit(id)}
          className="min-h-[36px] md:min-h-[28px] px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--muted)] hover:bg-[var(--line)] hover:text-[var(--text)] cursor-pointer whitespace-nowrap"
        >
          Sửa
        </button>
        <button
          type="button"
          onClick={() => onDelete(id)}
          className="min-h-[36px] md:min-h-[28px] px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--muted)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)] cursor-pointer whitespace-nowrap"
        >
          Xóa
        </button>
      </div>
    </div>
  );
};
