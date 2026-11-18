import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  FIELD_LIMITS,
  IncomeColumn,
  IncomeItem,
  MindmapLayout,
  MindmapMeta,
  MindmapNode,
  Note,
  Priority,
  Reminder,
  SohoState,
  Task,
  ThemeMode,
} from '../types/soho';
import {
  MINDMAP_TEMPLATES,
  createDefaultState,
  flattenTemplateTree,
  today,
  uid,
} from '../lib/dateUtils';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';

const LOCAL_KEY = 'viec-ca-nhan-v1';
const DIRTY_KEY = 'soho-local-edited-v1';

interface LegacyMindNode {
  id?: string;
  t?: string;
  x?: boolean;
  c?: LegacyMindNode[];
}

function clampStr(v: string, max: number): string {
  return v.slice(0, max);
}

function loadLocalState(): SohoState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const def = createDefaultState();

      const tasks: Task[] = Array.isArray(parsed.tasks)
        ? parsed.tasks.map((t: Record<string, unknown>) => ({
            id: String(t.id || uid()),
            title: clampStr(String(t.title || ''), FIELD_LIMITS.titleMax),
            date: String(t.date || today()),
            time: String(t.time || ''),
            pri: (t.pri === 'high' || t.pri === 'mid' || t.pri === 'low' ? t.pri : 'mid') as Priority,
            done: Boolean(t.done),
          }))
        : def.tasks;

      const rem: Reminder[] = Array.isArray(parsed.rem)
        ? parsed.rem.map((r: Record<string, unknown>) => ({
            id: String(r.id || uid()),
            title: clampStr(String(r.title || ''), FIELD_LIMITS.titleMax),
            date: String(r.date || today()),
            time: String(r.time || ''),
            done: Boolean(r.done),
          }))
        : def.rem;

      let incGoal = def.incGoal;
      let incCols = def.incCols;
      let incItems = def.incItems;

      if (parsed.inc && typeof parsed.inc === 'object') {
        const inc = parsed.inc as Record<string, unknown>;
        incGoal = typeof inc.goal === 'number' ? inc.goal : def.incGoal;
        if (Array.isArray(inc.cols)) {
          incCols = inc.cols.map((c: Record<string, unknown>, idx: number) => ({
            id: String(c.id || uid()),
            name: clampStr(String(c.name || 'Hạng mục'), FIELD_LIMITS.colNameMax),
            kind: (c.kind === 'out' ? 'out' : 'in') as 'in' | 'out',
            monthScope: String(c.m || c.monthScope || ''),
            hiddenMonths: Array.isArray(c.hide || c.hiddenMonths)
              ? ((c.hide || c.hiddenMonths) as unknown[]).map(String).slice(0, FIELD_LIMITS.hiddenMonthsMax)
              : [],
            sortOrder: typeof c.sortOrder === 'number' ? c.sortOrder : idx,
          }));
        }
        if (Array.isArray(inc.items)) {
          incItems = inc.items.map((it: Record<string, unknown>) => ({
            id: String(it.id || uid()),
            colId: String(it.col || it.colId || ''),
            date: String(it.date || today()),
            amount: Math.max(1, Math.min(FIELD_LIMITS.maxAmount, Number(it.amount) || 0)),
            client: clampStr(String(it.client || ''), FIELD_LIMITS.clientMax),
            note: clampStr(String(it.note || ''), FIELD_LIMITS.noteTextMax),
            paid: Boolean(it.paid),
            due: String(it.due || ''),
          }));
        }
      } else if (Array.isArray(parsed.incCols)) {
        incGoal = typeof parsed.incGoal === 'number' ? parsed.incGoal : def.incGoal;
        incCols = parsed.incCols as IncomeColumn[];
        incItems = Array.isArray(parsed.incItems) ? (parsed.incItems as IncomeItem[]) : [];
      }

      const notes: Note[] = Array.isArray(parsed.notes)
        ? parsed.notes.map((n: Record<string, unknown>) => ({
            id: String(n.id || uid()),
            body: clampStr(String(n.body || ''), FIELD_LIMITS.noteBodyMax),
            tag: clampStr(String(n.tag || ''), FIELD_LIMITS.noteTagMax),
            pin: Boolean(n.pin),
            updatedAtMs: Number(n.upd || n.updatedAtMs || Date.now()),
          }))
        : def.notes;

      const maps: MindmapMeta[] = [];
      const mapNodes: Record<string, MindmapNode[]> = {};

      if (Array.isArray(parsed.maps)) {
        for (const rawMap of parsed.maps as Record<string, unknown>[]) {
          const mapId = String(rawMap.id || uid());
          const layout = (
            rawMap.layout === 'mind' || rawMap.layout === 'logic' || rawMap.layout === 'org'
              ? rawMap.layout
              : 'mind'
          ) as MindmapLayout;
          const updatedAtMs = Number(rawMap.upd || rawMap.updatedAtMs || Date.now());

          if (rawMap.root && typeof rawMap.root === 'object') {
            const flatNodes: MindmapNode[] = [];
            const walkLegacy = (ln: LegacyMindNode, parentId: string, sortOrder: number): string => {
              const nid = String(ln.id || uid());
              flatNodes.push({
                id: nid,
                mapId,
                parentId,
                text: clampStr(String(ln.t || 'Nhánh'), FIELD_LIMITS.nodeTextMax),
                collapsed: Boolean(ln.x),
                sortOrder,
              });
              if (Array.isArray(ln.c)) {
                ln.c.forEach((child, idx) => walkLegacy(child, nid, idx));
              }
              return nid;
            };
            const rootNodeId = walkLegacy(rawMap.root as LegacyMindNode, '', 0);
            maps.push({
              id: mapId,
              name: clampStr(String(rawMap.name || 'Sơ đồ'), FIELD_LIMITS.mapNameMax),
              layout,
              rootNodeId,
              updatedAtMs,
            });
            mapNodes[mapId] = flatNodes;
          } else if (typeof rawMap.rootNodeId === 'string') {
            maps.push({
              id: mapId,
              name: clampStr(String(rawMap.name || 'Sơ đồ'), FIELD_LIMITS.mapNameMax),
              layout,
              rootNodeId: rawMap.rootNodeId,
              updatedAtMs,
            });
            const storedNodes = (parsed.mapNodes as Record<string, MindmapNode[]> | undefined)?.[mapId];
            mapNodes[mapId] = Array.isArray(storedNodes) ? storedNodes : [];
          }
        }
      } else {
        maps.push(...def.maps);
        Object.assign(mapNodes, def.mapNodes);
      }

      const theme = (
        parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
          ? parsed.theme
          : 'system'
      ) as ThemeMode;

      return {
        tasks,
        rem,
        incGoal,
        incCols,
        incItems,
        notes,
        maps,
        mapNodes,
        theme,
      };
    }
  } catch {
    // ignore corrupt localStorage
  }
  return createDefaultState();
}

function persistLocalState(state: SohoState, markEdited: boolean): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    if (markEdited) {
      localStorage.setItem(DIRTY_KEY, '1');
    }
  } catch {
    // ignore quota error
  }
}

interface SohoContextValue {
  state: SohoState;
  user: User | null;
  authReady: boolean;
  syncing: boolean;
  pendingMergePrompt: boolean;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  resolveMergeKeepCloud: () => void;
  resolveMergeUploadLocal: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;

  // Tasks
  addTask: (input: Omit<Task, 'id' | 'done'>) => Promise<void>;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  // Reminders
  addReminder: (input: Omit<Reminder, 'id' | 'done'>) => Promise<void>;
  updateReminder: (id: string, patch: Partial<Omit<Reminder, 'id'>>) => Promise<void>;
  toggleReminder: (id: string) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;

  // Income
  setMonthlyGoal: (goal: number) => Promise<void>;
  addIncomeColumn: (input: { name: string; kind: 'in' | 'out'; monthScope: string }) => Promise<void>;
  hideIncomeColumnInMonth: (colId: string, ym: string) => Promise<void>;
  showIncomeColumnInMonth: (colId: string, ym: string) => Promise<void>;
  deleteIncomeColumn: (colId: string) => Promise<void>;
  addIncomeItem: (input: Omit<IncomeItem, 'id'>) => Promise<void>;
  updateIncomeItem: (id: string, patch: Partial<Omit<IncomeItem, 'id'>>) => Promise<void>;
  toggleIncomeItemPaid: (id: string) => Promise<void>;
  deleteIncomeItem: (id: string) => Promise<void>;

  // Notes
  createNote: (tag?: string) => Promise<string>;
  updateNote: (id: string, patch: Partial<Omit<Note, 'id'>>) => Promise<void>;
  toggleNotePin: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  // Mindmaps
  createMindmapFromTemplate: (templateKey: string) => Promise<{ mapId: string; rootNodeId: string }>;
  updateMindmapMeta: (mapId: string, patch: { name?: string; layout?: MindmapLayout }) => Promise<void>;
  deleteMindmap: (mapId: string) => Promise<void>;
  addMindmapNode: (mapId: string, parentId: string, text?: string, insertAfterOrder?: number) => Promise<string>;
  updateMindmapNode: (mapId: string, nodeId: string, patch: Partial<Pick<MindmapNode, 'text' | 'collapsed' | 'sortOrder'>>) => Promise<void>;
  deleteMindmapNodeSubtree: (mapId: string, nodeId: string) => Promise<void>;
}

const SohoContext = createContext<SohoContextValue | null>(null);

export const SohoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SohoState>(() => loadLocalState());
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingMergePrompt, setPendingMergePrompt] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  // Apply theme to <html>
  useEffect(() => {
    const applyTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = state.theme === 'dark' || (state.theme === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.setAttribute('data-theme', state.theme);
    };
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [state.theme]);

  const uploadStateToCloud = useCallback(async (uidStr: string, source: SohoState) => {
    const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

    ops.push((batch) =>
      batch.set(doc(db, 'users', uidStr, 'settings', 'preferences'), {
        ownerId: uidStr,
        monthlyGoal: Math.max(0, Math.round(source.incGoal)),
        theme: source.theme,
        updatedAt: serverTimestamp(),
      })
    );

    for (const t of source.tasks) {
      ops.push((batch) =>
        batch.set(doc(db, 'users', uidStr, 'tasks', t.id), {
          ownerId: uidStr,
          title: clampStr(t.title.trim() || 'Việc cần làm', FIELD_LIMITS.titleMax),
          date: t.date,
          time: t.time || '',
          pri: t.pri,
          done: t.done,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    for (const r of source.rem) {
      ops.push((batch) =>
        batch.set(doc(db, 'users', uidStr, 'reminders', r.id), {
          ownerId: uidStr,
          title: clampStr(r.title.trim() || 'Nhắc việc', FIELD_LIMITS.titleMax),
          date: r.date,
          time: r.time || '',
          done: r.done,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    for (const c of source.incCols) {
      ops.push((batch) =>
        batch.set(doc(db, 'users', uidStr, 'incomeColumns', c.id), {
          ownerId: uidStr,
          name: clampStr(c.name.trim() || 'Hạng mục', FIELD_LIMITS.colNameMax),
          kind: c.kind,
          monthScope: c.monthScope || '',
          hiddenMonths: c.hiddenMonths.slice(0, FIELD_LIMITS.hiddenMonthsMax),
          sortOrder: c.sortOrder,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    const validColIds = new Set(source.incCols.map((c) => c.id));
    for (const item of source.incItems) {
      if (!validColIds.has(item.colId) || item.amount <= 0) continue;
      ops.push((batch) =>
        batch.set(doc(db, 'users', uidStr, 'incomeItems', item.id), {
          ownerId: uidStr,
          colId: item.colId,
          date: item.date,
          amount: Math.max(1, Math.min(FIELD_LIMITS.maxAmount, Math.round(item.amount))),
          client: clampStr(item.client, FIELD_LIMITS.clientMax),
          note: clampStr(item.note, FIELD_LIMITS.noteTextMax),
          paid: item.paid,
          due: item.due || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    for (const n of source.notes) {
      ops.push((batch) =>
        batch.set(doc(db, 'users', uidStr, 'notes', n.id), {
          ownerId: uidStr,
          body: clampStr(n.body, FIELD_LIMITS.noteBodyMax),
          tag: clampStr(n.tag, FIELD_LIMITS.noteTagMax),
          pin: n.pin,
          updatedAtMs: n.updatedAtMs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    for (const m of source.maps) {
      ops.push((batch) =>
        batch.set(doc(db, 'users', uidStr, 'mindmaps', m.id), {
          ownerId: uidStr,
          name: clampStr(m.name.trim() || 'Sơ đồ', FIELD_LIMITS.mapNameMax),
          layout: m.layout,
          rootNodeId: m.rootNodeId,
          updatedAtMs: m.updatedAtMs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
      const nodes = source.mapNodes[m.id] || [];
      // Ensure parents precede children in batch order
      const sortedNodes = [...nodes].sort((a, b) => (a.parentId === '' ? -1 : b.parentId === '' ? 1 : 0));
      for (const nd of sortedNodes) {
        ops.push((batch) =>
          batch.set(doc(db, 'users', uidStr, 'mindmaps', m.id, 'nodes', nd.id), {
            ownerId: uidStr,
            mapId: m.id,
            parentId: nd.parentId,
            text: clampStr(nd.text.trim() || 'Nhánh', FIELD_LIMITS.nodeTextMax),
            collapsed: nd.collapsed,
            sortOrder: nd.sortOrder,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
    }

    // Commit in chunks of 400
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      ops.slice(i, i + 400).forEach((fn) => fn(batch));
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uidStr}`);
      }
    }
  }, []);

  // Auth listener & Firestore real-time subscriptions
  useEffect(() => {
    let unsubscribes: Array<() => void> = [];
    let nodeUnsubs: Record<string, () => void> = {};

    const cleanupListeners = () => {
      unsubscribes.forEach((u) => u());
      unsubscribes = [];
      Object.values(nodeUnsubs).forEach((u) => u());
      nodeUnsubs = {};
    };

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      cleanupListeners();

      if (!firebaseUser || !firebaseUser.emailVerified) {
        setUser(null);
        setAuthReady(true);
        setSyncing(false);
        setPendingMergePrompt(false);
        setState(loadLocalState());
        return;
      }

      setUser(firebaseUser);
      setAuthReady(true);
      setSyncing(true);

      const uidStr = firebaseUser.uid;
      const profilePath = `users/${uidStr}/private/profile`;
      try {
        const profileRef = doc(db, 'users', uidStr, 'private', 'profile');
        const profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) {
          await setDoc(profileRef, {
            uid: uidStr,
            email: clampStr(firebaseUser.email || '', 254),
            displayName: clampStr(firebaseUser.displayName || 'Người dùng SOHO', 120),
            photoURL: clampStr(firebaseUser.photoURL || '', 500),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(profileRef, {
            email: clampStr(firebaseUser.email || '', 254),
            displayName: clampStr(firebaseUser.displayName || 'Người dùng SOHO', 120),
            photoURL: clampStr(firebaseUser.photoURL || '', 500),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, profilePath);
      }

      // Check if cloud workspace has data yet
      try {
        const [colsSnap, tasksSnap, notesSnap, mapsSnap] = await Promise.all([
          getDocs(query(collection(db, 'users', uidStr, 'incomeColumns'), where('ownerId', '==', uidStr))),
          getDocs(query(collection(db, 'users', uidStr, 'tasks'), where('ownerId', '==', uidStr))),
          getDocs(query(collection(db, 'users', uidStr, 'notes'), where('ownerId', '==', uidStr))),
          getDocs(query(collection(db, 'users', uidStr, 'mindmaps'), where('ownerId', '==', uidStr))),
        ]);

        const cloudEmpty =
          colsSnap.empty && tasksSnap.empty && notesSnap.empty && mapsSnap.empty;

        if (cloudEmpty) {
          await uploadStateToCloud(uidStr, loadLocalState());
          localStorage.removeItem(DIRTY_KEY);
          showToast('Đã đồng bộ dữ liệu lên đám mây');
        } else if (localStorage.getItem(DIRTY_KEY) === '1') {
          setPendingMergePrompt(true);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, `users/${uidStr}`);
      }

      // Subscribe to real-time collections
      const prefPath = `users/${uidStr}/settings/preferences`;
      unsubscribes.push(
        onSnapshot(
          doc(db, 'users', uidStr, 'settings', 'preferences'),
          (snap) => {
            if (snap.exists()) {
              const d = snap.data();
              setState((prev) => ({
                ...prev,
                incGoal: typeof d.monthlyGoal === 'number' ? d.monthlyGoal : prev.incGoal,
                theme: (d.theme === 'light' || d.theme === 'dark' || d.theme === 'system'
                  ? d.theme
                  : prev.theme) as ThemeMode,
              }));
            }
            setSyncing(false);
          },
          (err) => handleFirestoreError(err, OperationType.GET, prefPath)
        )
      );

      const tasksPath = `users/${uidStr}/tasks`;
      unsubscribes.push(
        onSnapshot(
          query(collection(db, 'users', uidStr, 'tasks'), where('ownerId', '==', uidStr)),
          (snap) => {
            const list: Task[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                title: String(data.title || ''),
                date: String(data.date || today()),
                time: String(data.time || ''),
                pri: (data.pri === 'high' || data.pri === 'mid' || data.pri === 'low'
                  ? data.pri
                  : 'mid') as Priority,
                done: Boolean(data.done),
              };
            });
            setState((prev) => ({ ...prev, tasks: list }));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, tasksPath)
        )
      );

      const remPath = `users/${uidStr}/reminders`;
      unsubscribes.push(
        onSnapshot(
          query(collection(db, 'users', uidStr, 'reminders'), where('ownerId', '==', uidStr)),
          (snap) => {
            const list: Reminder[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                title: String(data.title || ''),
                date: String(data.date || today()),
                time: String(data.time || ''),
                done: Boolean(data.done),
              };
            });
            setState((prev) => ({ ...prev, rem: list }));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, remPath)
        )
      );

      const colsPath = `users/${uidStr}/incomeColumns`;
      unsubscribes.push(
        onSnapshot(
          query(collection(db, 'users', uidStr, 'incomeColumns'), where('ownerId', '==', uidStr)),
          (snap) => {
            const list: IncomeColumn[] = snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  name: String(data.name || ''),
                  kind: (data.kind === 'out' ? 'out' : 'in') as 'in' | 'out',
                  monthScope: String(data.monthScope || ''),
                  hiddenMonths: Array.isArray(data.hiddenMonths)
                    ? data.hiddenMonths.map(String)
                    : [],
                  sortOrder: Number(data.sortOrder ?? 0),
                };
              })
              .sort((a, b) => a.sortOrder - b.sortOrder);
            setState((prev) => ({ ...prev, incCols: list }));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, colsPath)
        )
      );

      const itemsPath = `users/${uidStr}/incomeItems`;
      unsubscribes.push(
        onSnapshot(
          query(collection(db, 'users', uidStr, 'incomeItems'), where('ownerId', '==', uidStr)),
          (snap) => {
            const list: IncomeItem[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                colId: String(data.colId || ''),
                date: String(data.date || today()),
                amount: Number(data.amount || 0),
                client: String(data.client || ''),
                note: String(data.note || ''),
                paid: Boolean(data.paid),
                due: String(data.due || ''),
              };
            });
            setState((prev) => ({ ...prev, incItems: list }));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, itemsPath)
        )
      );

      const notesPath = `users/${uidStr}/notes`;
      unsubscribes.push(
        onSnapshot(
          query(collection(db, 'users', uidStr, 'notes'), where('ownerId', '==', uidStr)),
          (snap) => {
            const list: Note[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                body: String(data.body || ''),
                tag: String(data.tag || ''),
                pin: Boolean(data.pin),
                updatedAtMs: Number(data.updatedAtMs || Date.now()),
              };
            });
            setState((prev) => ({ ...prev, notes: list }));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, notesPath)
        )
      );

      const mapsPath = `users/${uidStr}/mindmaps`;
      unsubscribes.push(
        onSnapshot(
          query(collection(db, 'users', uidStr, 'mindmaps'), where('ownerId', '==', uidStr)),
          (snap) => {
            const list: MindmapMeta[] = snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  name: String(data.name || ''),
                  layout: (data.layout === 'mind' || data.layout === 'logic' || data.layout === 'org'
                    ? data.layout
                    : 'mind') as MindmapLayout,
                  rootNodeId: String(data.rootNodeId || ''),
                  updatedAtMs: Number(data.updatedAtMs || Date.now()),
                };
              })
              .sort((a, b) => b.updatedAtMs - a.updatedAtMs);

            const activeIds = new Set(list.map((m) => m.id));
            Object.keys(nodeUnsubs).forEach((mid) => {
              if (!activeIds.has(mid)) {
                nodeUnsubs[mid]();
                delete nodeUnsubs[mid];
              }
            });

            for (const m of list) {
              if (!nodeUnsubs[m.id]) {
                const nodesPath = `users/${uidStr}/mindmaps/${m.id}/nodes`;
                nodeUnsubs[m.id] = onSnapshot(
                  query(
                    collection(db, 'users', uidStr, 'mindmaps', m.id, 'nodes'),
                    where('ownerId', '==', uidStr),
                    where('mapId', '==', m.id)
                  ),
                  (nSnap) => {
                    const nList: MindmapNode[] = nSnap.docs
                      .map((nd) => {
                        const data = nd.data();
                        return {
                          id: nd.id,
                          mapId: String(data.mapId || m.id),
                          parentId: String(data.parentId || ''),
                          text: String(data.text || ''),
                          collapsed: Boolean(data.collapsed),
                          sortOrder: Number(data.sortOrder ?? 0),
                        };
                      })
                      .sort((a, b) => a.sortOrder - b.sortOrder);
                    setState((prev) => ({
                      ...prev,
                      mapNodes: { ...prev.mapNodes, [m.id]: nList },
                    }));
                  },
                  (err) => handleFirestoreError(err, OperationType.LIST, nodesPath)
                );
              }
            }

            setState((prev) => ({ ...prev, maps: list }));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, mapsPath)
        )
      );
    });

    return () => {
      cleanupListeners();
      unsubAuth();
    };
  }, [showToast, uploadStateToCloud]);

  const mutateLocal = useCallback((updater: (prev: SohoState) => SohoState) => {
    setState((prev) => {
      const next = updater(prev);
      persistLocalState(next, true);
      return next;
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Đã đăng nhập và đồng bộ');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        showToast('Không thể đăng nhập lúc này. Hãy thử lại.');
      }
    }
  }, [showToast]);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
      localStorage.removeItem(DIRTY_KEY);
      showToast('Đã đăng xuất khỏi tài khoản đồng bộ');
    } catch {
      showToast('Không thể đăng xuất lúc này.');
    }
  }, [showToast]);

  const resolveMergeKeepCloud = useCallback(() => {
    localStorage.removeItem(DIRTY_KEY);
    setPendingMergePrompt(false);
    showToast('Đang sử dụng dữ liệu từ đám mây');
  }, [showToast]);

  const resolveMergeUploadLocal = useCallback(async () => {
    if (!user) return;
    const localSnapshot = loadLocalState();
    await uploadStateToCloud(user.uid, localSnapshot);
    localStorage.removeItem(DIRTY_KEY);
    setPendingMergePrompt(false);
    showToast('Đã gộp dữ liệu từ máy này lên đám mây');
  }, [showToast, uploadStateToCloud, user]);

  const setTheme = useCallback(
    async (theme: ThemeMode) => {
      if (!user) {
        mutateLocal((prev) => ({ ...prev, theme }));
        return;
      }
      const path = `users/${user.uid}/settings/preferences`;
      try {
        await setDoc(
          doc(db, 'users', user.uid, 'settings', 'preferences'),
          {
            ownerId: user.uid,
            monthlyGoal: Math.max(0, Math.round(stateRef.current.incGoal)),
            theme,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [mutateLocal, user]
  );

  // ===== Tasks =====
  const addTask = useCallback(
    async (input: Omit<Task, 'id' | 'done'>) => {
      const id = uid();
      const title = clampStr(input.title.trim(), FIELD_LIMITS.titleMax);
      if (!title) return;
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          tasks: [...prev.tasks, { id, ...input, title, done: false }],
        }));
        return;
      }
      const path = `users/${user.uid}/tasks/${id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'tasks', id), {
          ownerId: user.uid,
          title,
          date: input.date,
          time: input.time || '',
          pri: input.pri,
          done: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [mutateLocal, user]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Omit<Task, 'id'>>) => {
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
        return;
      }
      const cur = stateRef.current.tasks.find((t) => t.id === id);
      if (!cur) return;
      const path = `users/${user.uid}/tasks/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'tasks', id), {
          title: clampStr((patch.title ?? cur.title).trim() || cur.title, FIELD_LIMITS.titleMax),
          date: patch.date ?? cur.date,
          time: patch.time ?? cur.time,
          pri: patch.pri ?? cur.pri,
          done: patch.done ?? cur.done,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [mutateLocal, user]
  );

  const toggleTask = useCallback(
    async (id: string) => {
      const cur = stateRef.current.tasks.find((t) => t.id === id);
      if (!cur) return;
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        }));
        return;
      }
      const path = `users/${user.uid}/tasks/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'tasks', id), {
          done: !cur.done,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [mutateLocal, user]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== id),
        }));
        return;
      }
      const path = `users/${user.uid}/tasks/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'tasks', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [mutateLocal, user]
  );

  // ===== Reminders =====
  const addReminder = useCallback(
    async (input: Omit<Reminder, 'id' | 'done'>) => {
      const id = uid();
      const title = clampStr(input.title.trim(), FIELD_LIMITS.titleMax);
      if (!title) return;
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          rem: [...prev.rem, { id, ...input, title, done: false }],
        }));
        return;
      }
      const path = `users/${user.uid}/reminders/${id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'reminders', id), {
          ownerId: user.uid,
          title,
          date: input.date,
          time: input.time || '',
          done: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [mutateLocal, user]
  );

  const updateReminder = useCallback(
    async (id: string, patch: Partial<Omit<Reminder, 'id'>>) => {
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          rem: prev.rem.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }));
        return;
      }
      const cur = stateRef.current.rem.find((r) => r.id === id);
      if (!cur) return;
      const path = `users/${user.uid}/reminders/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'reminders', id), {
          title: clampStr((patch.title ?? cur.title).trim() || cur.title, FIELD_LIMITS.titleMax),
          date: patch.date ?? cur.date,
          time: patch.time ?? cur.time,
          done: patch.done ?? cur.done,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [mutateLocal, user]
  );

  const toggleReminder = useCallback(
    async (id: string) => {
      const cur = stateRef.current.rem.find((r) => r.id === id);
      if (!cur) return;
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          rem: prev.rem.map((r) => (r.id === id ? { ...r, done: !r.done } : r)),
        }));
        return;
      }
      const path = `users/${user.uid}/reminders/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'reminders', id), {
          done: !cur.done,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [mutateLocal, user]
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          rem: prev.rem.filter((r) => r.id !== id),
        }));
        return;
      }
      const path = `users/${user.uid}/reminders/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'reminders', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [mutateLocal, user]
  );

  // ===== Income =====
  const setMonthlyGoal = useCallback(
    async (goal: number) => {
      const safeGoal = Math.max(0, Math.min(FIELD_LIMITS.maxAmount, Math.round(goal) || 0));
      if (!user) {
        mutateLocal((prev) => ({ ...prev, incGoal: safeGoal }));
        return;
      }
      const path = `users/${user.uid}/settings/preferences`;
      try {
        await setDoc(
          doc(db, 'users', user.uid, 'settings', 'preferences'),
          {
            ownerId: user.uid,
            monthlyGoal: safeGoal,
            theme: stateRef.current.theme,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [mutateLocal, user]
  );

  const addIncomeColumn = useCallback(
    async (input: { name: string; kind: 'in' | 'out'; monthScope: string }) => {
      const name = clampStr(input.name.trim(), FIELD_LIMITS.colNameMax);
      if (!name) return;
      const id = uid();
      const sortOrder =
        stateRef.current.incCols.reduce((mx, c) => Math.max(mx, c.sortOrder), -1) + 1;

      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          incCols: [
            ...prev.incCols,
            {
              id,
              name,
              kind: input.kind,
              monthScope: input.monthScope,
              hiddenMonths: [],
              sortOrder,
            },
          ],
        }));
        return;
      }
      const path = `users/${user.uid}/incomeColumns/${id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'incomeColumns', id), {
          ownerId: user.uid,
          name,
          kind: input.kind,
          monthScope: input.monthScope,
          hiddenMonths: [],
          sortOrder,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [mutateLocal, user]
  );

  const hideIncomeColumnInMonth = useCallback(
    async (colId: string, ym: string) => {
      const col = stateRef.current.incCols.find((c) => c.id === colId);
      if (!col) return;
      const nextHidden = Array.from(new Set([...col.hiddenMonths, ym])).slice(
        0,
        FIELD_LIMITS.hiddenMonthsMax
      );
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          incCols: prev.incCols.map((c) =>
            c.id === colId ? { ...c, hiddenMonths: nextHidden } : c
          ),
        }));
        return;
      }
      const path = `users/${user.uid}/incomeColumns/${colId}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'incomeColumns', colId), {
          hiddenMonths: nextHidden,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [mutateLocal, user]
  );

  const showIncomeColumnInMonth = useCallback(
    async (colId: string, ym: string) => {
      const col = stateRef.current.incCols.find((c) => c.id === colId);
      if (!col) return;
      const nextHidden = col.hiddenMonths.filter((m) => m !== ym);
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          incCols: prev.incCols.map((c) =>
            c.id === colId ? { ...c, hiddenMonths: nextHidden } : c
          ),
        }));
        return;
      }
      const path = `users/${user.uid}/incomeColumns/${colId}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'incomeColumns', colId), {
          hiddenMonths: nextHidden,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [mutateLocal, user]
  );

  const deleteIncomeColumn = useCallback(
    async (colId: string) => {
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          incCols: prev.incCols.filter((c) => c.id !== colId),
        }));
        return;
      }
      const path = `users/${user.uid}/incomeColumns/${colId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'incomeColumns', colId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [mutateLocal, user]
  );

  const addIncomeItem = useCallback(
    async (input: Omit<IncomeItem, 'id'>) => {
      const amount = Math.max(0, Math.min(FIELD_LIMITS.maxAmount, Math.round(input.amount) || 0));
      if (!amount) return;
      const id = uid();
      const safeItem: IncomeItem = {
        id,
        colId: input.colId,
        date: input.date,
        amount,
        client: clampStr(input.client.trim(), FIELD_LIMITS.clientMax),
        note: clampStr(input.note.trim(), FIELD_LIMITS.noteTextMax),
        paid: input.paid,
        due: input.due || '',
      };

      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          incItems: [...prev.incItems, safeItem],
        }));
        return;
      }
      const path = `users/${user.uid}/incomeItems/${id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'incomeItems', id), {
          ownerId: user.uid,
          colId: safeItem.colId,
          date: safeItem.date,
          amount: safeItem.amount,
          client: safeItem.client,
          note: safeItem.note,
          paid: safeItem.paid,
          due: safeItem.due,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [mutateLocal, user]
  );

  const updateIncomeItem = useCallback(
    async (id: string, patch: Partial<Omit<IncomeItem, 'id'>>) => {
      const cur = stateRef.current.incItems.find((i) => i.id === id);
      if (!cur) return;
      const amount = Math.max(
        1,
        Math.min(FIELD_LIMITS.maxAmount, Math.round(patch.amount ?? cur.amount) || cur.amount)
      );
      const next = {
        colId: patch.colId ?? cur.colId,
        date: patch.date ?? cur.date,
        amount,
        client: clampStr((patch.client ?? cur.client).trim(), FIELD_LIMITS.clientMax),
        note: clampStr((patch.note ?? cur.note).trim(), FIELD_LIMITS.noteTextMax),
        paid: patch.paid ?? cur.paid,
        due: patch.due ?? cur.due,
      };

      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          incItems: prev.incItems.map((i) => (i.id === id ? { ...i, ...next } : i)),
        }));
        return;
      }
      const path = `users/${user.uid}/incomeItems/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'incomeItems', id), {
          ...next,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [mutateLocal, user]
  );

  const toggleIncomeItemPaid = useCallback(
    async (id: string) => {
      const cur = stateRef.current.incItems.find((i) => i.id === id);
      if (!cur) return;
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          incItems: prev.incItems.map((i) => (i.id === id ? { ...i, paid: !i.paid } : i)),
        }));
        return;
      }
      const path = `users/${user.uid}/incomeItems/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'incomeItems', id), {
          paid: !cur.paid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [mutateLocal, user]
  );

  const deleteIncomeItem = useCallback(
    async (id: string) => {
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          incItems: prev.incItems.filter((i) => i.id !== id),
        }));
        return;
      }
      const path = `users/${user.uid}/incomeItems/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'incomeItems', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [mutateLocal, user]
  );

  // ===== Notes =====
  const createNote = useCallback(
    async (tag = ''): Promise<string> => {
      const id = uid();
      const nowMs = Date.now();
      const safeTag = clampStr(tag.trim(), FIELD_LIMITS.noteTagMax);
      const newNote: Note = {
        id,
        body: '',
        tag: safeTag,
        pin: false,
        updatedAtMs: nowMs,
      };
      if (!user) {
        mutateLocal((prev) => ({ ...prev, notes: [newNote, ...prev.notes] }));
        return id;
      }
      const path = `users/${user.uid}/notes/${id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'notes', id), {
          ownerId: user.uid,
          body: '',
          tag: safeTag,
          pin: false,
          updatedAtMs: nowMs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
      return id;
    },
    [mutateLocal, user]
  );

  const updateNote = useCallback(
    async (id: string, patch: Partial<Omit<Note, 'id'>>) => {
      const cur = stateRef.current.notes.find((n) => n.id === id);
      if (!cur) return;
      const nowMs = Date.now();
      const body = clampStr(patch.body ?? cur.body, FIELD_LIMITS.noteBodyMax);
      const tag = clampStr((patch.tag ?? cur.tag).trim(), FIELD_LIMITS.noteTagMax);
      const pin = patch.pin ?? cur.pin;

      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          notes: prev.notes.map((n) =>
            n.id === id ? { ...n, body, tag, pin, updatedAtMs: nowMs } : n
          ),
        }));
        return;
      }
      const path = `users/${user.uid}/notes/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'notes', id), {
          body,
          tag,
          pin,
          updatedAtMs: nowMs,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [mutateLocal, user]
  );

  const toggleNotePin = useCallback(
    async (id: string) => {
      const cur = stateRef.current.notes.find((n) => n.id === id);
      if (!cur) return;
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          notes: prev.notes.map((n) => (n.id === id ? { ...n, pin: !n.pin } : n)),
        }));
        return;
      }
      const path = `users/${user.uid}/notes/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'notes', id), {
          pin: !cur.pin,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [mutateLocal, user]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          notes: prev.notes.filter((n) => n.id !== id),
        }));
        return;
      }
      const path = `users/${user.uid}/notes/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'notes', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [mutateLocal, user]
  );

  // ===== Mindmaps =====
  const createMindmapFromTemplate = useCallback(
    async (templateKey: string): Promise<{ mapId: string; rootNodeId: string }> => {
      const tpl = MINDMAP_TEMPLATES[templateKey] || MINDMAP_TEMPLATES.mind;
      const mapId = uid();
      const nowMs = Date.now();
      const { rootNodeId, nodes } = flattenTemplateTree(mapId, tpl.root);
      const meta: MindmapMeta = {
        id: mapId,
        name: clampStr(tpl.name, FIELD_LIMITS.mapNameMax),
        layout: tpl.layout,
        rootNodeId,
        updatedAtMs: nowMs,
      };

      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          maps: [meta, ...prev.maps],
          mapNodes: { ...prev.mapNodes, [mapId]: nodes },
        }));
        return { mapId, rootNodeId };
      }

      const path = `users/${user.uid}/mindmaps/${mapId}`;
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'users', user.uid, 'mindmaps', mapId), {
          ownerId: user.uid,
          name: meta.name,
          layout: meta.layout,
          rootNodeId,
          updatedAtMs: nowMs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        for (const nd of nodes) {
          batch.set(doc(db, 'users', user.uid, 'mindmaps', mapId, 'nodes', nd.id), {
            ownerId: user.uid,
            mapId,
            parentId: nd.parentId,
            text: clampStr(nd.text, FIELD_LIMITS.nodeTextMax),
            collapsed: nd.collapsed,
            sortOrder: nd.sortOrder,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
      return { mapId, rootNodeId };
    },
    [mutateLocal, user]
  );

  const updateMindmapMeta = useCallback(
    async (mapId: string, patch: { name?: string; layout?: MindmapLayout }) => {
      const cur = stateRef.current.maps.find((m) => m.id === mapId);
      if (!cur) return;
      const nowMs = Date.now();
      const name = clampStr((patch.name ?? cur.name).trim() || cur.name, FIELD_LIMITS.mapNameMax);
      const layout = patch.layout ?? cur.layout;

      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          maps: prev.maps.map((m) =>
            m.id === mapId ? { ...m, name, layout, updatedAtMs: nowMs } : m
          ),
        }));
        return;
      }

      const path = `users/${user.uid}/mindmaps/${mapId}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'mindmaps', mapId), {
          name,
          layout,
          updatedAtMs: nowMs,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [mutateLocal, user]
  );

  const deleteMindmap = useCallback(
    async (mapId: string) => {
      if (!user) {
        mutateLocal((prev) => {
          const nextNodes = { ...prev.mapNodes };
          delete nextNodes[mapId];
          return {
            ...prev,
            maps: prev.maps.filter((m) => m.id !== mapId),
            mapNodes: nextNodes,
          };
        });
        return;
      }

      const path = `users/${user.uid}/mindmaps/${mapId}`;
      try {
        const nodes = stateRef.current.mapNodes[mapId] || [];
        const batch = writeBatch(db);
        for (const nd of nodes) {
          batch.delete(doc(db, 'users', user.uid, 'mindmaps', mapId, 'nodes', nd.id));
        }
        batch.delete(doc(db, 'users', user.uid, 'mindmaps', mapId));
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [mutateLocal, user]
  );

  const addMindmapNode = useCallback(
    async (
      mapId: string,
      parentId: string,
      text = 'Nhánh mới',
      insertAfterOrder?: number
    ): Promise<string> => {
      const nodeId = uid();
      const existingNodes = stateRef.current.mapNodes[mapId] || [];
      const siblings = existingNodes.filter((n) => n.parentId === parentId);
      const sortOrder =
        insertAfterOrder !== undefined
          ? insertAfterOrder
          : siblings.reduce((mx, n) => Math.max(mx, n.sortOrder), -1) + 1;

      const safeText = clampStr(text.trim() || 'Nhánh mới', FIELD_LIMITS.nodeTextMax);
      const newNode: MindmapNode = {
        id: nodeId,
        mapId,
        parentId,
        text: safeText,
        collapsed: false,
        sortOrder,
      };

      if (!user) {
        mutateLocal((prev) => {
          const list = (prev.mapNodes[mapId] || []).map((n) =>
            n.id === parentId ? { ...n, collapsed: false } : n
          );
          return {
            ...prev,
            mapNodes: { ...prev.mapNodes, [mapId]: [...list, newNode] },
            maps: prev.maps.map((m) =>
              m.id === mapId ? { ...m, updatedAtMs: Date.now() } : m
            ),
          };
        });
        return nodeId;
      }

      const path = `users/${user.uid}/mindmaps/${mapId}/nodes/${nodeId}`;
      try {
        const batch = writeBatch(db);
        const parentNode = existingNodes.find((n) => n.id === parentId);
        if (parentNode && parentNode.collapsed) {
          batch.update(doc(db, 'users', user.uid, 'mindmaps', mapId, 'nodes', parentId), {
            collapsed: false,
            updatedAt: serverTimestamp(),
          });
        }
        batch.set(doc(db, 'users', user.uid, 'mindmaps', mapId, 'nodes', nodeId), {
          ownerId: user.uid,
          mapId,
          parentId,
          text: safeText,
          collapsed: false,
          sortOrder,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
      return nodeId;
    },
    [mutateLocal, user]
  );

  const updateMindmapNode = useCallback(
    async (
      mapId: string,
      nodeId: string,
      patch: Partial<Pick<MindmapNode, 'text' | 'collapsed' | 'sortOrder'>>
    ) => {
      const nodes = stateRef.current.mapNodes[mapId] || [];
      const cur = nodes.find((n) => n.id === nodeId);
      if (!cur) return;

      const safeText = clampStr((patch.text ?? cur.text).trim() || cur.text, FIELD_LIMITS.nodeTextMax);
      const collapsed = patch.collapsed ?? cur.collapsed;
      const sortOrder = patch.sortOrder ?? cur.sortOrder;

      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          mapNodes: {
            ...prev.mapNodes,
            [mapId]: (prev.mapNodes[mapId] || []).map((n) =>
              n.id === nodeId ? { ...n, text: safeText, collapsed, sortOrder } : n
            ),
          },
        }));
        return;
      }

      const path = `users/${user.uid}/mindmaps/${mapId}/nodes/${nodeId}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'mindmaps', mapId, 'nodes', nodeId), {
          text: safeText,
          collapsed,
          sortOrder,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [mutateLocal, user]
  );

  const deleteMindmapNodeSubtree = useCallback(
    async (mapId: string, nodeId: string) => {
      const nodes = stateRef.current.mapNodes[mapId] || [];
      const toDelete = new Set<string>();
      const collect = (id: string) => {
        toDelete.add(id);
        nodes.filter((n) => n.parentId === id).forEach((child) => collect(child.id));
      };
      collect(nodeId);

      if (!user) {
        mutateLocal((prev) => ({
          ...prev,
          mapNodes: {
            ...prev.mapNodes,
            [mapId]: (prev.mapNodes[mapId] || []).filter((n) => !toDelete.has(n.id)),
          },
        }));
        return;
      }

      const path = `users/${user.uid}/mindmaps/${mapId}/nodes/${nodeId}`;
      try {
        const batch = writeBatch(db);
        toDelete.forEach((id) => {
          batch.delete(doc(db, 'users', user.uid, 'mindmaps', mapId, 'nodes', id));
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [mutateLocal, user]
  );

  return (
    <SohoContext.Provider
      value={{
        state,
        user,
        authReady,
        syncing,
        pendingMergePrompt,
        toastMessage,
        showToast,
        signInWithGoogle,
        signOutUser,
        resolveMergeKeepCloud,
        resolveMergeUploadLocal,
        setTheme,
        addTask,
        updateTask,
        toggleTask,
        deleteTask,
        addReminder,
        updateReminder,
        toggleReminder,
        deleteReminder,
        setMonthlyGoal,
        addIncomeColumn,
        hideIncomeColumnInMonth,
        showIncomeColumnInMonth,
        deleteIncomeColumn,
        addIncomeItem,
        updateIncomeItem,
        toggleIncomeItemPaid,
        deleteIncomeItem,
        createNote,
        updateNote,
        toggleNotePin,
        deleteNote,
        createMindmapFromTemplate,
        updateMindmapMeta,
        deleteMindmap,
        addMindmapNode,
        updateMindmapNode,
        deleteMindmapNodeSubtree,
      }}
    >
      {children}
    </SohoContext.Provider>
  );
};

export function useSoho(): SohoContextValue {
  const ctx = useContext(SohoContext);
  if (!ctx) throw new Error('useSoho must be used within SohoProvider');
  return ctx;
}
