import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseHistoryOptions<T> {
  maxHistory?: number;
  initialState?: T;
}

interface UseHistoryReturn<T> {
  // State
  state: T;
  history: T[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;

  // Refs
  historyRef: React.RefObject<T[]>;
  historyIndexRef: React.RefObject<number>;

  // Actions
  setState: (newState: T | ((prev: T) => T)) => void;
  saveHistory: (snapshot: T) => void;
  undo: () => T | undefined;
  redo: () => T | undefined;
  clearHistory: () => void;
  goToHistory: (index: number) => T | undefined;
}

// ============================================================================
// Hook
// ============================================================================

export function useHistory<T>(options: UseHistoryOptions<T> = {}): UseHistoryReturn<T> {
  const { maxHistory = 50, initialState } = options;

  // State
  const [history, setHistory] = useState<T[]>(initialState ? [initialState] : []);
  const [historyIndex, setHistoryIndex] = useState(initialState ? 0 : -1);

  // Refs for event handlers
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);

  // Sync refs
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Current state
  const state = historyIndex >= 0 && historyIndex < history.length
    ? history[historyIndex]
    : initialState as T;

  // Can undo/redo
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Save a new history snapshot
  const saveHistory = useCallback((snapshot: T) => {
    setHistory(prev => {
      // Remove any "future" states if we're not at the end
      const newHistory = prev.slice(0, historyIndexRef.current + 1);
      // Add new snapshot
      newHistory.push(snapshot);
      // Trim to max history
      if (newHistory.length > maxHistory) {
        return newHistory.slice(newHistory.length - maxHistory);
      }
      return newHistory;
    });
    setHistoryIndex(prev => {
      // Adjust index if we trimmed
      const newIndex = Math.min(prev + 1, maxHistory - 1);
      return newIndex;
    });
  }, [maxHistory]);

  // Set state (saves to history automatically)
  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    const currentState = historyRef.current[historyIndexRef.current];
    const resolvedState = typeof newState === 'function'
      ? (newState as (prev: T) => T)(currentState)
      : newState;
    saveHistory(resolvedState);
  }, [saveHistory]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      const newIndex = historyIndexRef.current - 1;
      setHistoryIndex(newIndex);
      return historyRef.current[newIndex];
    }
    return undefined;
  }, []);

  // Redo
  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const newIndex = historyIndexRef.current + 1;
      setHistoryIndex(newIndex);
      return historyRef.current[newIndex];
    }
    return undefined;
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    const current = historyRef.current[historyIndexRef.current];
    setHistory(current ? [current] : []);
    setHistoryIndex(current ? 0 : -1);
  }, []);

  // Go to specific history index
  const goToHistory = useCallback((index: number) => {
    if (index >= 0 && index < historyRef.current.length) {
      setHistoryIndex(index);
      return historyRef.current[index];
    }
    return undefined;
  }, []);

  return {
    // State
    state,
    history,
    historyIndex,
    canUndo,
    canRedo,

    // Refs
    historyRef,
    historyIndexRef,

    // Actions
    setState,
    saveHistory,
    undo,
    redo,
    clearHistory,
    goToHistory,
  };
}

// ============================================================================
// Specialized Hook for Canvas History
// ============================================================================

export interface CanvasSnapshot {
  nodes: any[];
  connections: any[];
  groups: any[];
}

export function useCanvasHistory(options: { maxHistory?: number } = {}) {
  const { maxHistory = 50 } = options;

  const [history, setHistory] = useState<CanvasSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const saveSnapshot = useCallback((snapshot: CanvasSnapshot) => {
    setHistory(prev => {
      // Deep clone to prevent mutation issues
      const clonedSnapshot = JSON.parse(JSON.stringify(snapshot));
      const newHistory = prev.slice(0, historyIndexRef.current + 1);
      newHistory.push(clonedSnapshot);
      if (newHistory.length > maxHistory) {
        return newHistory.slice(newHistory.length - maxHistory);
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, maxHistory - 1));
  }, [maxHistory]);

  const undo = useCallback((): CanvasSnapshot | undefined => {
    if (historyIndexRef.current > 0) {
      const newIndex = historyIndexRef.current - 1;
      setHistoryIndex(newIndex);
      return JSON.parse(JSON.stringify(historyRef.current[newIndex]));
    }
    return undefined;
  }, []);

  const redo = useCallback((): CanvasSnapshot | undefined => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const newIndex = historyIndexRef.current + 1;
      setHistoryIndex(newIndex);
      return JSON.parse(JSON.stringify(historyRef.current[newIndex]));
    }
    return undefined;
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
  }, []);

  return {
    history,
    historyIndex,
    historyRef,
    historyIndexRef,
    canUndo,
    canRedo,
    saveSnapshot,
    undo,
    redo,
    clearHistory,
  };
}
