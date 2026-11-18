import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useSoho } from '../context/SohoContext';

interface NotesViewProps {
  createTrigger: number;
}

export const NotesView: React.FC<NotesViewProps> = ({ createTrigger }) => {
  const { state, createNote, updateNote, toggleNotePin, deleteNote, showToast } = useSoho();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [armDelete, setArmDelete] = useState(false);

  // Local draft for zero-lag typing with debounced sync
  const [draftBody, setDraftBody] = useState('');
  const [draftTag, setDraftTag] = useState('');
  const saveTimerRef = useRef<number | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const activeNote = state.notes.find((n) => n.id === selectedId) || null;

  useEffect(() => {
    setArmDelete(false);
    if (activeNote) {
      setDraftBody(activeNote.body);
      setDraftTag(activeNote.tag);
    } else {
      setDraftBody('');
      setDraftTag('');
    }
  }, [selectedId]); // sync draft when switching selected note

  // Keep draft updated if remote changes arrive while not actively editing
  useEffect(() => {
    if (activeNote && document.activeElement !== bodyRef.current) {
      setDraftBody(activeNote.body);
      setDraftTag(activeNote.tag);
    }
  }, [activeNote?.body, activeNote?.tag]);

  useEffect(() => {
    if (createTrigger > 0) {
      void (async () => {
        const id = await createNote(activeTag);
        setSelectedId(id);
        setTimeout(() => bodyRef.current?.focus(), 60);
      })();
    }
  }, [createTrigger]);

  const flushPendingSave = (noteId: string, body: string, tag: string) => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void updateNote(noteId, { body, tag });
  };

  const scheduleSave = (noteId: string, body: string, tag: string) => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void updateNote(noteId, { body, tag });
    }, 450);
  };

  const tags = Array.from(new Set(state.notes.map((n) => n.tag).filter(Boolean)));
  const q = search.toLowerCase();
  const filteredNotes = state.notes
    .filter(
      (n) =>
        (!activeTag || n.tag === activeTag) &&
        (!q || n.body.toLowerCase().includes(q) || n.tag.toLowerCase().includes(q))
    )
    .sort((a, b) => Number(b.pin) - Number(a.pin) || b.updatedAtMs - a.updatedAtMs);

  const handleNew = async () => {
    const id = await createNote(activeTag);
    setSelectedId(id);
    setTimeout(() => bodyRef.current?.focus(), 60);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftBody);
      showToast('Đã sao chép ghi chú');
    } catch {
      if (bodyRef.current) {
        bodyRef.current.select();
        document.execCommand('copy');
        showToast('Đã sao chép ghi chú');
      }
    }
  };

  return (
    <div>
      <h1 className="text-[26px] md:text-[32px] font-bold tracking-tight leading-tight">
        Ghi chú nhanh
      </h1>
      <p className="text-sm md:text-[15px] text-[var(--muted)] mt-1 mb-5">
        Ý tưởng, caption, câu hay gom lại để làm content. Tự lưu và đồng bộ khi bạn gõ.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] rounded-3xl border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] overflow-hidden min-h-[60vh]">
        {/* Left List Pane */}
        <div
          className={`border-b md:border-b-0 md:border-r border-[var(--line)] flex flex-col max-h-[72vh] min-w-0 ${
            activeNote ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex gap-2 p-3">
            <input
              type="search"
              placeholder="Tìm ghi chú"
              aria-label="Tìm ghi chú"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 min-h-[38px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-1.5 text-base md:text-sm"
            />
            <button
              type="button"
              onClick={() => void handleNew()}
              className="min-h-[38px] px-4 rounded-full text-xs font-semibold text-[var(--onbtn)] cursor-pointer whitespace-nowrap shrink-0"
              style={{ background: 'var(--btn)' }}
            >
              + Mới
            </button>
          </div>

          <div className="flex flex-wrap gap-1 px-3 pb-2.5">
            <button
              type="button"
              onClick={() => setActiveTag('')}
              className={`px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                activeTag === ''
                  ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
                  : 'bg-[var(--hover)] text-[var(--muted)]'
              }`}
            >
              Tất cả
            </button>
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTag(t)}
                className={`px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                  activeTag === t
                    ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
                    : 'bg-[var(--hover)] text-[var(--muted)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto px-2 pb-2 space-y-0.5">
            {filteredNotes.length > 0 ? (
              filteredNotes.map((n) => {
                const lines = n.body.split('\n');
                const title = (lines[0] || '').trim() || 'Ghi chú mới';
                const preview = lines.slice(1).join(' ').trim();
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedId(n.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      n.id === selectedId ? 'bg-[var(--hover)]' : 'hover:bg-[var(--hover)]'
                    }`}
                  >
                    <b className="block text-sm font-semibold truncate">{title}</b>
                    <small className="block text-xs text-[var(--muted)] truncate mt-0.5">
                      {n.pin ? 'Ghim · ' : ''}
                      {new Date(n.updatedAtMs).toLocaleDateString('vi-VN')}
                      {n.tag ? ` · ${n.tag}` : ''}
                      {preview ? ` · ${preview}` : ''}
                    </small>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-[var(--muted)] p-3">
                Chưa có ghi chú nào ở đây. Bấm + Mới để viết ý đầu tiên.
              </p>
            )}
          </div>
        </div>

        {/* Right Editor Pane */}
        <div
          className={`flex flex-col p-4 md:p-5 gap-3 min-w-0 ${
            activeNote ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeNote ? (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    flushPendingSave(activeNote.id, draftBody, draftTag);
                    setSelectedId(null);
                  }}
                  className="md:hidden inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-[var(--muted)] hover:bg-[var(--hover)] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Danh sách</span>
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => void toggleNotePin(activeNote.id)}
                  className="min-h-[36px] px-3 rounded-lg text-xs font-medium text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] cursor-pointer"
                >
                  {activeNote.pin ? 'Bỏ ghim' : 'Ghim'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="min-h-[36px] px-3 rounded-lg text-xs font-medium text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] cursor-pointer"
                >
                  Sao chép
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!armDelete) {
                      setArmDelete(true);
                      return;
                    }
                    void deleteNote(activeNote.id);
                    setSelectedId(null);
                  }}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-medium cursor-pointer ${
                    armDelete
                      ? 'bg-[var(--danger-bg)] text-[var(--danger)] font-semibold'
                      : 'text-[var(--muted)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]'
                  }`}
                >
                  {armDelete ? 'Bấm lại để xóa' : 'Xóa'}
                </button>
              </div>

              <input
                type="text"
                list="soho-note-tags"
                maxLength={60}
                placeholder="Nhãn: Ý tưởng, Caption…"
                aria-label="Nhãn ghi chú"
                value={draftTag}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraftTag(val);
                  scheduleSave(activeNote.id, draftBody, val);
                }}
                onBlur={() => flushPendingSave(activeNote.id, draftBody, draftTag)}
                className="max-w-[240px] min-h-[38px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-1.5 text-base md:text-sm"
              />
              <datalist id="soho-note-tags">
                {tags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>

              <textarea
                ref={bodyRef}
                maxLength={20000}
                placeholder="Dòng đầu tiên là tiêu đề…"
                aria-label="Nội dung ghi chú"
                value={draftBody}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraftBody(val);
                  scheduleSave(activeNote.id, val, draftTag);
                }}
                onBlur={() => flushPendingSave(activeNote.id, draftBody, draftTag)}
                className="flex-1 min-h-[320px] resize-none border-0 bg-transparent outline-0 text-base md:text-[15px] leading-relaxed text-[var(--text)]"
              />

              <div className="text-xs text-[var(--muted)] tabular-nums">
                Tự lưu · sửa lúc {new Date(activeNote.updatedAtMs).toLocaleString('vi-VN')}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[var(--muted)] p-6">
              Chọn một ghi chú bên trái hoặc bấm + Mới.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
