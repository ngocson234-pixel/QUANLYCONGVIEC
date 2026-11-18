import {
  IncomeColumn,
  IncomeItem,
  MindmapLayout,
  MindmapMeta,
  MindmapNode,
  Priority,
  SohoState,
} from '../types/soho';

export const WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
export const WDS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const PRI_LABELS: Record<Priority, string> = {
  high: 'Cao',
  mid: 'Vừa',
  low: 'Thấp',
};

export const pad = (n: number): string => String(n).padStart(2, '0');

export const fmtDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = (): string => fmtDate(new Date());

export const addDays = (s: string, n: number): string => {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
};

export const diffDays = (a: string, b: string): number =>
  Math.round((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 864e5);

export const dmy = (d: string): string => d.split('-').reverse().join('/');

export const vnd = (n: number): string => `${Math.round(n).toLocaleString('vi-VN')} đ`;

export const uid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-3);
};

export const cmpDateTime = (
  a: { date: string; time?: string },
  b: { date: string; time?: string }
): number => `${a.date}${a.time || '99:99'}`.localeCompare(`${b.date}${b.time || '99:99'}`);

export const dueOf = (item: IncomeItem): string => item.due || addDays(item.date, 7);

export const isColVisible = (col: IncomeColumn, ym: string): boolean =>
  (!col.monthScope || col.monthScope === ym) && !col.hiddenMonths.includes(ym);

export interface TemplateTree {
  label: string;
  children?: TemplateTree[];
}

export const MINDMAP_TEMPLATES: Record<
  string,
  { name: string; layout: MindmapLayout; root: TemplateTree }
> = {
  mind: {
    name: 'Mind Map',
    layout: 'mind',
    root: {
      label: 'Chủ đề chính',
      children: [
        { label: 'Nhánh 1', children: [{ label: 'Ý 1.1' }, { label: 'Ý 1.2' }] },
        { label: 'Nhánh 2' },
        { label: 'Nhánh 3', children: [{ label: 'Ý 3.1' }] },
        { label: 'Nhánh 4' },
      ],
    },
  },
  logic: {
    name: 'Logic Chart',
    layout: 'logic',
    root: {
      label: 'Chủ đề chính',
      children: [
        { label: 'Nhánh 1', children: [{ label: 'Chi tiết' }] },
        { label: 'Nhánh 2' },
        { label: 'Nhánh 3' },
        { label: 'Nhánh 4' },
      ],
    },
  },
  org: {
    name: 'Org Chart',
    layout: 'org',
    root: {
      label: 'Chủ đề chính',
      children: [
        { label: 'Nhóm A', children: [{ label: 'Việc 1' }, { label: 'Việc 2' }] },
        { label: 'Nhóm B' },
        { label: 'Nhóm C' },
      ],
    },
  },
  content: {
    name: 'Kế hoạch content',
    layout: 'mind',
    root: {
      label: 'Ý tưởng content',
      children: [
        { label: 'Chủ đề', children: [{ label: 'Review quán' }, { label: 'Hậu trường' }] },
        { label: 'Kênh', children: [{ label: 'Facebook' }, { label: 'TikTok' }] },
        { label: 'Lịch đăng' },
        { label: 'Caption mẫu' },
      ],
    },
  },
};

export function flattenTemplateTree(
  mapId: string,
  tree: TemplateTree
): { rootNodeId: string; nodes: MindmapNode[] } {
  const nodes: MindmapNode[] = [];
  const walk = (node: TemplateTree, parentId: string, sortOrder: number): string => {
    const id = uid();
    nodes.push({
      id,
      mapId,
      parentId,
      text: node.label,
      collapsed: false,
      sortOrder,
    });
    (node.children || []).forEach((child, idx) => {
      walk(child, id, idx);
    });
    return id;
  };
  const rootNodeId = walk(tree, '', 0);
  return { rootNodeId, nodes };
}

export function createDefaultState(): SohoState {
  const t = today();
  const m = t.slice(0, 7);
  const colRev = uid();
  const colPhoto = uid();
  const colFarmers = uid();
  const colTravel = uid();
  const colGear = uid();
  const colAds = uid();
  const nowMs = Date.now();

  const sampleMapId = uid();
  const { rootNodeId, nodes } = flattenTemplateTree(sampleMapId, MINDMAP_TEMPLATES.content.root);
  const sampleMap: MindmapMeta = {
    id: sampleMapId,
    name: 'Kế hoạch content',
    layout: 'mind',
    rootNodeId,
    updatedAtMs: nowMs,
  };

  return {
    tasks: [
      { id: uid(), title: 'Viết báo cáo tuần', date: t, time: '10:00', pri: 'high', done: false },
      { id: uid(), title: 'Đặt lịch khám răng', date: t, time: '', pri: 'mid', done: false },
      { id: uid(), title: 'Trả lời email khách hàng', date: t, time: '', pri: 'low', done: true },
      { id: uid(), title: 'Nộp hóa đơn điện', date: addDays(t, -2), time: '', pri: 'high', done: false },
      { id: uid(), title: 'Mua quà sinh nhật', date: addDays(t, 2), time: '', pri: 'mid', done: false },
      { id: uid(), title: 'Lên kế hoạch chuyến đi', date: addDays(t, 4), time: '', pri: 'low', done: false },
    ],
    rem: [
      { id: uid(), title: 'Uống thuốc', date: t, time: '20:00', done: false },
      { id: uid(), title: 'Họp nhóm', date: addDays(t, 1), time: '09:30', done: false },
      { id: uid(), title: 'Gọi cho bố mẹ', date: addDays(t, -1), time: '19:00', done: false },
    ],
    incGoal: 20000000,
    incCols: [
      { id: colRev, name: 'Review', kind: 'in', monthScope: '', hiddenMonths: [], sortOrder: 0 },
      { id: colPhoto, name: 'Chụp hình', kind: 'in', monthScope: '', hiddenMonths: [], sortOrder: 1 },
      { id: colFarmers, name: 'The Farmers', kind: 'in', monthScope: '', hiddenMonths: [], sortOrder: 2 },
      { id: colTravel, name: 'Đi lại', kind: 'out', monthScope: '', hiddenMonths: [], sortOrder: 3 },
      { id: colGear, name: 'Thiết bị', kind: 'out', monthScope: '', hiddenMonths: [], sortOrder: 4 },
      { id: colAds, name: 'Quảng cáo', kind: 'out', monthScope: '', hiddenMonths: [], sortOrder: 5 },
    ],
    incItems: [
      { id: uid(), colId: colFarmers, date: `${m}-08`, amount: 8000000, client: 'The Farmers', note: '', paid: true, due: '' },
      { id: uid(), colId: colPhoto, date: `${m}-09`, amount: 3500000, client: 'AEON MALL HUE', note: '', paid: true, due: '' },
      { id: uid(), colId: colPhoto, date: `${m}-13`, amount: 3500000, client: '', note: '', paid: true, due: '' },
      { id: uid(), colId: colPhoto, date: `${m}-28`, amount: 2000000, client: '', note: '', paid: false, due: '' },
    ],
    notes: [
      {
        id: uid(),
        body: 'Ý tưởng video: một ngày làm việc ở quán cà phê\nQuay cận cảnh, nhạc nhẹ, dài khoảng 30 giây.',
        tag: 'Ý tưởng',
        pin: true,
        updatedAtMs: nowMs,
      },
      {
        id: uid(),
        body: 'Caption mẫu\nCuối tuần là để chậm lại một chút.',
        tag: 'Caption',
        pin: false,
        updatedAtMs: nowMs - 1000,
      },
    ],
    maps: [sampleMap],
    mapNodes: { [sampleMapId]: nodes },
    theme: 'system',
  };
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const quote = (v: string | number | null | undefined) =>
    `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = `\ufeffsep=,\r\n${rows.map((r) => r.map(quote).join(',')).join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
