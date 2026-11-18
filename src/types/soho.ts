export type ViewKey =
  | 'dashboard'
  | 'cong-viec'
  | 'thu-nhap'
  | 'nhac-viec'
  | 'ghi-chu'
  | 'mindmap';

export type Priority = 'high' | 'mid' | 'low';
export type ThemeMode = 'system' | 'light' | 'dark';
export type MindmapLayout = 'mind' | 'logic' | 'org';

export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or ''
  pri: Priority;
  done: boolean;
}

export interface Reminder {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or ''
  done: boolean;
}

export interface IncomeColumn {
  id: string;
  name: string;
  kind: 'in' | 'out';
  monthScope: string; // '' for all months or 'YYYY-MM'
  hiddenMonths: string[];
  sortOrder: number;
}

export interface IncomeItem {
  id: string;
  colId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  client: string;
  note: string;
  paid: boolean;
  due: string; // '' or YYYY-MM-DD
}

export interface Note {
  id: string;
  body: string;
  tag: string;
  pin: boolean;
  updatedAtMs: number;
}

export interface MindmapMeta {
  id: string;
  name: string;
  layout: MindmapLayout;
  rootNodeId: string;
  updatedAtMs: number;
}

export interface MindmapNode {
  id: string;
  mapId: string;
  parentId: string; // '' for root
  text: string;
  collapsed: boolean;
  sortOrder: number;
}

export interface SohoState {
  tasks: Task[];
  rem: Reminder[];
  incGoal: number;
  incCols: IncomeColumn[];
  incItems: IncomeItem[];
  notes: Note[];
  maps: MindmapMeta[];
  mapNodes: Record<string, MindmapNode[]>;
  theme: ThemeMode;
}

export const FIELD_LIMITS = {
  titleMax: 300,
  colNameMax: 80,
  clientMax: 160,
  noteTextMax: 400,
  noteBodyMax: 20000,
  noteTagMax: 60,
  mapNameMax: 160,
  nodeTextMax: 200,
  hiddenMonthsMax: 60,
  maxAmount: 100000000000,
} as const;

export const REGEX_PATTERNS = {
  id: /^[a-zA-Z0-9_-]+$/,
  date: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  time: /^([0-2][0-9]:[0-5][0-9])?$/,
  month: /^([0-9]{4}-[0-9]{2})?$/,
} as const;
