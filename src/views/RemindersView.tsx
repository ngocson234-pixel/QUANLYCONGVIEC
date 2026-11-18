import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useSoho } from '../context/SohoContext';
import { cmpDateTime, diffDays, dmy, dueOf, today, vnd } from '../lib/dateUtils';
import { TaskRow } from '../components/TaskRow';

interface RemindersViewProps {
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onClearEdit: () => void;
  focusTrigger: number;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  editingId,
  onStartEdit,
  onClearEdit,
  focusTrigger,
}) => {
  const {
    state,
    addReminder,
    updateReminder,
    toggleReminder,
    deleteReminder,
    toggleIncomeItemPaid,
  } = useSoho();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      const target = state.rem.find((x) => x.id === editingId);
      if (target) {
        setTitle(target.title);
        setDate(target.date);
        setTime(target.time);
        inputRef.current?.focus();
      }
    } else {
      setTitle('');
      setDate(today());
      setTime('');
    }
  }, [editingId, state.rem]);

  useEffect(() => {
    if (focusTrigger > 0) {
      inputRef.current?.focus();
    }
  }, [focusTrigger]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    if (editingId) {
      await updateReminder(editingId, { title: trimmed, date, time });
      onClearEdit();
    } else {
      await addReminder({ title: trimmed, date, time });
    }
    setTitle('');
    setDate(today());
    setTime('');
  };

  const t = today();
  const sorted = [...state.rem].sort(cmpDateTime);
  const groups = [
    { label: 'Quá hạn', items: sorted.filter((x) => !x.done && x.date < t) },
    { label: 'Hôm nay', items: sorted.filter((x) => !x.done && x.date === t) },
    { label: 'Sắp tới', items: sorted.filter((x) => !x.done && x.date > t) },
    { label: 'Đã xong', items: sorted.filter((x) => x.done) },
  ];

  const outIds = new Set(state.incCols.filter((c) => c.kind === 'out').map((c) => c.id));
  const colMap = new Map(state.incCols.map((c) => [c.id, c]));
  const debts = state.incItems
    .filter((x) => colMap.has(x.colId) && !outIds.has(x.colId) && !x.paid && dueOf(x) <= t)
    .sort((a, b) => dueOf(a).localeCompare(dueOf(b)));

  return (
    <div>
      <h1 className="text-[26px] md:text-[32px] font-bold tracking-tight leading-tight">
        Nhắc việc
      </h1>
      <p className="text-sm md:text-[15px] text-[var(--muted)] mt-1 mb-6">
        Những điều nhỏ cần nhớ đúng ngày, đúng giờ.
      </p>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-wrap gap-2 p-3.5 rounded-2xl bg-[var(--card)] border border-[var(--line)] shadow-[var(--shadow)] mb-6"
      >
        <input
          ref={inputRef}
          type="text"
          required
          maxLength={300}
          placeholder="Nội dung nhắc"
          aria-label="Nội dung nhắc"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-[1_1_220px] min-w-0 min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-2 text-base md:text-sm focus:outline-2 focus:outline-[var(--accent)]"
        />
        <input
          type="date"
          required
          aria-label="Ngày"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-2 text-base md:text-sm tabular-nums focus:outline-2 focus:outline-[var(--accent)]"
        />
        <input
          type="time"
          aria-label="Giờ"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-2 text-base md:text-sm tabular-nums focus:outline-2 focus:outline-[var(--accent)]"
        />
        <button
          type="submit"
          className="min-h-[40px] px-5 rounded-full text-sm font-semibold text-[var(--onbtn)] cursor-pointer whitespace-nowrap"
          style={{ background: 'var(--btn)' }}
        >
          {editingId ? 'Lưu thay đổi' : 'Thêm'}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={() => {
              onClearEdit();
              setTitle('');
              setDate(today());
              setTime('');
            }}
            className="min-h-[40px] px-4 rounded-full text-sm font-medium border border-[var(--line)] bg-[var(--card)] text-[var(--text)] cursor-pointer whitespace-nowrap"
          >
            Hủy
          </button>
        )}
      </form>

      {debts.length > 0 && (
        <section className="rounded-3xl bg-[var(--danger-bg)] p-5 mb-6">
          <h2 className="text-sm font-semibold text-[var(--danger)] flex items-center gap-2 mb-3">
            <span>Cần đòi tiền</span>
            <span className="font-normal text-xs text-[var(--muted)] tabular-nums">
              {debts.length}
            </span>
          </h2>
          <div className="space-y-1">
            {debts.map((x) => {
              const col = colMap.get(x.colId);
              const d = diffDays(dueOf(x), t);
              return (
                <div
                  key={x.id}
                  className="flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <button
                    type="button"
                    aria-label="Đánh dấu đã nhận tiền"
                    onClick={() => void toggleIncomeItemPaid(x.id)}
                    className="relative mt-0.5 w-5 h-5 rounded-md border border-[var(--muted)] bg-transparent hover:border-[var(--accent)] flex items-center justify-center shrink-0 cursor-pointer text-transparent before:content-[''] before:absolute before:-inset-2.5"
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium tabular-nums">
                      Đòi tiền: {x.client || col?.name || 'Khách hàng'} · {vnd(x.amount)}
                    </div>
                    <div className="text-xs text-[var(--muted)] flex flex-wrap gap-x-2 mt-0.5 tabular-nums">
                      <span
                        className={
                          d < 0
                            ? 'text-[var(--danger)] font-semibold'
                            : 'text-[var(--accent)] font-semibold'
                        }
                      >
                        {d < 0 ? `Quá hạn thanh toán ${-d} ngày` : 'Đến hạn hôm nay'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {col?.name || ''}, làm ngày {dmy(x.date)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="space-y-5">
        {groups.map(({ label, items }) =>
          items.length > 0 || label === 'Hôm nay' ? (
            <section
              key={label}
              className="rounded-3xl bg-[var(--card)] border border-[var(--line)] p-5 shadow-[var(--shadow)]"
            >
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <span>{label}</span>
                <span className="font-normal text-xs text-[var(--muted)] tabular-nums">
                  {items.length}
                </span>
              </h2>
              {items.length > 0 ? (
                <div className="space-y-0.5">
                  {items.map((x) => (
                    <TaskRow
                      key={x.id}
                      kind="r"
                      id={x.id}
                      title={x.title}
                      date={x.date}
                      time={x.time}
                      done={x.done}
                      onToggle={(id) => void toggleReminder(id)}
                      onEdit={(id) => onStartEdit(id)}
                      onDelete={(id) => void deleteReminder(id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)] py-1">
                  Không có nhắc việc nào hôm nay.
                </p>
              )}
            </section>
          ) : null
        )}
      </div>
    </div>
  );
};
