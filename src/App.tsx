import React, { useCallback, useEffect, useState } from 'react';
import { ViewKey } from './types/soho';
import { SohoProvider, useSoho } from './context/SohoContext';
import { isColVisible, today } from './lib/dateUtils';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileNavigation, Sidebar } from './components/Navigation';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  AccountModal,
  MergeConflictModal,
  QuickAddModal,
} from './components/QuickAddModal';
import { DashboardView } from './views/DashboardView';
import { TasksView } from './views/TasksView';
import { IncomeView } from './views/IncomeView';
import { RemindersView } from './views/RemindersView';
import { NotesView } from './views/NotesView';
import { MindmapView } from './views/MindmapView';

const VALID_VIEWS: Record<string, ViewKey> = {
  dashboard: 'dashboard',
  'cong-viec': 'cong-viec',
  'thu-nhap': 'thu-nhap',
  'nhac-viec': 'nhac-viec',
  'ghi-chu': 'ghi-chu',
  mindmap: 'mindmap',
};

function getInitialView(): ViewKey {
  const h = window.location.hash.slice(1);
  return VALID_VIEWS[h] || 'dashboard';
}

const SohoShell: React.FC = () => {
  const { state, toastMessage } = useSoho();
  const [view, setView] = useState<ViewKey>(getInitialView);
  const [quickOpen, setQuickOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingRemId, setEditingRemId] = useState<string | null>(null);
  const [taskFocusSeq, setTaskFocusSeq] = useState(0);
  const [remFocusSeq, setRemFocusSeq] = useState(0);
  const [noteCreateSeq, setNoteCreateSeq] = useState(0);
  const [quickCellRequest, setQuickCellRequest] = useState<{
    colId: string;
    date: string;
    seq: number;
  } | null>(null);

  const navigate = useCallback((next: ViewKey) => {
    setView(next);
    if (window.location.hash.slice(1) !== next) {
      window.location.hash = next;
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.slice(1);
      setView(VALID_VIEWS[h] || 'dashboard');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuickOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleQuickSelect = (action: 'task' | 'rem' | 'inc' | 'note') => {
    setQuickOpen(false);
    if (action === 'task') {
      setEditingTaskId(null);
      navigate('cong-viec');
      setTaskFocusSeq((s) => s + 1);
    } else if (action === 'rem') {
      setEditingRemId(null);
      navigate('nhac-viec');
      setRemFocusSeq((s) => s + 1);
    } else if (action === 'inc') {
      const t = today();
      const ym = t.slice(0, 7);
      const firstInCol = state.incCols.find(
        (c) => c.kind !== 'out' && isColVisible(c, ym)
      );
      navigate('thu-nhap');
      if (firstInCol) {
        setQuickCellRequest({ colId: firstInCol.id, date: t, seq: Date.now() });
      }
    } else if (action === 'note') {
      navigate('ghi-chu');
      setNoteCreateSeq((s) => s + 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar
        activeView={view}
        onNavigate={navigate}
        onQuickAdd={() => setQuickOpen(true)}
        onOpenAccount={() => setAccountOpen(true)}
      />

      <MobileNavigation
        activeView={view}
        onNavigate={navigate}
        onQuickAdd={() => setQuickOpen(true)}
        onOpenAccount={() => setAccountOpen(true)}
      />

      <main className="flex-1 min-w-0 px-4 pt-5 pb-24 md:px-10 lg:px-14 md:py-11 max-w-[1060px] w-full">
        {view === 'dashboard' && (
          <DashboardView
            onNavigate={navigate}
            onEditTask={(id) => setEditingTaskId(id)}
            onEditReminder={(id) => setEditingRemId(id)}
          />
        )}
        {view === 'cong-viec' && (
          <TasksView
            editingId={editingTaskId}
            onStartEdit={(id) => setEditingTaskId(id)}
            onClearEdit={() => setEditingTaskId(null)}
            focusTrigger={taskFocusSeq}
          />
        )}
        {view === 'thu-nhap' && (
          <IncomeView
            quickCellRequest={quickCellRequest}
            onConsumeQuickCell={() => setQuickCellRequest(null)}
          />
        )}
        {view === 'nhac-viec' && (
          <RemindersView
            editingId={editingRemId}
            onStartEdit={(id) => setEditingRemId(id)}
            onClearEdit={() => setEditingRemId(null)}
            focusTrigger={remFocusSeq}
          />
        )}
        {view === 'ghi-chu' && <NotesView createTrigger={noteCreateSeq} />}
        {view === 'mindmap' && <MindmapView />}
      </main>

      <QuickAddModal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onSelect={handleQuickSelect}
      />

      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
      />

      <MergeConflictModal />
      <OfflineIndicator />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] md:bottom-6 z-50 px-4 py-2.5 rounded-xl bg-[var(--text)] text-[var(--bg)] text-sm font-medium shadow-[var(--shadow-lg)] max-w-[90vw] text-center"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <SohoProvider>
        <SohoShell />
      </SohoProvider>
    </ErrorBoundary>
  );
}
