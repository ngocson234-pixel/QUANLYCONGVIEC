import React from 'react';
import { Check } from 'lucide-react';
import { ViewKey } from '../types/soho';
import { useSoho } from '../context/SohoContext';
import {
  WD,
  WDS,
  addDays,
  cmpDateTime,
  diffDays,
  dmy,
  dueOf,
  today,
  vnd,
} from '../lib/dateUtils';
import { TaskRow } from '../components/TaskRow';

interface DashboardViewProps {
  onNavigate: (view: ViewKey) => void;
  onEditTask: (id: string) => void;
  onEditReminder: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onEditTask,
  onEditReminder,
}) => {
  const {
    state,
    toggleTask,
    deleteTask,
    toggleReminder,
    deleteReminder,
    toggleIncomeItemPaid,
  } = useSoho();

  const t = today();
  const now = new Date();
  const hour = now.getHours();
  const greet =
    hour < 11 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  const todayTasks = state.tasks
    .filter((x) => x.date === t)
    .sort((a, b) => Number(a.done) - Number(b.done) || cmpDateTime(a, b));
  const overdueTasks = state.tasks
    .filter((x) => x.date < t && !x.done)
    .sort(cmpDateTime);
  const dueReminders = state.rem
    .filter((x) => x.date <= t && !x.done)
    .sort(cmpDateTime);
  const openTodayCount = todayTasks.filter((x) => !x.done).length;

  // Debts / overdue payments
  const outIds = new Set(state.incCols.filter((c) => c.kind === 'out').map((c) => c.id));
  const colMap = new Map(state.incCols.map((c) => [c.id, c]));
  const debts = state.incItems
    .filter((x) => colMap.has(x.colId) && !outIds.has(x.colId) && !x.paid && dueOf(x) <= t)
    .sort((a, b) => dueOf(a).localeCompare(dueOf(b)));

  // Monthly income summary
  const ym = t.slice(0, 7);
  const monthItems = state.incItems.filter(
    (x) => x.date.startsWith(ym) && colMap.has(x.colId)
  );
  const monthIn = monthItems.filter((x) => !outIds.has(x.colId));
  const tot = monthIn.reduce((s, x) => s + x.amount, 0);
  const got = monthIn.filter((x) => x.paid).reduce((s, x) => s + x.amount, 0);
  const wait = tot - got;
  const cost = monthItems
    .filter((x) => outIds.has(x.colId))
    .reduce((s, x) => s + x.amount, 0);
  const net = tot - cost;
  const goalPct = state.incGoal > 0 ? Math.round((tot / state.incGoal) * 100) : 0;

  // 7 upcoming days
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(t, i + 1);
    const dt = new Date(`${d}T00:00:00`);
    const events = [
      ...state.tasks.filter((x) => x.date === d).map((x) => ({ ...x, isRem: false })),
      ...state.rem.filter((x) => x.date === d).map((x) => ({ ...x, isRem: true })),
    ].sort(cmpDateTime);
    return { d, dt, events };
  });

  return (
    <div>
      <h1 className="text-[26px] md:text-[32px] font-bold tracking-tight leading-tight text-balance">
        {greet}
      </h1>
      <p className="text-sm md:text-[15px] text-[var(--muted)] mt-1 mb-7 tabular-nums">
        {WD[now.getDay()]}, {now.getDate()} tháng {now.getMonth() + 1}, {now.getFullYear()} ·{' '}
        {openTodayCount > 0 ? `còn ${openTodayCount} việc hôm nay` : 'hôm nay đã xong hết'}
        {overdueTasks.length > 0 ? `, ${overdueTasks.length} việc quá hạn` : ''}
      </p>

      {/* Today & Overdue Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <section className="rounded-3xl bg-[var(--card)] border border-[var(--line)] p-5 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <span>Hôm nay</span>
              <span className="font-normal text-xs text-[var(--muted)] tabular-nums">
                {todayTasks.length}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('cong-viec')}
              className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
            >
              Xem tất cả
            </button>
          </div>
          {todayTasks.length > 0 ? (
            <div className="space-y-0.5">
              {todayTasks.map((x) => (
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
                  onEdit={(id) => {
                    onEditTask(id);
                    onNavigate('cong-viec');
                  }}
                  onDelete={(id) => void deleteTask(id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)] py-2">
              Chưa có việc nào hôm nay. Thêm ở mục Công việc.
            </p>
          )}
        </section>

        <section
          className={`rounded-3xl p-5 border ${
            overdueTasks.length > 0
              ? 'bg-[var(--danger-bg)] border-transparent'
              : 'bg-[var(--card)] border-[var(--line)] shadow-[var(--shadow)]'
          }`}
        >
          <h2
            className={`text-sm font-semibold flex items-center gap-2 mb-3 ${
              overdueTasks.length > 0 ? 'text-[var(--danger)]' : ''
            }`}
          >
            <span>Quá hạn</span>
            <span className="font-normal text-xs text-[var(--muted)] tabular-nums">
              {overdueTasks.length}
            </span>
          </h2>
          {overdueTasks.length > 0 ? (
            <div className="space-y-0.5">
              {overdueTasks.map((x) => (
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
                  onEdit={(id) => {
                    onEditTask(id);
                    onNavigate('cong-viec');
                  }}
                  onDelete={(id) => void deleteTask(id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)] py-2">Không có việc nào quá hạn.</p>
          )}
        </section>
      </div>

      {/* Overdue Payment Reminders */}
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
                  className="flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
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
                    <div className="text-[15px] font-medium text-[var(--text)] tabular-nums">
                      Đòi tiền: {x.client || col?.name || 'Khách hàng'} · {vnd(x.amount)}
                    </div>
                    <div className="text-xs text-[var(--muted)] flex flex-wrap items-center gap-x-2 mt-0.5 tabular-nums">
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

      {/* Attention Reminders */}
      {dueReminders.length > 0 && (
        <section className="rounded-3xl bg-[var(--card)] border border-[var(--line)] p-5 shadow-[var(--shadow)] mb-6">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <span>Nhắc việc cần chú ý</span>
            <span className="font-normal text-xs text-[var(--muted)] tabular-nums">
              {dueReminders.length}
            </span>
          </h2>
          <div className="space-y-0.5">
            {dueReminders.map((x) => (
              <TaskRow
                key={x.id}
                kind="r"
                id={x.id}
                title={x.title}
                date={x.date}
                time={x.time}
                done={x.done}
                onToggle={(id) => void toggleReminder(id)}
                onEdit={(id) => {
                  onEditReminder(id);
                  onNavigate('nhac-viec');
                }}
                onDelete={(id) => void deleteReminder(id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Monthly Income Summary */}
      <section className="mb-7">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold">Thu nhập tháng này</h2>
          <button
            type="button"
            onClick={() => onNavigate('thu-nhap')}
            className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
          >
            Mở bảng thu nhập
          </button>
        </div>

        {state.incGoal > 0 && (
          <div className="mb-3">
            <div className="flex justify-between gap-2 text-xs text-[var(--muted)] mb-1.5 flex-wrap tabular-nums">
              <span>Mục tiêu tổng thu {vnd(state.incGoal)}</span>
              <span>
                {goalPct}%
                {tot < state.incGoal ? ` · còn ${vnd(state.incGoal - tot)}` : ' · đã đạt'}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--well)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--orange)] transition-all duration-300"
                style={{ width: `${Math.min(100, goalPct)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-[var(--card)] border border-[var(--line)] p-4 shadow-[var(--shadow)]">
            <span className="block text-xs text-[var(--muted)] mb-1">Tổng thu</span>
            <b className="text-lg md:text-xl font-bold font-mono-num">{vnd(tot)}</b>
          </div>
          <div className="rounded-2xl bg-[var(--card)] border border-[var(--line)] p-4 shadow-[var(--shadow)]">
            <span className="block text-xs text-[var(--muted)] mb-1">Chi phí</span>
            <b className="text-lg md:text-xl font-bold font-mono-num">{vnd(cost)}</b>
          </div>
          <div className="rounded-2xl bg-[var(--card)] border border-[var(--line)] p-4 shadow-[var(--shadow)]">
            <span className="block text-xs text-[var(--muted)] mb-1">Thu nhập ròng</span>
            <b className="text-lg md:text-xl font-bold font-mono-num text-[var(--ok)]">
              {vnd(net)}
            </b>
          </div>
          <div className="rounded-2xl bg-[var(--card)] border border-[var(--line)] p-4 shadow-[var(--shadow)]">
            <span className="block text-xs text-[var(--muted)] mb-1">Chưa nhận</span>
            <b className="text-lg md:text-xl font-bold font-mono-num text-[var(--warn)]">
              {vnd(wait)}
            </b>
          </div>
        </div>
      </section>

      {/* Next 7 days */}
      <section>
        <h2 className="text-sm font-semibold mb-3">7 ngày tới</h2>
        <div className="grid grid-flow-col auto-cols-[minmax(132px,1fr)] lg:grid-flow-row lg:grid-cols-7 gap-2 overflow-x-auto pb-1">
          {next7Days.map(({ d, dt, events }) => (
            <div
              key={d}
              className="rounded-2xl bg-[var(--card)] border border-[var(--line)] p-2.5 min-h-[120px] shadow-[var(--shadow)]"
            >
              <div className="text-xs text-[var(--muted)] mb-2 tabular-nums">
                <span>{WDS[dt.getDay()]}</span>
                <b className="block text-lg font-semibold text-[var(--text)] leading-tight">
                  {dt.getDate()}/{dt.getMonth() + 1}
                </b>
              </div>
              <div className="space-y-1">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className={`text-xs px-2 py-1 rounded-lg break-words ${
                      ev.isRem
                        ? 'bg-[var(--warn-bg)] text-[var(--warn)]'
                        : 'bg-[var(--accent-bg)] text-[var(--accent)]'
                    } ${ev.done ? 'line-through opacity-55' : ''}`}
                  >
                    {ev.time && (
                      <small className="block text-[11px] opacity-80 font-mono-num">
                        {ev.time}
                      </small>
                    )}
                    {ev.title}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
