import React, { useEffect, useRef, useState } from 'react';
import { Priority } from '../types/soho';
import { useSoho } from '../context/SohoContext';
import { PRI_LABELS, cmpDateTime, today } from '../lib/dateUtils';
import { TaskRow } from '../components/TaskRow';

interface TasksViewProps {
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onClearEdit: () => void;
  focusTrigger: number;
}

export const TasksView: React.FC<TasksViewProps> = ({
  editingId,
  onStartEdit,
  onClearEdit,
  focusTrigger,
}) => {
  const { state, addTask, updateTask, toggleTask, deleteTask } = useSoho();
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('');
  const [pri, setPri] = useState<Priority>('mid');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      const target = state.tasks.find((x) => x.id === editingId);
      if (target) {
        setTitle(target.title);
        setDate(target.date);
        setTime(target.time);
        setPri(target.pri);
        inputRef.current?.focus();
      }
    } else {
      setTitle('');
      setDate(today());
      setTime('');
      setPri('mid');
    }
  }, [editingId, state.tasks]);

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
      await updateTask(editingId, { title: trimmed, date, time, pri });
      onClearEdit();
    } else {
      await addTask({ title: trimmed, date, time, pri });
    }
    setTitle('');
    setDate(today());
    setTime('');
    setPri('mid');
  };

  const filtered = state.tasks
    .filter((x) => (filter === 'all' ? true : filter === 'open' ? !x.done : x.done))
    .sort((a, b) => Number(a.done) - Number(b.done) || cmpDateTime(a, b));

  return (
    <div>
      <h1 className="text-[26px] md:text-[32px] font-bold tracking-tight leading-tight">
        Công việc
      </h1>
      <p className="text-sm md:text-[15px] text-[var(--muted)] mt-1 mb-6">
        Tất cả việc cần làm, sắp theo hạn.
      </p>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-wrap gap-2 p-3.5 rounded-2xl bg-[var(--card)] border border-[var(--line)] shadow-[var(--shadow)] mb-5"
      >
        <input
          ref={inputRef}
          type="text"
          required
          maxLength={300}
          placeholder="Việc cần làm"
          aria-label="Tiêu đề công việc"
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
        <select
          aria-label="Ưu tiên"
          value={pri}
          onChange={(e) => setPri(e.target.value as Priority)}
          className="min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-2 text-base md:text-sm focus:outline-2 focus:outline-[var(--accent)]"
        >
          {(Object.keys(PRI_LABELS) as Priority[]).map((k) => (
            <option key={k} value={k}>
              Ưu tiên {PRI_LABELS[k].toLowerCase()}
            </option>
          ))}
        </select>
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
              setPri('mid');
            }}
            className="min-h-[40px] px-4 rounded-full text-sm font-medium border border-[var(--line)] bg-[var(--card)] text-[var(--text)] cursor-pointer whitespace-nowrap"
          >
            Hủy
          </button>
        )}
      </form>

      <div className="inline-flex gap-1 p-1 rounded-xl bg-[var(--well)] mb-3">
        {(
          [
            ['all', 'Tất cả'],
            ['open', 'Chưa xong'],
            ['done', 'Đã xong'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
              filter === k
                ? 'bg-[var(--card)] text-[var(--text)] font-semibold shadow-xs'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="rounded-3xl bg-[var(--card)] border border-[var(--line)] p-4 md:p-5 shadow-[var(--shadow)]">
        {filtered.length > 0 ? (
          <div className="space-y-0.5">
            {filtered.map((x) => (
              <TaskRow
                key={x.id}
                kind="t"
                id={x.id}
                title={x.title}
                date={x.date}
                time={x.time}
                pri={x.pri}
                done={x.done}
                onToggle={(id) => void toggleTask(id)}
                onEdit={(id) => onStartEdit(id)}
                onDelete={(id) => void deleteTask(id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)] py-2">
            Chưa có việc nào ở đây. Nhập việc đầu tiên ở khung phía trên.
          </p>
        )}
      </section>
    </div>
  );
};
