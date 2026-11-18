import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSoho } from '../context/SohoContext';
import {
  WDS,
  addDays,
  dmy,
  downloadCsv,
  dueOf,
  isColVisible,
  pad,
  today,
  vnd,
} from '../lib/dateUtils';

interface IncomeViewProps {
  quickCellRequest: { colId: string; date: string; seq: number } | null;
  onConsumeQuickCell: () => void;
}

export const IncomeView: React.FC<IncomeViewProps> = ({
  quickCellRequest,
  onConsumeQuickCell,
}) => {
  const {
    state,
    showToast,
    setMonthlyGoal,
    addIncomeColumn,
    hideIncomeColumnInMonth,
    showIncomeColumnInMonth,
    deleteIncomeColumn,
    addIncomeItem,
    updateIncomeItem,
    toggleIncomeItemPaid,
    deleteIncomeItem,
  } = useSoho();

  const [ym, setYm] = useState<string>(() => today().slice(0, 7));
  const [modalMode, setModalMode] = useState<
    | null
    | { type: 'goal' }
    | { type: 'cols' }
    | { type: 'cell'; colId: string; date: string; editItemId: string | null }
  >(null);

  // Modal form states
  const [goalInput, setGoalInput] = useState('0');
  const [newColName, setNewColName] = useState('');
  const [newColKind, setNewColKind] = useState<'in' | 'out'>('in');
  const [newColScope, setNewColScope] = useState<'month' | 'all'>('month');

  const [itemAmount, setItemAmount] = useState('');
  const [itemClient, setItemClient] = useState('');
  const [itemNote, setItemNote] = useState('');
  const [itemDue, setItemDue] = useState('');
  const [itemPaid, setItemPaid] = useState(true);

  useEffect(() => {
    if (quickCellRequest) {
      setYm(quickCellRequest.date.slice(0, 7));
      setModalMode({
        type: 'cell',
        colId: quickCellRequest.colId,
        date: quickCellRequest.date,
        editItemId: null,
      });
      setItemAmount('');
      setItemClient('');
      setItemNote('');
      setItemDue('');
      setItemPaid(true);
      onConsumeQuickCell();
    }
  }, [quickCellRequest, onConsumeQuickCell]);

  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const t = today();

  const colMap = new Map(state.incCols.map((c) => [c.id, c]));
  const inCols = state.incCols.filter((c) => c.kind !== 'out' && isColVisible(c, ym));
  const outCols = state.incCols.filter((c) => c.kind === 'out' && isColVisible(c, ym));
  const outIds = new Set(state.incCols.filter((c) => c.kind === 'out').map((c) => c.id));

  const monthItems = state.incItems.filter(
    (x) => x.date.startsWith(ym) && colMap.has(x.colId)
  );
  const sumAmt = (arr: typeof monthItems) => arr.reduce((s, x) => s + x.amount, 0);
  const tot = sumAmt(monthItems.filter((x) => !outIds.has(x.colId)));
  const got = sumAmt(monthItems.filter((x) => !outIds.has(x.colId) && x.paid));
  const wait = tot - got;
  const cost = sumAmt(monthItems.filter((x) => outIds.has(x.colId)));
  const net = tot - cost;
  const goalPct = state.incGoal > 0 ? Math.round((tot / state.incGoal) * 100) : 0;

  // This week income
  const dowNow = new Date(`${t}T00:00:00`).getDay();
  const ws = addDays(t, -((dowNow + 6) % 7));
  const we = addDays(ws, 6);
  const wk = sumAmt(
    state.incItems.filter(
      (x) =>
        x.date >= ws &&
        x.date <= we &&
        colMap.has(x.colId) &&
        !outIds.has(x.colId)
    )
  );

  // Group days by Monday-start week
  const weekGroups: Array<Array<{ d: string; i: number; dow: number }>> = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const d = `${ym}-${pad(i)}`;
    const dow = new Date(y, m - 1, i).getDay();
    if (!weekGroups.length || dow === 1) weekGroups.push([]);
    weekGroups[weekGroups.length - 1].push({ d, i, dow });
  }

  const shiftMonth = (delta: number) => {
    const dt = new Date(y, m - 1 + delta, 1);
    setYm(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`);
  };

  const handleExportCsv = () => {
    const sorted = [...monthItems].sort((a, b) => a.date.localeCompare(b.date));
    const rows: (string | number)[][] = [
      [
        'Ngày',
        'Loại',
        'Hạng mục',
        'Số tiền (đ)',
        'Khách hàng / nội dung',
        'Ghi chú',
        'Trạng thái',
        'Hạn thanh toán',
      ],
      ...sorted.map((x) => {
        const c = colMap.get(x.colId);
        const isOut = c?.kind === 'out';
        return [
          dmy(x.date),
          isOut ? 'Chi' : 'Thu',
          c?.name || '',
          x.amount,
          x.client,
          x.note,
          isOut ? '' : x.paid ? 'Đã nhận' : 'Chưa nhận',
          isOut || x.paid ? '' : dmy(dueOf(x)),
        ];
      }),
      [],
      ['', 'Tổng thu', '', tot],
      ['', 'Chi phí', '', cost],
      ['', 'Thu nhập ròng', '', net],
    ];
    downloadCsv(`thu-nhap-${ym}.csv`, rows);
    showToast(`Đã xuất thu-nhap-${ym}.csv`);
  };

  const openCellModal = (colId: string, date: string) => {
    setModalMode({ type: 'cell', colId, date, editItemId: null });
    setItemAmount('');
    setItemClient('');
    setItemNote('');
    setItemDue('');
    setItemPaid(true);
  };

  return (
    <div>
      <h1 className="text-[26px] md:text-[32px] font-bold tracking-tight leading-tight">
        Thu nhập
      </h1>
      <p className="text-sm md:text-[15px] text-[var(--muted)] mt-1 mb-5">
        Bấm vào một ô để xem chi tiết hoặc thêm khoản thu, khoản chi. Các tổng tự cập nhật.
      </p>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Tháng trước"
            onClick={() => shiftMonth(-1)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-bold min-w-[128px] text-center tabular-nums">
            Tháng {m}, {y}
          </h2>
          <button
            type="button"
            aria-label="Tháng sau"
            onClick={() => shiftMonth(1)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setYm(today().slice(0, 7))}
          className="min-h-[40px] px-4 rounded-full text-sm font-medium border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)] whitespace-nowrap"
        >
          Tháng này
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => {
            setGoalInput(String(state.incGoal || 0));
            setModalMode({ type: 'goal' });
          }}
          className="min-h-[40px] px-4 rounded-full text-sm font-medium border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)] whitespace-nowrap"
        >
          Mục tiêu
        </button>
        <button
          type="button"
          onClick={() => {
            setNewColName('');
            setModalMode({ type: 'cols' });
          }}
          className="min-h-[40px] px-4 rounded-full text-sm font-medium border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)] whitespace-nowrap"
        >
          Loại việc
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          className="min-h-[40px] px-5 rounded-full text-sm font-semibold text-[var(--onbtn)] cursor-pointer whitespace-nowrap"
          style={{ background: 'var(--btn)' }}
        >
          Xuất CSV
        </button>
      </div>

      {/* Goal progress */}
      {state.incGoal > 0 && (
        <div className="mb-4">
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

      {/* 5 Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--line)] p-3.5 shadow-[var(--shadow)]">
          <span className="block text-xs text-[var(--muted)] mb-0.5">Tổng thu</span>
          <b className="text-lg font-bold font-mono-num">{vnd(tot)}</b>
        </div>
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--line)] p-3.5 shadow-[var(--shadow)]">
          <span className="block text-xs text-[var(--muted)] mb-0.5">Chi phí</span>
          <b className="text-lg font-bold font-mono-num">{vnd(cost)}</b>
        </div>
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--line)] p-3.5 shadow-[var(--shadow)]">
          <span className="block text-xs text-[var(--muted)] mb-0.5">Thu nhập ròng</span>
          <b className="text-lg font-bold font-mono-num text-[var(--ok)]">{vnd(net)}</b>
        </div>
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--line)] p-3.5 shadow-[var(--shadow)]">
          <span className="block text-xs text-[var(--muted)] mb-0.5">Chưa nhận</span>
          <b className="text-lg font-bold font-mono-num text-[var(--warn)]">{vnd(wait)}</b>
        </div>
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--line)] p-3.5 shadow-[var(--shadow)] col-span-2 sm:col-span-1">
          <span className="block text-xs text-[var(--muted)] mb-0.5">Tuần này</span>
          <b className="text-lg font-bold font-mono-num">{vnd(wk)}</b>
        </div>
      </div>

      {/* Monthly Ledger Table */}
      <div className="overflow-auto max-h-[66vh] rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)]">
        <table className="w-full border-separate border-spacing-0 text-sm tabular-nums">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-[var(--side)] text-left px-3 py-2.5 text-xs font-semibold border-b border-r border-[var(--line)] whitespace-nowrap">
                Ngày
              </th>
              {inCols.map((c) => (
                <th
                  key={c.id}
                  className="sticky top-0 z-20 bg-[var(--side)] text-right px-3 py-2.5 text-xs font-semibold border-b border-r border-[var(--line)] whitespace-nowrap"
                >
                  {c.name}
                </th>
              ))}
              <th className="sticky top-0 z-20 bg-[var(--side)] text-right px-3 py-2.5 text-xs font-semibold border-b border-r border-[var(--line)] whitespace-nowrap">
                Tổng ngày
              </th>
              {outCols.map((c) => (
                <th
                  key={c.id}
                  className="sticky top-0 z-20 bg-[var(--side)] text-right px-3 py-2.5 text-xs font-semibold text-[var(--danger)] border-b border-r border-[var(--line)] whitespace-nowrap"
                >
                  {c.name}
                </th>
              ))}
              <th className="sticky top-0 z-20 bg-[var(--side)] text-right px-3 py-2.5 text-xs font-semibold text-[var(--danger)] border-b border-r border-[var(--line)] whitespace-nowrap">
                Chi ngày
              </th>
              <th className="sticky top-0 z-20 bg-[var(--side)] text-center px-3 py-2.5 text-xs font-semibold border-b border-[var(--line)] whitespace-nowrap">
                Tổng tuần
              </th>
            </tr>
          </thead>
          <tbody>
            {weekGroups.map((grp, gIdx) => {
              const ds = new Set(grp.map((o) => o.d));
              const wItems = monthItems.filter((x) => ds.has(x.date));
              const wi = sumAmt(wItems.filter((x) => !outIds.has(x.colId)));
              const wc = sumAmt(wItems.filter((x) => outIds.has(x.colId)));

              return grp.map((o, j) => {
                const dayItems = monthItems.filter((x) => x.date === o.d);
                const di = sumAmt(dayItems.filter((x) => !outIds.has(x.colId)));
                const dc = sumAmt(dayItems.filter((x) => outIds.has(x.colId)));
                const isToday = o.d === t;
                const isWeekend = o.dow === 0 || o.dow === 6;

                return (
                  <tr key={o.d}>
                    <td
                      className={`sticky left-0 z-10 px-3 py-1.5 text-left border-b border-r border-[var(--line)] whitespace-nowrap font-mono-num text-xs ${
                        isToday
                          ? 'bg-[var(--accent-bg)] text-[var(--accent)] font-bold'
                          : isWeekend
                          ? 'bg-[var(--side)] text-[var(--danger)]'
                          : 'bg-[var(--side)] text-[var(--muted)]'
                      }`}
                    >
                      {pad(o.i)}/{pad(m)} {WDS[o.dow]}
                    </td>

                    {inCols.map((c) => {
                      const cellItems = dayItems.filter((x) => x.colId === c.id);
                      const cellVal = sumAmt(cellItems);
                      const hasUnpaid = cellItems.some((x) => !x.paid);
                      return (
                        <td
                          key={c.id}
                          className={`p-0 border-b border-r border-[var(--line)] ${
                            isToday ? 'bg-[var(--accent-bg)]/50' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => openCellModal(c.id, o.d)}
                            aria-label={`${c.name} ${o.d}`}
                            className="w-full min-w-[116px] min-h-[42px] md:min-h-[34px] px-3 py-1.5 text-right font-mono-num text-xs hover:bg-[var(--hover)] cursor-pointer transition-colors"
                          >
                            {cellVal > 0 ? (
                              <span>
                                {vnd(cellVal)}
                                {hasUnpaid && (
                                  <span
                                    title="Chưa nhận"
                                    className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--warn)] ml-1.5 align-middle"
                                  />
                                )}
                              </span>
                            ) : (
                              ''
                            )}
                          </button>
                        </td>
                      );
                    })}

                    <td
                      className={`px-3 py-1.5 text-right font-semibold font-mono-num text-xs border-b border-r border-[var(--line)] whitespace-nowrap ${
                        isToday ? 'bg-[var(--accent-bg)]/50' : ''
                      }`}
                    >
                      {di > 0 ? vnd(di) : ''}
                    </td>

                    {outCols.map((c) => {
                      const cellItems = dayItems.filter((x) => x.colId === c.id);
                      const cellVal = sumAmt(cellItems);
                      return (
                        <td
                          key={c.id}
                          className={`p-0 border-b border-r border-[var(--line)] ${
                            isToday ? 'bg-[var(--accent-bg)]/50' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => openCellModal(c.id, o.d)}
                            aria-label={`${c.name} ${o.d}`}
                            className="w-full min-w-[116px] min-h-[42px] md:min-h-[34px] px-3 py-1.5 text-right font-mono-num text-xs hover:bg-[var(--hover)] cursor-pointer transition-colors"
                          >
                            {cellVal > 0 ? vnd(cellVal) : ''}
                          </button>
                        </td>
                      );
                    })}

                    <td
                      className={`px-3 py-1.5 text-right font-semibold font-mono-num text-xs border-b border-r border-[var(--line)] whitespace-nowrap ${
                        isToday ? 'bg-[var(--accent-bg)]/50' : ''
                      }`}
                    >
                      {dc > 0 ? vnd(dc) : ''}
                    </td>

                    {j === 0 && (
                      <td
                        key={`w-${gIdx}`}
                        rowSpan={grp.length}
                        className="px-3 py-2 text-center align-middle font-semibold font-mono-num text-xs bg-[var(--hover)] border-b border-[var(--line)] whitespace-nowrap"
                      >
                        {wi > 0 || wc > 0 ? (
                          <div>
                            <div>{vnd(wi)}</div>
                            <div className="font-normal text-[11px] text-[var(--muted)]">
                              chi {vnd(wc)}
                            </div>
                            <div className="font-normal text-[11px] text-[var(--muted)]">
                              ròng {vnd(wi - wc)}
                            </div>
                          </div>
                        ) : (
                          '–'
                        )}
                      </td>
                    )}
                  </tr>
                );
              });
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky bottom-0 left-0 z-30 bg-[var(--side)] px-3 py-2.5 text-left font-bold text-xs border-r border-t border-[var(--line)] whitespace-nowrap">
                Tổng tháng
              </td>
              {inCols.map((c) => (
                <td
                  key={c.id}
                  className="sticky bottom-0 z-20 bg-[var(--side)] px-3 py-2.5 text-right font-bold font-mono-num text-xs border-r border-t border-[var(--line)] whitespace-nowrap"
                >
                  {vnd(sumAmt(monthItems.filter((x) => x.colId === c.id)))}
                </td>
              ))}
              <td className="sticky bottom-0 z-20 bg-[var(--side)] px-3 py-2.5 text-right font-bold font-mono-num text-xs border-r border-t border-[var(--line)] whitespace-nowrap">
                {vnd(tot)}
              </td>
              {outCols.map((c) => (
                <td
                  key={c.id}
                  className="sticky bottom-0 z-20 bg-[var(--side)] px-3 py-2.5 text-right font-bold font-mono-num text-xs border-r border-t border-[var(--line)] whitespace-nowrap"
                >
                  {vnd(sumAmt(monthItems.filter((x) => x.colId === c.id)))}
                </td>
              ))}
              <td className="sticky bottom-0 z-20 bg-[var(--side)] px-3 py-2.5 text-right font-bold font-mono-num text-xs border-r border-t border-[var(--line)] whitespace-nowrap">
                {vnd(cost)}
              </td>
              <td className="sticky bottom-0 z-20 bg-[var(--side)] px-3 py-2.5 text-center font-bold font-mono-num text-xs border-t border-[var(--line)] whitespace-nowrap">
                Ròng {vnd(net)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Income Modals */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalMode(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md max-h-[90vh] overflow-auto rounded-3xl bg-[var(--card)] border border-[var(--line)] p-5 shadow-[var(--shadow-lg)]"
          >
            {modalMode.type === 'goal' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-bold">Mục tiêu tháng</h3>
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    aria-label="Đóng"
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)] mb-4">
                  Mục tiêu tổng thu mỗi tháng. Nhập 0 để tắt thanh tiến độ.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await setMonthlyGoal(Number(goalInput) || 0);
                    setModalMode(null);
                  }}
                  className="space-y-3"
                >
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="numeric"
                    aria-label="Mục tiêu tổng thu"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-2 text-base md:text-sm font-mono-num"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModalMode(null)}
                      className="min-h-[40px] px-4 rounded-full text-sm border border-[var(--line)] bg-[var(--card)] cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      className="min-h-[40px] px-5 rounded-full text-sm font-semibold text-[var(--onbtn)] cursor-pointer"
                      style={{ background: 'var(--btn)' }}
                    >
                      Lưu mục tiêu
                    </button>
                  </div>
                </form>
              </div>
            )}

            {modalMode.type === 'cols' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-bold">
                    Loại việc · tháng {ym.slice(5)}/{ym.slice(0, 4)}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    aria-label="Đóng"
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)] mb-4">
                  Cột thêm mới có thể áp dụng chỉ cho tháng đang xem hoặc mọi tháng.
                </p>

                <div className="space-y-2 mb-4">
                  {state.incCols
                    .filter((c) => isColVisible(c, ym))
                    .map((c) => {
                      const count = monthItems.filter((x) => x.colId === c.id).length;
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl border border-[var(--line)] bg-[var(--inp)] text-sm"
                        >
                          <div className="min-w-0">
                            <span className="font-medium">{c.name}</span>
                            <span className="ml-2 text-xs text-[var(--muted)]">
                              {c.kind === 'out' ? 'chi' : 'thu'} ·{' '}
                              {c.monthScope ? 'chỉ tháng này' : 'mọi tháng'} · {count} khoản
                            </span>
                          </div>
                          {count === 0 && (
                            c.monthScope ? (
                              <button
                                type="button"
                                onClick={() => void deleteIncomeColumn(c.id)}
                                className="text-xs font-medium text-[var(--danger)] hover:underline cursor-pointer shrink-0"
                              >
                                Xóa
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void hideIncomeColumnInMonth(c.id, ym)}
                                className="text-xs font-medium text-[var(--muted)] hover:text-[var(--text)] cursor-pointer shrink-0"
                              >
                                Ẩn tháng này
                              </button>
                            )
                          )}
                        </div>
                      );
                    })}
                </div>

                {state.incCols.some(
                  (c) => (!c.monthScope || c.monthScope === ym) && c.hiddenMonths.includes(ym)
                ) && (
                  <div className="mb-4">
                    <div className="text-xs text-[var(--muted)] mb-2">Đang ẩn ở tháng này</div>
                    <div className="space-y-2">
                      {state.incCols
                        .filter(
                          (c) =>
                            (!c.monthScope || c.monthScope === ym) &&
                            c.hiddenMonths.includes(ym)
                        )
                        .map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between px-3 py-2 rounded-2xl border border-[var(--line)] bg-[var(--inp)] text-sm"
                          >
                            <span>{c.name}</span>
                            <button
                              type="button"
                              onClick={() => void showIncomeColumnInMonth(c.id, ym)}
                              className="text-xs font-semibold text-[var(--accent)] cursor-pointer"
                            >
                              Hiện lại
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newColName.trim()) return;
                    await addIncomeColumn({
                      name: newColName.trim(),
                      kind: newColKind,
                      monthScope: newColScope === 'all' ? '' : ym,
                    });
                    setNewColName('');
                  }}
                  className="space-y-2.5 pt-3 border-t border-[var(--line)]"
                >
                  <input
                    type="text"
                    required
                    maxLength={80}
                    placeholder="Tên cột mới"
                    aria-label="Tên cột"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-2 text-base md:text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      aria-label="Loại cột"
                      value={newColKind}
                      onChange={(e) => setNewColKind(e.target.value as 'in' | 'out')}
                      className="min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-2 text-sm"
                    >
                      <option value="in">Cột thu (công việc)</option>
                      <option value="out">Cột chi phí</option>
                    </select>
                    <select
                      aria-label="Phạm vi"
                      value={newColScope}
                      onChange={(e) => setNewColScope(e.target.value as 'month' | 'all')}
                      className="min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-2 text-sm"
                    >
                      <option value="month">Chỉ tháng này</option>
                      <option value="all">Mọi tháng</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setModalMode(null)}
                      className="min-h-[40px] px-4 rounded-full text-sm border border-[var(--line)] bg-[var(--card)] cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      className="min-h-[40px] px-5 rounded-full text-sm font-semibold text-[var(--onbtn)] cursor-pointer"
                      style={{ background: 'var(--btn)' }}
                    >
                      Thêm cột
                    </button>
                  </div>
                </form>
              </div>
            )}

            {modalMode.type === 'cell' &&
              (() => {
                const col = colMap.get(modalMode.colId);
                if (!col) return null;
                const isOut = col.kind === 'out';
                const cellList = state.incItems.filter(
                  (x) => x.date === modalMode.date && x.colId === modalMode.colId
                );
                const cellSum = sumAmt(cellList);

                return (
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="text-base font-bold">{col.name}</h3>
                      <button
                        type="button"
                        onClick={() => setModalMode(null)}
                        aria-label="Đóng"
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-[var(--muted)] mb-4 tabular-nums">
                      {dmy(modalMode.date)}
                      {cellList.length > 0 ? ` · tổng ${vnd(cellSum)}` : ''}
                    </p>

                    {cellList.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {cellList.map((x) => (
                          <div
                            key={x.id}
                            className="p-3 rounded-2xl border border-[var(--line)] bg-[var(--inp)]"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-base font-mono-num">
                                {vnd(x.amount)}
                              </span>
                              {!isOut && (
                                <button
                                  type="button"
                                  onClick={() => void toggleIncomeItemPaid(x.id)}
                                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full cursor-pointer ${
                                    x.paid
                                      ? 'bg-[var(--hover)] text-[var(--ok)]'
                                      : 'bg-[var(--warn-bg)] text-[var(--warn)]'
                                  }`}
                                >
                                  {x.paid ? 'Đã nhận' : 'Chưa nhận'}
                                </button>
                              )}
                              <div className="flex-1" />
                              <button
                                type="button"
                                onClick={() => {
                                  setModalMode({ ...modalMode, editItemId: x.id });
                                  setItemAmount(String(x.amount));
                                  setItemClient(x.client);
                                  setItemNote(x.note);
                                  setItemDue(x.due);
                                  setItemPaid(x.paid);
                                }}
                                className="text-xs font-medium text-[var(--muted)] hover:text-[var(--text)] px-2 py-1 cursor-pointer"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteIncomeItem(x.id)}
                                className="text-xs font-medium text-[var(--muted)] hover:text-[var(--danger)] px-2 py-1 cursor-pointer"
                              >
                                Xóa
                              </button>
                            </div>
                            {x.client && <div className="text-sm mt-1">{x.client}</div>}
                            {x.note && (
                              <div className="text-xs text-[var(--muted)] mt-0.5">{x.note}</div>
                            )}
                            {!isOut && !x.paid && (
                              <div className="text-xs text-[var(--warn)] mt-1 tabular-nums">
                                Hạn thanh toán {dmy(dueOf(x))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const amt = Math.round(Number(itemAmount)) || 0;
                        if (amt <= 0) return;
                        if (modalMode.editItemId) {
                          await updateIncomeItem(modalMode.editItemId, {
                            amount: amt,
                            client: itemClient,
                            note: itemNote,
                            paid: isOut || itemPaid,
                            due: isOut ? '' : itemDue,
                          });
                        } else {
                          await addIncomeItem({
                            colId: modalMode.colId,
                            date: modalMode.date,
                            amount: amt,
                            client: itemClient,
                            note: itemNote,
                            paid: isOut || itemPaid,
                            due: isOut ? '' : itemDue,
                          });
                        }
                        setModalMode({ ...modalMode, editItemId: null });
                        setItemAmount('');
                        setItemClient('');
                        setItemNote('');
                        setItemDue('');
                        setItemPaid(true);
                      }}
                      className="space-y-2.5 pt-3 border-t border-[var(--line)]"
                    >
                      <div className="text-xs font-semibold">
                        {modalMode.editItemId ? 'Sửa' : 'Thêm'}
                        {isOut ? ' khoản chi' : ' khoản thu'}
                      </div>
                      <input
                        type="number"
                        required
                        min={1}
                        step="any"
                        inputMode="numeric"
                        placeholder="Số tiền (đ)"
                        aria-label="Số tiền"
                        value={itemAmount}
                        onChange={(e) => setItemAmount(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-2 text-base md:text-sm font-mono-num"
                      />
                      <input
                        type="text"
                        maxLength={160}
                        placeholder={isOut ? 'Nội dung chi' : 'Khách hàng / địa điểm'}
                        aria-label="Nội dung"
                        value={itemClient}
                        onChange={(e) => setItemClient(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-2 text-base md:text-sm"
                      />
                      <input
                        type="text"
                        maxLength={400}
                        placeholder="Ghi chú: hợp đồng, link…"
                        aria-label="Ghi chú"
                        value={itemNote}
                        onChange={(e) => setItemNote(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-2 text-base md:text-sm"
                      />

                      {!isOut && (
                        <>
                          <label className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                            <span>Hạn thanh toán</span>
                            <input
                              type="date"
                              value={itemDue}
                              onChange={(e) => setItemDue(e.target.value)}
                              className="min-h-[38px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-2.5 py-1 text-sm text-[var(--text)]"
                            />
                          </label>
                          <p className="text-[11px] text-[var(--muted)]">
                            Để trống: tự tính 7 ngày sau ngày làm. Bỏ tick nếu chưa nhận tiền.
                          </p>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={itemPaid}
                              onChange={(e) => setItemPaid(e.target.checked)}
                              className="w-4 h-4 accent-[var(--accent)]"
                            />
                            <span>Đã nhận tiền</span>
                          </label>
                        </>
                      )}

                      <div className="flex justify-end gap-2 pt-2">
                        {modalMode.editItemId && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalMode({ ...modalMode, editItemId: null });
                              setItemAmount('');
                              setItemClient('');
                              setItemNote('');
                              setItemDue('');
                              setItemPaid(true);
                            }}
                            className="min-h-[40px] px-4 rounded-full text-sm border border-[var(--line)] bg-[var(--card)] cursor-pointer"
                          >
                            Hủy sửa
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setModalMode(null)}
                          className="min-h-[40px] px-4 rounded-full text-sm border border-[var(--line)] bg-[var(--card)] cursor-pointer"
                        >
                          Đóng
                        </button>
                        <button
                          type="submit"
                          className="min-h-[40px] px-5 rounded-full text-sm font-semibold text-[var(--onbtn)] cursor-pointer"
                          style={{ background: 'var(--btn)' }}
                        >
                          {modalMode.editItemId ? 'Lưu' : 'Thêm'}
                        </button>
                      </div>
                    </form>
                  </div>
                );
              })()}
          </div>
        </div>
      )}
    </div>
  );
};
