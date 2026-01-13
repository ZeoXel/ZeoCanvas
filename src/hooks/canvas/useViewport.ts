import { useState, useRef, useCallback, useEffect, RefObject } from 'react';

export interface ViewportState {
  scale: number;
  pan: { x: number; y: number };
}

interface UseViewportOptions {
  initialScale?: number;
  initialPan?: { x: number; y: number };
  minScale?: number;
  maxScale?: number;
}

interface UseViewportReturn {
  // State
  scale: number;
  pan: { x: number; y: number };
  viewport: ViewportState;

  // Refs (for use in event handlers to avoid stale closures)
  scaleRef: RefObject<number>;
  panRef: RefObject<{ x: number; y: number }>;
  viewportRef: RefObject<ViewportState>;

  // Setters
  setScale: (scale: number | ((prev: number) => number)) => void;
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  setViewport: (viewport: ViewportState | ((prev: ViewportState) => ViewportState)) => void;

  // Utilities
  screenToCanvas: (screenX: number, screenY: number, containerRect?: DOMRect) => { x: number; y: number };
  canvasToScreen: (canvasX: number, canvasY: number, containerRect?: DOMRect) => { x: number; y: number };

  // Wheel handler (needs to be attached to container)
  handleWheel: (e: WheelEvent) => void;

  // Hook to attach wheel listener
  useWheelListener: (containerRef: RefObject<HTMLDivElement | null>) => void;
}

export function useViewport(options: UseViewportOptions = {}): UseViewportReturn {
  const {
    initialScale = 1,
    initialPan = { x: 0, y: 0 },
    minScale = 0.1,
    maxScale = 5,
  } = options;

  // State
  const [scale, setScaleState] = useState(initialScale);
  const [pan, setPanState] = useState(initialPan);

  // Refs for avoiding stale closures in event handlers
  const scaleRef = useRef(scale);
  const panRef = useRef(pan);
  const viewportRef = useRef<ViewportState>({ scale, pan });

  // Sync refs with state
  useEffect(() => {
    scaleRef.current = scale;
    viewportRef.current = { ...viewportRef.current, scale };
  }, [scale]);

  useEffect(() => {
    panRef.current = pan;
    viewportRef.current = { ...viewportRef.current, pan };
  }, [pan]);

  // Setters with bounds checking
  const setScale = useCallback((value: number | ((prev: number) => number)) => {
    setScaleState(prev => {
      const newScale = typeof value === 'function' ? value(prev) : value;
      return Math.min(Math.max(minScale, newScale), maxScale);
    });
  }, [minScale, maxScale]);

  const setPan = useCallback((value: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
    setPanState(prev => typeof value === 'function' ? value(prev) : value);
  }, []);

  const setViewport = useCallback((value: ViewportState | ((prev: ViewportState) => ViewportState)) => {
    if (typeof value === 'function') {
      const newViewport = value(viewportRef.current);
      setScaleState(Math.min(Math.max(minScale, newViewport.scale), maxScale));
      setPanState(newViewport.pan);
    } else {
      setScaleState(Math.min(Math.max(minScale, value.scale), maxScale));
      setPanState(value.pan);
    }
  }, [minScale, maxScale]);

  // Coordinate conversion utilities
  const screenToCanvas = useCallback((screenX: number, screenY: number, containerRect?: DOMRect) => {
    const currentScale = scaleRef.current;
    const currentPan = panRef.current;
    const offsetX = containerRect ? screenX - containerRect.left : screenX;
    const offsetY = containerRect ? screenY - containerRect.top : screenY;
    return {
      x: (offsetX - currentPan.x) / currentScale,
      y: (offsetY - currentPan.y) / currentScale,
    };
  }, []);

  const canvasToScreen = useCallback((canvasX: number, canvasY: number, containerRect?: DOMRect) => {
    const currentScale = scaleRef.current;
    const currentPan = panRef.current;
    const screenX = canvasX * currentScale + currentPan.x;
    const screenY = canvasY * currentScale + currentPan.y;
    return {
      x: containerRect ? screenX + containerRect.left : screenX,
      y: containerRect ? screenY + containerRect.top : screenY,
    };
  }, []);

  // Wheel handler for zoom and pan
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const rect = target?.getBoundingClientRect();
    if (!rect) return;

    if (e.ctrlKey || e.metaKey) {
      // Zoom centered on mouse position
      const currentScale = scaleRef.current;
      const currentPan = panRef.current;

      // Mouse position in container
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Mouse position in canvas coordinates
      const canvasX = (mouseX - currentPan.x) / currentScale;
      const canvasY = (mouseY - currentPan.y) / currentScale;

      // Calculate new scale with smooth factor
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(minScale, currentScale * zoomFactor), maxScale);

      // Calculate new pan to keep canvas position under mouse stable
      const newPanX = mouseX - canvasX * newScale;
      const newPanY = mouseY - canvasY * newScale;

      setScaleState(newScale);
      setPanState({ x: newPanX, y: newPanY });
    } else {
      // Pan canvas
      setPanState(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, [minScale, maxScale]);

  // Hook to attach wheel listener with passive: false
  const useWheelListener = useCallback((containerRef: RefObject<HTMLDivElement | null>) => {
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }, [containerRef]);
  }, [handleWheel]);

  return {
    // State
    scale,
    pan,
    viewport: { scale, pan },

    // Refs
    scaleRef,
    panRef,
    viewportRef,

    // Setters
    setScale,
    setPan,
    setViewport,

    // Utilities
    screenToCanvas,
    canvasToScreen,

    // Wheel handling
    handleWheel,
    useWheelListener,
  };
}
