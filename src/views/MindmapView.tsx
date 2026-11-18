import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MindmapLayout, MindmapNode } from '../types/soho';
import { useSoho } from '../context/SohoContext';
import { MINDMAP_TEMPLATES } from '../lib/dateUtils';

const PALETTE = ['#1a73e8', '#e37400', '#188038', '#d93025', '#9334e6', '#00897b'];
const branchColor = (idx: number) => (idx < 0 ? 'var(--text)' : PALETTE[idx % PALETTE.length]);

interface TreeNode {
  node: MindmapNode;
  children: TreeNode[];
}

interface PositionedNode {
  id: string;
  node: MindmapNode;
  x: number;
  y: number;
  w: number;
  h: number;
  parent: PositionedNode | null;
  colIdx: number;
  descendantCount: number;
}

function buildTree(nodes: MindmapNode[], rootId: string): TreeNode | null {
  const map = new Map<string, TreeNode>();
  nodes.forEach((n) => map.set(n.id, { node: n, children: [] }));
  nodes.forEach((n) => {
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(map.get(n.id)!);
    }
  });
  map.forEach((tn) => {
    tn.children.sort((a, b) => a.node.sortOrder - b.node.sortOrder);
  });
  return map.get(rootId) || null;
}

function countDescendants(t: TreeNode): number {
  return t.children.reduce((acc, c) => acc + 1 + countDescendants(c), 0);
}

function layoutMindmap(root: TreeNode | null, layout: MindmapLayout): PositionedNode[] {
  if (!root) return [];
  const out: PositionedNode[] = [];
  const sizeMap = new Map<string, number>();

  const nodeW = (n: MindmapNode) =>
    Math.max(76, Math.min(240, Math.round(n.text.length * 8 + 34)));
  const nodeH = (n: MindmapNode) => (n.id === root.node.id ? 48 : 36);
  const visibleChildren = (t: TreeNode) => (t.node.collapsed ? [] : t.children);

  if (layout === 'org') {
    const measureW = (t: TreeNode): number => {
      const ch = visibleChildren(t);
      const w = Math.max(
        nodeW(t.node),
        ch.length ? ch.reduce((s, c) => s + measureW(c), 0) + 16 * (ch.length - 1) : 0
      );
      sizeMap.set(t.node.id, w);
      return w;
    };
    const place = (
      t: TreeNode,
      cx: number,
      y: number,
      colIdx: number,
      parent: PositionedNode | null
    ) => {
      const w = nodeW(t.node);
      const h = nodeH(t.node);
      const pNode: PositionedNode = {
        id: t.node.id,
        node: t.node,
        x: cx - w / 2,
        y,
        w,
        h,
        parent,
        colIdx,
        descendantCount: countDescendants(t),
      };
      out.push(pNode);
      let left = cx - (sizeMap.get(t.node.id) || w) / 2;
      visibleChildren(t).forEach((c, idx) => {
        const cw = sizeMap.get(c.node.id) || nodeW(c.node);
        place(c, left + cw / 2, y + h + 46, parent ? colIdx : idx, pNode);
        left += cw + 16;
      });
    };
    measureW(root);
    place(root, 0, 0, -1, null);
    return out;
  }

  const measureH = (t: TreeNode): number => {
    const ch = visibleChildren(t);
    const h = Math.max(
      nodeH(t.node),
      ch.length ? ch.reduce((s, c) => s + measureH(c), 0) + 10 * (ch.length - 1) : 0
    );
    sizeMap.set(t.node.id, h);
    return h;
  };

  const placeSide = (
    t: TreeNode,
    x: number,
    top: number,
    dir: 1 | -1,
    colIdx: number,
    parent: PositionedNode | null
  ) => {
    const w = nodeW(t.node);
    const h = nodeH(t.node);
    const subH = sizeMap.get(t.node.id) || h;
    const cy = top + subH / 2;
    const px = dir > 0 ? x : x - w;
    const pNode: PositionedNode = {
      id: t.node.id,
      node: t.node,
      x: px,
      y: cy - h / 2,
      w,
      h,
      parent,
      colIdx,
      descendantCount: countDescendants(t),
    };
    out.push(pNode);
    let curTop = top;
    visibleChildren(t).forEach((c) => {
      const chH = sizeMap.get(c.node.id) || nodeH(c.node);
      placeSide(c, dir > 0 ? px + w + 38 : px - 38, curTop, dir, colIdx, pNode);
      curTop += chH + 10;
    });
  };

  measureH(root);
  const rw = nodeW(root.node);
  const rh = nodeH(root.node);
  const rootPos: PositionedNode = {
    id: root.node.id,
    node: root.node,
    x: -rw / 2,
    y: -rh / 2,
    w: rw,
    h: rh,
    parent: null,
    colIdx: -1,
    descendantCount: countDescendants(root),
  };
  out.push(rootPos);

  const ch = visibleChildren(root);
  const split = layout === 'logic' ? ch.length : Math.ceil(ch.length / 2);

  const renderGroup = (group: TreeNode[], dir: 1 | -1) => {
    const totalH =
      group.reduce((s, c) => s + (sizeMap.get(c.node.id) || 36), 0) +
      10 * Math.max(0, group.length - 1);
    let top = -totalH / 2;
    group.forEach((c) => {
      const cIdx = ch.indexOf(c);
      placeSide(
        c,
        dir > 0 ? rootPos.x + rootPos.w + 38 : rootPos.x - 38,
        top,
        dir,
        cIdx,
        rootPos
      );
      top += (sizeMap.get(c.node.id) || 36) + 10;
    });
  };

  renderGroup(ch.slice(0, split), 1);
  renderGroup(ch.slice(split), -1);
  return out;
}

function buildEdgePath(a: PositionedNode, layout: MindmapLayout): string {
  const p = a.parent;
  if (!p) return '';
  if (layout === 'org') {
    const sx = p.x + p.w / 2;
    const sy = p.y + p.h;
    const ex = a.x + a.w / 2;
    const ey = a.y;
    const my = (sy + ey) / 2;
    return `M${sx} ${sy}C${sx} ${my} ${ex} ${my} ${ex} ${ey}`;
  }
  const dir = a.x > p.x ? 1 : -1;
  const sx = dir > 0 ? p.x + p.w : p.x;
  const ex = dir > 0 ? a.x : a.x + a.w;
  const sy = p.y + p.h / 2;
  const ey = a.y + a.h / 2;
  const mx = (sx + ex) / 2;
  return `M${sx} ${sy}C${mx} ${sy} ${mx} ${ey} ${ex} ${ey}`;
}

const MiniThumb: React.FC<{ nodes: MindmapNode[]; rootId: string; layout: MindmapLayout }> = ({
  nodes,
  rootId,
  layout,
}) => {
  const positioned = useMemo(() => layoutMindmap(buildTree(nodes, rootId), layout), [nodes, rootId, layout]);
  if (!positioned.length) return null;
  const x0 = Math.min(...positioned.map((a) => a.x)) - 12;
  const y0 = Math.min(...positioned.map((a) => a.y)) - 12;
  const x1 = Math.max(...positioned.map((a) => a.x + a.w)) + 12;
  const y1 = Math.max(...positioned.map((a) => a.y + a.h)) + 12;

  return (
    <svg
      viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
    >
      {positioned
        .filter((a) => a.parent)
        .map((a) => (
          <path
            key={`e-${a.id}`}
            d={buildEdgePath(a, layout)}
            stroke={branchColor(a.colIdx)}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
      {positioned.map((a) => (
        <rect
          key={a.id}
          x={a.x}
          y={a.y}
          width={a.w}
          height={a.h}
          rx={8}
          fill={a.parent ? branchColor(a.colIdx) : 'var(--text)'}
          fillOpacity={a.parent ? 0.25 : 1}
          stroke={branchColor(a.colIdx)}
          strokeWidth={2}
        />
      ))}
    </svg>
  );
};

export const MindmapView: React.FC = () => {
  const {
    state,
    showToast,
    createMindmapFromTemplate,
    updateMindmapMeta,
    deleteMindmap,
    addMindmapNode,
    updateMindmapNode,
    deleteMindmapNodeSubtree,
  } = useSoho();

  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [armDeleteMapId, setArmDeleteMapId] = useState<string | null>(null);
  const [vp, setVp] = useState({ x: 0, y: 0, k: 1 });

  const viewportRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchRef = useRef<{
    d: number;
    k: number;
    x: number;
    y: number;
    cx: number;
    cy: number;
  } | null>(null);

  const activeMap = state.maps.find((m) => m.id === activeMapId) || null;
  const activeNodes = activeMap ? state.mapNodes[activeMap.id] || [] : [];
  const positioned = useMemo(
    () =>
      activeMap
        ? layoutMindmap(buildTree(activeNodes, activeMap.rootNodeId), activeMap.layout)
        : [],
    [activeMap, activeNodes]
  );

  const fitToView = useCallback(
    (items: PositionedNode[]) => {
      const el = viewportRef.current;
      if (!el || !items.length) return;
      const x0 = Math.min(...items.map((a) => a.x));
      const y0 = Math.min(...items.map((a) => a.y));
      const x1 = Math.max(...items.map((a) => a.x + a.w));
      const y1 = Math.max(...items.map((a) => a.y + a.h));
      const W = el.clientWidth;
      const H = el.clientHeight;
      const k = Math.min(1.2, (W - 60) / Math.max(1, x1 - x0), (H - 60) / Math.max(1, y1 - y0));
      setVp({
        k,
        x: (W - (x1 - x0) * k) / 2 - x0 * k,
        y: (H - (y1 - y0) * k) / 2 - y0 * k,
      });
    },
    []
  );

  // Fit whenever opening a map or changing layout
  const lastFitKeyRef = useRef<string>('');
  useEffect(() => {
    if (!activeMap || !positioned.length) return;
    const key = `${activeMap.id}:${activeMap.layout}`;
    if (lastFitKeyRef.current !== key) {
      lastFitKeyRef.current = key;
      fitToView(positioned);
    }
  }, [activeMap, positioned, fitToView]);

  // Template preview data
  const templateCards = useMemo(() => {
    return Object.entries(MINDMAP_TEMPLATES).map(([key, tpl]) => {
      const nodes: MindmapNode[] = [];
      let counter = 0;
      const walk = (n: typeof tpl.root, parentId: string, order: number): string => {
        const id = `tpl-${counter++}`;
        nodes.push({ id, mapId: key, parentId, text: n.label, collapsed: false, sortOrder: order });
        (n.children || []).forEach((c, idx) => walk(c, id, idx));
        return id;
      };
      const rootId = walk(tpl.root, '', 0);
      return { key, name: tpl.name, layout: tpl.layout, nodes, rootId };
    });
  }, []);

  const zoomBy = (factor: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const px = el.clientWidth / 2;
    const py = el.clientHeight / 2;
    setVp((prev) => {
      const k1 = Math.min(2.5, Math.max(0.3, prev.k * factor));
      return {
        k: k1,
        x: px - ((px - prev.x) * k1) / prev.k,
        y: py - ((py - prev.y) * k1) / prev.k,
      };
    });
  };

  const handleAddChild = useCallback(async () => {
    if (!activeMap) return;
    const parentId = selectedNodeId || activeMap.rootNodeId;
    const newId = await addMindmapNode(activeMap.id, parentId, 'Nhánh mới');
    setSelectedNodeId(newId);
    setEditingNodeId(newId);
    setEditingText('Nhánh mới');
  }, [activeMap, selectedNodeId, addMindmapNode]);

  const handleAddSibling = useCallback(async () => {
    if (!activeMap) return;
    const cur = activeNodes.find((n) => n.id === selectedNodeId);
    const parentId = cur && cur.parentId ? cur.parentId : activeMap.rootNodeId;
    const insertOrder = cur && cur.parentId ? cur.sortOrder + 0.5 : undefined;
    const newId = await addMindmapNode(activeMap.id, parentId, 'Nhánh mới', insertOrder);
    setSelectedNodeId(newId);
    setEditingNodeId(newId);
    setEditingText('Nhánh mới');
  }, [activeMap, activeNodes, selectedNodeId, addMindmapNode]);

  const handleRemoveNode = useCallback(async () => {
    if (!activeMap || !selectedNodeId) return;
    if (selectedNodeId === activeMap.rootNodeId) {
      showToast('Không xóa được chủ đề chính');
      return;
    }
    const target = activeNodes.find((n) => n.id === selectedNodeId);
    const nextSel = target?.parentId || activeMap.rootNodeId;
    await deleteMindmapNodeSubtree(activeMap.id, selectedNodeId);
    setSelectedNodeId(nextSel);
  }, [activeMap, activeNodes, selectedNodeId, deleteMindmapNodeSubtree, showToast]);

  const commitInlineEdit = useCallback(async () => {
    if (!activeMap || !editingNodeId) return;
    const text = editingText.trim();
    const nid = editingNodeId;
    setEditingNodeId(null);
    if (text) {
      await updateMindmapNode(activeMap.id, nid, { text });
    }
  }, [activeMap, editingNodeId, editingText, updateMindmapNode]);

  // Keyboard shortcuts inside canvas
  useEffect(() => {
    if (!activeMap) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingNodeId) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest('input, select, textarea')) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        void handleAddChild();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void handleAddSibling();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        void handleRemoveNode();
      } else if (e.key === 'F2' || e.key === ' ') {
        e.preventDefault();
        if (selectedNodeId) {
          const nd = activeNodes.find((n) => n.id === selectedNodeId);
          setEditingNodeId(selectedNodeId);
          setEditingText(nd?.text || '');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeMap,
    activeNodes,
    editingNodeId,
    selectedNodeId,
    handleAddChild,
    handleAddSibling,
    handleRemoveNode,
  ]);

  if (!activeMap) {
    return (
      <div>
        <h1 className="text-[26px] md:text-[32px] font-bold tracking-tight leading-tight">
          Mindmap
        </h1>
        <p className="text-sm md:text-[15px] text-[var(--muted)] mt-1 mb-6">
          Vẽ ý tưởng thành sơ đồ nhánh. Chọn một mẫu để bắt đầu.
        </p>

        <h2 className="text-sm font-semibold mb-3">Tạo mới</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
          {templateCards.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              onClick={async () => {
                const { mapId, rootNodeId } = await createMindmapFromTemplate(tpl.key);
                lastFitKeyRef.current = '';
                setActiveMapId(mapId);
                setSelectedNodeId(rootNodeId);
              }}
              className="group rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] overflow-hidden text-left cursor-pointer hover:border-[var(--accent)] transition-colors"
            >
              <div className="h-[116px] w-full bg-[var(--side)] p-2">
                <MiniThumb nodes={tpl.nodes} rootId={tpl.rootId} layout={tpl.layout} />
              </div>
              <div className="px-3 py-2.5 text-sm font-medium">{tpl.name}</div>
            </button>
          ))}
        </div>

        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <span>Sơ đồ của bạn</span>
          <span className="font-normal text-xs text-[var(--muted)] tabular-nums">
            {state.maps.length}
          </span>
        </h2>

        {state.maps.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {state.maps.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => {
                    lastFitKeyRef.current = '';
                    setActiveMapId(m.id);
                    setSelectedNodeId(m.rootNodeId);
                  }}
                  aria-label={`Mở ${m.name}`}
                  className="block h-[132px] w-full bg-[var(--side)] p-2 cursor-pointer"
                >
                  <MiniThumb
                    nodes={state.mapNodes[m.id] || []}
                    rootId={m.rootNodeId}
                    layout={m.layout}
                  />
                </button>
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                  <span className="text-sm font-medium truncate">{m.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (armDeleteMapId !== m.id) {
                        setArmDeleteMapId(m.id);
                        return;
                      }
                      void deleteMindmap(m.id);
                      setArmDeleteMapId(null);
                    }}
                    className={`min-h-[32px] px-2.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 ${
                      armDeleteMapId === m.id
                        ? 'bg-[var(--danger-bg)] text-[var(--danger)] font-semibold'
                        : 'text-[var(--muted)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]'
                    }`}
                  >
                    {armDeleteMapId === m.id ? 'Bấm lại để xóa' : 'Xóa'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Chưa có sơ đồ nào. Chọn một mẫu ở trên.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => {
            setActiveMapId(null);
            setEditingNodeId(null);
          }}
          className="min-h-[38px] px-3.5 rounded-full text-xs font-medium border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)]"
        >
          ‹ Sơ đồ
        </button>

        <input
          type="text"
          maxLength={160}
          aria-label="Tên sơ đồ"
          value={activeMap.name}
          onChange={(e) => void updateMindmapMeta(activeMap.id, { name: e.target.value })}
          className="min-w-[140px] max-w-[220px] min-h-[38px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-1.5 text-sm font-semibold"
        />

        <select
          aria-label="Kiểu sơ đồ"
          value={activeMap.layout}
          onChange={(e) =>
            void updateMindmapMeta(activeMap.id, { layout: e.target.value as MindmapLayout })
          }
          className="min-h-[38px] rounded-xl border border-[var(--line)] bg-[var(--inp)] px-3 py-1.5 text-sm"
        >
          <option value="mind">Mind Map</option>
          <option value="logic">Logic Chart</option>
          <option value="org">Org Chart</option>
        </select>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => {
            if (selectedNodeId) {
              const nd = activeNodes.find((n) => n.id === selectedNodeId);
              setEditingNodeId(selectedNodeId);
              setEditingText(nd?.text || '');
            }
          }}
          className="min-h-[38px] px-3 rounded-full text-xs font-medium border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)] whitespace-nowrap"
        >
          Sửa chữ
        </button>
        <button
          type="button"
          onClick={() => void handleAddChild()}
          className="min-h-[38px] px-3 rounded-full text-xs font-medium border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)] whitespace-nowrap"
        >
          + Nhánh con
        </button>
        <button
          type="button"
          onClick={() => void handleAddSibling()}
          className="min-h-[38px] px-3 rounded-full text-xs font-medium border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)] whitespace-nowrap"
        >
          + Cùng cấp
        </button>
        <button
          type="button"
          onClick={() => {
            const nd = activeNodes.find((n) => n.id === selectedNodeId);
            const hasChildren = activeNodes.some((n) => n.parentId === selectedNodeId);
            if (nd && hasChildren) {
              void updateMindmapNode(activeMap.id, nd.id, { collapsed: !nd.collapsed });
            }
          }}
          className="min-h-[38px] px-3 rounded-full text-xs font-medium border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)] whitespace-nowrap"
        >
          Thu gọn / mở
        </button>
        <button
          type="button"
          onClick={() => void handleRemoveNode()}
          className="min-h-[38px] px-3 rounded-full text-xs font-medium border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--danger-bg)] hover:text-[var(--danger)] whitespace-nowrap"
        >
          Xóa nhánh
        </button>
        <button
          type="button"
          aria-label="Thu nhỏ"
          onClick={() => zoomBy(1 / 1.2)}
          className="min-w-[38px] min-h-[38px] rounded-full text-sm font-medium border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)]"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Phóng to"
          onClick={() => zoomBy(1.2)}
          className="min-w-[38px] min-h-[38px] rounded-full text-sm font-medium border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)]"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => fitToView(positioned)}
          className="min-h-[38px] px-3.5 rounded-full text-xs font-medium border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)] cursor-pointer hover:bg-[var(--hover)] whitespace-nowrap"
        >
          Căn giữa
        </button>
      </div>

      {/* Interactive Pan/Zoom Canvas */}
      <div
        ref={viewportRef}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-node]')) return;
          pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointersRef.current.size === 1) {
            dragRef.current = { x: e.clientX, y: e.clientY, ox: vp.x, oy: vp.y };
          } else if (pointersRef.current.size === 2) {
            const [a, b] = Array.from(pointersRef.current.values());
            pinchRef.current = {
              d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
              k: vp.k,
              x: vp.x,
              y: vp.y,
              cx: (a.x + b.x) / 2,
              cy: (a.y + b.y) / 2,
            };
            dragRef.current = null;
          }
        }}
        onPointerMove={(e) => {
          if (!pointersRef.current.has(e.pointerId)) return;
          pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinchRef.current && pointersRef.current.size >= 2 && viewportRef.current) {
            const [a, b] = Array.from(pointersRef.current.values());
            const r = viewportRef.current.getBoundingClientRect();
            const k1 = Math.min(
              2.5,
              Math.max(
                0.3,
                (pinchRef.current.k * Math.hypot(a.x - b.x, a.y - b.y)) / pinchRef.current.d
              )
            );
            const px = pinchRef.current.cx - r.left;
            const py = pinchRef.current.cy - r.top;
            setVp({
              k: k1,
              x: px - ((px - pinchRef.current.x) * k1) / pinchRef.current.k,
              y: py - ((py - pinchRef.current.y) * k1) / pinchRef.current.k,
            });
          } else if (dragRef.current) {
            setVp((prev) => ({
              ...prev,
              x: dragRef.current!.ox + e.clientX - dragRef.current!.x,
              y: dragRef.current!.oy + e.clientY - dragRef.current!.y,
            }));
          }
        }}
        onPointerUp={(e) => {
          pointersRef.current.delete(e.pointerId);
          if (pointersRef.current.size < 2) pinchRef.current = null;
          if (pointersRef.current.size === 0) dragRef.current = null;
        }}
        onPointerCancel={(e) => {
          pointersRef.current.delete(e.pointerId);
          if (pointersRef.current.size < 2) pinchRef.current = null;
          if (pointersRef.current.size === 0) dragRef.current = null;
        }}
        onWheel={(e) => {
          if (!viewportRef.current) return;
          const r = viewportRef.current.getBoundingClientRect();
          const px = e.clientX - r.left;
          const py = e.clientY - r.top;
          const factor = e.deltaY < 0 ? 1.1 : 0.9;
          setVp((prev) => {
            const k1 = Math.min(2.5, Math.max(0.3, prev.k * factor));
            return {
              k: k1,
              x: px - ((px - prev.x) * k1) / prev.k,
              y: py - ((py - prev.y) * k1) / prev.k,
            };
          });
        }}
        className="relative h-[64vh] min-h-[380px] rounded-3xl border border-[var(--line)] mindmap-grid shadow-[var(--shadow)] overflow-hidden touch-none cursor-grab active:cursor-grabbing"
      >
        <div
          style={{
            transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.k})`,
            transformOrigin: '0 0',
          }}
          className="absolute left-0 top-0"
        >
          <svg
            width={1}
            height={1}
            className="absolute left-0 top-0 overflow-visible pointer-events-none"
          >
            {positioned
              .filter((a) => a.parent)
              .map((a) => (
                <path
                  key={`edge-${a.id}`}
                  d={buildEdgePath(a, activeMap.layout)}
                  stroke={branchColor(a.colIdx)}
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              ))}
          </svg>

          {positioned.map((a) => {
            const isRoot = !a.parent;
            const isSelected = a.id === selectedNodeId;
            const isEditing = a.id === editingNodeId;
            const color = branchColor(a.colIdx);

            return (
              <div
                key={a.id}
                data-node={a.id}
                onClick={() => setSelectedNodeId(a.id)}
                onDoubleClick={() => {
                  setSelectedNodeId(a.id);
                  setEditingNodeId(a.id);
                  setEditingText(a.node.text);
                }}
                style={{
                  left: `${a.x}px`,
                  top: `${a.y}px`,
                  width: `${a.w}px`,
                  height: `${a.h}px`,
                  borderColor: isRoot ? 'var(--text)' : color,
                  backgroundColor: isRoot
                    ? 'var(--text)'
                    : `color-mix(in srgb, ${color} 12%, var(--bg))`,
                  color: isRoot ? 'var(--bg)' : 'var(--text)',
                }}
                className={`absolute flex items-center justify-center rounded-xl border-[1.5px] select-none whitespace-nowrap cursor-pointer ${
                  isRoot ? 'font-semibold text-[15px]' : 'text-sm'
                } ${isSelected ? 'outline-2 outline-[var(--accent)] outline-offset-2' : ''}`}
              >
                {isEditing ? (
                  <input
                    autoFocus
                    aria-label="Nội dung nhánh"
                    maxLength={200}
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={() => void commitInlineEdit()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void commitInlineEdit();
                      } else if (e.key === 'Escape') {
                        setEditingNodeId(null);
                      } else if (e.key === 'Tab') {
                        e.preventDefault();
                        void commitInlineEdit().then(() => handleAddChild());
                      }
                    }}
                    className="w-[calc(100%-8px)] bg-transparent border-0 text-center outline-0 font-inherit text-inherit"
                  />
                ) : (
                  <span className="truncate px-2.5">{a.node.text}</span>
                )}

                {a.node.collapsed && a.descendantCount > 0 && (
                  <i className="not-italic absolute -right-2.5 -top-2 text-[11px] bg-[var(--text)] text-[var(--bg)] rounded-full px-1.5 font-mono-num">
                    +{a.descendantCount}
                  </i>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-[var(--muted)] mt-2.5">
        Bấm đúp để sửa chữ · Tab: nhánh con · Enter: cùng cấp · Delete: xóa · kéo nền để di chuyển, cuộn hoặc chụm 2 ngón để phóng to.
      </p>
    </div>
  );
};
