import { useCallback, useRef, RefObject } from 'react';
import type { AppNode, Group, Connection } from '@/types';
import type { InteractionMode, Point, DragNodeContext, DragGroupContext, ResizeContext } from './useInteraction';

// ============================================================================
// Types
// ============================================================================

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
}

export interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  r: number;  // right
  b: number;  // bottom
}

export interface MouseHandlerDeps {
  // Viewport
  scale: number;
  pan: { x: number; y: number };
  setPan: (fn: (prev: { x: number; y: number }) => { x: number; y: number }) => void;

  // Interaction mode
  mode: InteractionMode;
  modeRef: RefObject<InteractionMode>;
  updateSelecting: (x: number, y: number) => void;
  updatePanning: (lastPos: Point) => void;

  // Data refs
  nodesRef: RefObject<AppNode[]>;
  groupsRef: RefObject<Group[]>;

  // DOM refs
  canvasContainerRef: RefObject<HTMLDivElement | null>;
  nodeRefsMap: RefObject<Map<string, HTMLDivElement>>;
  groupRefsMap: RefObject<Map<string, HTMLDivElement>>;

  // Drag refs
  dragNodeRef: RefObject<DragNodeContext | null>;
  dragGroupRef: RefObject<DragGroupContext | null>;
  dragPositionsRef: RefObject<Map<string, { x: number; y: number }>>;

  // Resize refs
  resizeContextRef: RefObject<ResizeContext | null>;
  resizeGroupRef: RefObject<ResizeContext | null>;

  // Legacy state (will be migrated later)
  draggingNodeId: string | null;
  resizingNodeId: string | null;
  resizingGroupId: string | null;
  initialSize: { width: number; height: number } | null;
  resizeStartPos: { x: number; y: number } | null;
  lastMousePos: { x: number; y: number };

  // Setters
  setMousePos: (pos: Point) => void;
  setLastMousePos: (pos: { x: number; y: number }) => void;
  setNodes: React.Dispatch<React.SetStateAction<AppNode[]>>;
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  setCopyDragPreview: (preview: { nodes: Array<{ x: number; y: number; width: number; height: number }> } | null) => void;

  // Helpers
  getNodeBounds: (node: AppNode) => NodeBounds;
  updateConnectionPaths: (nodeIds: string[]) => void;

  // Constants
  SNAP_THRESHOLD: number;
}

// ============================================================================
// Snap Detection Logic
// ============================================================================

export function detectSnap(
  proposedX: number,
  proposedY: number,
  nodeWidth: number,
  nodeHeight: number,
  nodes: AppNode[],
  draggingIds: Set<string>,
  getNodeBounds: (node: AppNode) => NodeBounds,
  snapThreshold: number,
  scale: number
): SnapResult {
  const SNAP = snapThreshold / scale;
  let snappedX = false;
  let snappedY = false;
  let resultX = proposedX;
  let resultY = proposedY;

  const myL = proposedX;
  const myC = proposedX + nodeWidth / 2;
  const myR = proposedX + nodeWidth;
  const myT = proposedY;
  const myM = proposedY + nodeHeight / 2;
  const myB = proposedY + nodeHeight;

  for (const other of nodes) {
    if (draggingIds.has(other.id)) continue;
    const bounds = getNodeBounds(other);

    if (!snappedX) {
      if (Math.abs(myL - bounds.x) < SNAP) { resultX = bounds.x; snappedX = true; }
      else if (Math.abs(myL - bounds.r) < SNAP) { resultX = bounds.r; snappedX = true; }
      else if (Math.abs(myR - bounds.x) < SNAP) { resultX = bounds.x - nodeWidth; snappedX = true; }
      else if (Math.abs(myR - bounds.r) < SNAP) { resultX = bounds.r - nodeWidth; snappedX = true; }
      else if (Math.abs(myC - (bounds.x + bounds.width / 2)) < SNAP) {
        resultX = (bounds.x + bounds.width / 2) - nodeWidth / 2;
        snappedX = true;
      }
    }

    if (!snappedY) {
      if (Math.abs(myT - bounds.y) < SNAP) { resultY = bounds.y; snappedY = true; }
      else if (Math.abs(myT - bounds.b) < SNAP) { resultY = bounds.b; snappedY = true; }
      else if (Math.abs(myB - bounds.y) < SNAP) { resultY = bounds.y - nodeHeight; snappedY = true; }
      else if (Math.abs(myB - bounds.b) < SNAP) { resultY = bounds.b - nodeHeight; snappedY = true; }
      else if (Math.abs(myM - (bounds.y + bounds.height / 2)) < SNAP) {
        resultY = (bounds.y + bounds.height / 2) - nodeHeight / 2;
        snappedY = true;
      }
    }

    if (snappedX && snappedY) break;
  }

  return { x: resultX, y: resultY, snappedX, snappedY };
}

// ============================================================================
// Mouse Move Handlers (split by mode)
// ============================================================================

function handlePanningMove(
  clientX: number,
  clientY: number,
  mode: InteractionMode,
  deps: MouseHandlerDeps
) {
  if (mode.type !== 'panning') return;
  const { lastPos } = mode;
  const dx = clientX - lastPos.x;
  const dy = clientY - lastPos.y;
  deps.setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  deps.updatePanning({ x: clientX, y: clientY });
}

function handleGroupDragMove(
  clientX: number,
  clientY: number,
  deps: MouseHandlerDeps
) {
  const dragGroup = deps.dragGroupRef.current;
  if (!dragGroup) return;

  const { id, startX, startY, mouseStartX, mouseStartY, childNodes } = dragGroup;
  const dx = (clientX - mouseStartX) / deps.scale;
  const dy = (clientY - mouseStartY) / deps.scale;

  deps.setGroups(prev => prev.map(g =>
    g.id === id ? { ...g, x: startX + dx, y: startY + dy } : g
  ));

  if (childNodes.length > 0) {
    deps.setNodes(prev => prev.map(n => {
      const child = childNodes.find(c => c.id === n.id);
      return child ? { ...n, x: child.startX + dx, y: child.startY + dy } : n;
    }));
  }
}

function handleNodeDragMove(
  clientX: number,
  clientY: number,
  deps: MouseHandlerDeps
) {
  const { draggingNodeId, dragNodeRef, scale, nodesRef, nodeRefsMap, dragPositionsRef, groupRefsMap } = deps;
  if (!draggingNodeId || !dragNodeRef.current || dragNodeRef.current.id !== draggingNodeId) return;

  const {
    startX, startY, mouseStartX, mouseStartY,
    nodeWidth, nodeHeight, otherSelectedNodes,
    isCopyDrag, selectedGroups
  } = dragNodeRef.current;

  // Copy cursor
  document.body.style.cursor = isCopyDrag ? 'copy' : '';

  // Calculate delta
  let dx = (clientX - mouseStartX) / scale;
  let dy = (clientY - mouseStartY) / scale;
  let proposedX = startX + dx;
  let proposedY = startY + dy;

  // Get all dragging IDs
  const draggingIds = new Set([draggingNodeId, ...(otherSelectedNodes?.map(n => n.id) || [])]);

  // Snap detection
  const snap = detectSnap(
    proposedX, proposedY,
    nodeWidth, nodeHeight,
    nodesRef.current,
    draggingIds,
    deps.getNodeBounds,
    deps.SNAP_THRESHOLD,
    scale
  );
  proposedX = snap.x;
  proposedY = snap.y;

  // Calculate actual delta after snap
  const actualDx = proposedX - startX;
  const actualDy = proposedY - startY;

  // Save current position to ref
  dragNodeRef.current.currentX = proposedX;
  dragNodeRef.current.currentY = proposedY;
  dragNodeRef.current.currentDx = actualDx;
  dragNodeRef.current.currentDy = actualDy;

  if (isCopyDrag) {
    // Copy drag: show preview
    const mainEl = nodeRefsMap.current.get(draggingNodeId);
    if (mainEl) mainEl.style.opacity = '0.5';
    otherSelectedNodes?.forEach(on => {
      const el = nodeRefsMap.current.get(on.id);
      if (el) el.style.opacity = '0.5';
    });

    const previewNodes = [{ x: proposedX, y: proposedY, width: nodeWidth, height: nodeHeight }];
    otherSelectedNodes?.forEach(on => {
      const originalNode = nodesRef.current.find(n => n.id === on.id);
      if (originalNode) {
        previewNodes.push({
          x: on.startX + actualDx,
          y: on.startY + actualDy,
          width: originalNode.width || 420,
          height: originalNode.height || 320
        });
      }
    });
    deps.setCopyDragPreview({ nodes: previewNodes });
  } else {
    // Normal drag: DOM manipulation
    const mainEl = nodeRefsMap.current.get(draggingNodeId);
    if (mainEl) {
      mainEl.style.transform = `translate(${proposedX}px, ${proposedY}px)`;
    }
    dragPositionsRef.current.set(draggingNodeId, { x: proposedX, y: proposedY });

    const affectedNodeIds = [draggingNodeId];

    // Move other selected nodes
    otherSelectedNodes?.forEach(on => {
      const newX = on.startX + actualDx;
      const newY = on.startY + actualDy;
      const el = nodeRefsMap.current.get(on.id);
      if (el) {
        el.style.transform = `translate(${newX}px, ${newY}px)`;
      }
      dragPositionsRef.current.set(on.id, { x: newX, y: newY });
      affectedNodeIds.push(on.id);
    });

    // Move selected groups and their children
    selectedGroups?.forEach(sg => {
      const newX = sg.startX + actualDx;
      const newY = sg.startY + actualDy;
      const groupEl = groupRefsMap.current.get(sg.id);
      if (groupEl) {
        groupEl.style.left = `${newX}px`;
        groupEl.style.top = `${newY}px`;
      }
      sg.childNodes?.forEach(cn => {
        const childX = cn.startX + actualDx;
        const childY = cn.startY + actualDy;
        const childEl = nodeRefsMap.current.get(cn.id);
        if (childEl) {
          childEl.style.transform = `translate(${childX}px, ${childY}px)`;
        }
        dragPositionsRef.current.set(cn.id, { x: childX, y: childY });
        affectedNodeIds.push(cn.id);
      });
    });

    deps.updateConnectionPaths(affectedNodeIds);
  }
}

function handleNodeResizeMove(
  clientX: number,
  clientY: number,
  deps: MouseHandlerDeps
) {
  const { resizingNodeId, initialSize, resizeStartPos, scale, setNodes } = deps;
  if (!resizingNodeId || !initialSize || !resizeStartPos) return;

  const dx = (clientX - resizeStartPos.x) / scale;
  const aspectRatio = initialSize.width / initialSize.height;
  const newWidth = Math.max(280, initialSize.width + dx);
  const newHeight = newWidth / aspectRatio;

  if (newHeight >= 160) {
    setNodes(prev => prev.map(n =>
      n.id === resizingNodeId ? { ...n, width: newWidth, height: newHeight } : n
    ));
  }
}

function handleGroupResizeMove(
  clientX: number,
  clientY: number,
  deps: MouseHandlerDeps
) {
  const { resizeGroupRef, resizingGroupId, scale, groupRefsMap } = deps;
  if (!resizeGroupRef.current || !resizingGroupId) return;

  const { id, initialWidth, initialHeight, startX, startY } = resizeGroupRef.current;
  const dx = (clientX - startX) / scale;
  const dy = (clientY - startY) / scale;
  const newWidth = Math.max(200, initialWidth + dx);
  const newHeight = Math.max(150, initialHeight + dy);

  const groupEl = groupRefsMap.current.get(id);
  if (groupEl) {
    groupEl.style.width = `${newWidth}px`;
    groupEl.style.height = `${newHeight}px`;
  }

  resizeGroupRef.current.currentWidth = newWidth;
  resizeGroupRef.current.currentHeight = newHeight;
}

// ============================================================================
// Main Hook
// ============================================================================

export interface UseMouseHandlersReturn {
  handleMouseMove: (e: MouseEvent) => void;
}

export function useMouseHandlers(deps: MouseHandlerDeps): UseMouseHandlersReturn {
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const { clientX, clientY } = e;

    // Throttle with RAF
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      // Get canvas-relative coordinates
      let canvasX = clientX, canvasY = clientY;
      if (deps.canvasContainerRef.current) {
        const rect = deps.canvasContainerRef.current.getBoundingClientRect();
        canvasX = clientX - rect.left;
        canvasY = clientY - rect.top;
      }

      // Always update mouse position
      deps.setMousePos({ x: canvasX, y: canvasY });

      // Get current mode from ref
      const mode = deps.modeRef.current;

      // Handle selection
      if (mode.type === 'selecting') {
        deps.updateSelecting(canvasX, canvasY);
        return;
      }

      // Handle group drag (legacy)
      if (deps.dragGroupRef.current) {
        handleGroupDragMove(clientX, clientY, deps);
        return;
      }

      // Handle panning
      if (mode.type === 'panning') {
        handlePanningMove(clientX, clientY, mode, deps);
        return;
      }

      // Handle node drag
      if (deps.draggingNodeId) {
        handleNodeDragMove(clientX, clientY, deps);
      }

      // Handle node resize
      if (deps.resizingNodeId) {
        handleNodeResizeMove(clientX, clientY, deps);
      }

      // Handle group resize
      if (deps.resizingGroupId) {
        handleGroupResizeMove(clientX, clientY, deps);
      }
    });
  }, [deps]);

  return { handleMouseMove };
}
