import { useState, useRef, useCallback, useEffect } from 'react';
import type { AppNode, Group } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface SelectionRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface ConnectionStart {
  id: string;
  portType: 'input' | 'output';
  screenX: number;
  screenY: number;
}

export interface DragNodeContext {
  id: string;
  startX: number;
  startY: number;
  mouseStartX: number;
  mouseStartY: number;
  nodeWidth: number;
  nodeHeight: number;
  otherSelectedNodes: Array<{ id: string; startX: number; startY: number }>;
  selectedGroups: Array<{ id: string; startX: number; startY: number; childNodes: Array<{ id: string; startX: number; startY: number }> }>;
  isCopyDrag: boolean;
  parentGroupId?: string;
  // Runtime values (updated during drag)
  currentX?: number;
  currentY?: number;
  currentDx?: number;
  currentDy?: number;
}

export interface DragGroupContext {
  id: string;
  startX: number;
  startY: number;
  mouseStartX: number;
  mouseStartY: number;
  childNodes: Array<{ id: string; startX: number; startY: number }>;
}

export interface ResizeContext {
  id: string;
  initialWidth: number;
  initialHeight: number;
  startX: number;
  startY: number;
  // Runtime values
  currentWidth?: number;
  currentHeight?: number;
}

// Discriminated union for interaction modes
export type InteractionMode =
  | { type: 'idle' }
  | { type: 'selecting'; rect: SelectionRect }
  | { type: 'panning'; lastPos: Point }
  | { type: 'dragging-node'; context: DragNodeContext }
  | { type: 'dragging-group'; context: DragGroupContext }
  | { type: 'resizing-node'; context: ResizeContext }
  | { type: 'resizing-group'; context: ResizeContext }
  | { type: 'connecting'; start: ConnectionStart };

export interface SelectionState {
  nodeIds: string[];
  groupIds: string[];
}

// ============================================================================
// Hook
// ============================================================================

interface UseInteractionReturn {
  // State
  mode: InteractionMode;
  selection: SelectionState;
  isSpacePressed: boolean;
  mousePos: Point;

  // Refs
  modeRef: React.RefObject<InteractionMode>;

  // Mode transitions
  startSelecting: (startX: number, startY: number) => void;
  updateSelecting: (currentX: number, currentY: number) => void;
  startPanning: (lastPos: Point) => void;
  updatePanning: (lastPos: Point) => void;
  startNodeDrag: (context: DragNodeContext) => void;
  updateNodeDrag: (updates: Partial<DragNodeContext>) => void;
  startGroupDrag: (context: DragGroupContext) => void;
  startNodeResize: (context: ResizeContext) => void;
  updateNodeResize: (updates: Partial<ResizeContext>) => void;
  startGroupResize: (context: ResizeContext) => void;
  updateGroupResize: (updates: Partial<ResizeContext>) => void;
  startConnecting: (start: ConnectionStart) => void;
  finishInteraction: () => void;

  // Selection operations
  selectNodes: (ids: string[], additive?: boolean) => void;
  selectGroups: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;
  setSelection: React.Dispatch<React.SetStateAction<SelectionState>>;

  // Mouse position
  setMousePos: React.Dispatch<React.SetStateAction<Point>>;

  // Space key
  setIsSpacePressed: React.Dispatch<React.SetStateAction<boolean>>;

  // Helpers
  isIdle: boolean;
  isDragging: boolean;
  isResizing: boolean;
  isConnecting: boolean;
  isSelecting: boolean;
  isPanning: boolean;
}

export function useInteraction(): UseInteractionReturn {
  // State
  const [mode, setMode] = useState<InteractionMode>({ type: 'idle' });
  const [selection, setSelection] = useState<SelectionState>({ nodeIds: [], groupIds: [] });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });

  // Ref for avoiding stale closures
  const modeRef = useRef<InteractionMode>(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ============================================================================
  // Mode Transitions
  // ============================================================================

  const startSelecting = useCallback((startX: number, startY: number) => {
    setMode({
      type: 'selecting',
      rect: { startX, startY, currentX: startX, currentY: startY }
    });
  }, []);

  const updateSelecting = useCallback((currentX: number, currentY: number) => {
    setMode(prev => {
      if (prev.type !== 'selecting') return prev;
      return {
        ...prev,
        rect: { ...prev.rect, currentX, currentY }
      };
    });
  }, []);

  const startPanning = useCallback((lastPos: Point) => {
    setMode({ type: 'panning', lastPos });
  }, []);

  const updatePanning = useCallback((lastPos: Point) => {
    setMode(prev => {
      if (prev.type !== 'panning') return prev;
      return { ...prev, lastPos };
    });
  }, []);

  const startNodeDrag = useCallback((context: DragNodeContext) => {
    setMode({ type: 'dragging-node', context });
  }, []);

  const updateNodeDrag = useCallback((updates: Partial<DragNodeContext>) => {
    setMode(prev => {
      if (prev.type !== 'dragging-node') return prev;
      return {
        ...prev,
        context: { ...prev.context, ...updates }
      };
    });
  }, []);

  const startGroupDrag = useCallback((context: DragGroupContext) => {
    setMode({ type: 'dragging-group', context });
  }, []);

  const startNodeResize = useCallback((context: ResizeContext) => {
    setMode({ type: 'resizing-node', context });
  }, []);

  const updateNodeResize = useCallback((updates: Partial<ResizeContext>) => {
    setMode(prev => {
      if (prev.type !== 'resizing-node') return prev;
      return {
        ...prev,
        context: { ...prev.context, ...updates }
      };
    });
  }, []);

  const startGroupResize = useCallback((context: ResizeContext) => {
    setMode({ type: 'resizing-group', context });
  }, []);

  const updateGroupResize = useCallback((updates: Partial<ResizeContext>) => {
    setMode(prev => {
      if (prev.type !== 'resizing-group') return prev;
      return {
        ...prev,
        context: { ...prev.context, ...updates }
      };
    });
  }, []);

  const startConnecting = useCallback((start: ConnectionStart) => {
    setMode({ type: 'connecting', start });
  }, []);

  const finishInteraction = useCallback(() => {
    setMode({ type: 'idle' });
  }, []);

  // ============================================================================
  // Selection Operations
  // ============================================================================

  const selectNodes = useCallback((ids: string[], additive = false) => {
    setSelection(prev => ({
      ...prev,
      nodeIds: additive ? [...new Set([...prev.nodeIds, ...ids])] : ids
    }));
  }, []);

  const selectGroups = useCallback((ids: string[], additive = false) => {
    setSelection(prev => ({
      ...prev,
      groupIds: additive ? [...new Set([...prev.groupIds, ...ids])] : ids
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setSelection({ nodeIds: [], groupIds: [] });
  }, []);

  // ============================================================================
  // Computed Helpers
  // ============================================================================

  const isIdle = mode.type === 'idle';
  const isDragging = mode.type === 'dragging-node' || mode.type === 'dragging-group';
  const isResizing = mode.type === 'resizing-node' || mode.type === 'resizing-group';
  const isConnecting = mode.type === 'connecting';
  const isSelecting = mode.type === 'selecting';
  const isPanning = mode.type === 'panning';

  return {
    // State
    mode,
    selection,
    isSpacePressed,
    mousePos,

    // Refs
    modeRef,

    // Mode transitions
    startSelecting,
    updateSelecting,
    startPanning,
    updatePanning,
    startNodeDrag,
    updateNodeDrag,
    startGroupDrag,
    startNodeResize,
    updateNodeResize,
    startGroupResize,
    updateGroupResize,
    startConnecting,
    finishInteraction,

    // Selection operations
    selectNodes,
    selectGroups,
    clearSelection,
    setSelection,

    // Mouse position
    setMousePos,

    // Space key
    setIsSpacePressed,

    // Helpers
    isIdle,
    isDragging,
    isResizing,
    isConnecting,
    isSelecting,
    isPanning,
  };
}
