"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Node } from './Node';
import { SidebarDock } from './SidebarDock';
import { useViewport, useInteraction, useCanvasData, useCanvasHistory } from '@/hooks/canvas';
import { AssistantPanel } from './AssistantPanel';
import { ImageCropper } from './ImageCropper';
import { ImageEditOverlay } from './ImageEditOverlay';
import { generateViduMultiFrame, queryViduTask, ViduMultiFrameConfig } from '@/services/viduService';
import { SettingsModal } from './SettingsModal';
import { AppNode, NodeType, NodeStatus, Connection, ContextMenuState, Group, Workflow, Canvas, VideoGenerationMode } from '@/types';
import { generateImageFromText, generateVideo, analyzeImage, editImageWithText, planStoryboard, orchestrateVideoPrompt, urlToBase64, extractLastFrame, generateAudio } from '@/services/geminiService';
import { getGenerationStrategy } from '@/services/videoStrategies';
import { createMusicCustom, SunoSongInfo } from '@/services/sunoService';
import { synthesizeSpeech, MinimaxGenerateParams } from '@/services/minimaxService';
import { saveToStorage, loadFromStorage } from '@/services/storage';
import {
    Plus, Copy, Trash2, Type, Image as ImageIcon, Video as VideoIcon,
    MousePointerClick, LayoutTemplate, X, RefreshCw, Film, Brush, Mic2, Music, FileSearch,
    Minus, FolderHeart, Unplug, Sparkles, ChevronLeft, ChevronRight, Scan,
    Undo2, Redo2
} from 'lucide-react';

// Apple Physics Curve
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const SNAP_THRESHOLD = 8; // Pixels for magnetic snap
const COLLISION_PADDING = 24; // Spacing when nodes bounce off each other

// 连接点配置 - 与 Node.tsx 中的连接点位置保持一致
const PORT_OFFSET = 12; // 连接点中心到节点边缘的基础距离

// 生成平滑贝塞尔曲线路径
const generateBezierPath = (fx: number, fy: number, tx: number, ty: number): string => {
    const dx = tx - fx;
    const dy = ty - fy;
    // 控制点偏移：水平距离越大，曲线越平缓；垂直落差越大，曲线越陡
    const controlX = Math.max(Math.abs(dx) * 0.5, 60);
    // 当终点在起点左边时（反向连接），调整控制点
    if (dx < 0) {
        const midX = (fx + tx) / 2;
        const midY = (fy + ty) / 2;
        return `M ${fx} ${fy} Q ${fx + 80} ${fy}, ${midX} ${midY} Q ${tx - 80} ${ty}, ${tx} ${ty}`;
    }
    return `M ${fx} ${fy} C ${fx + controlX} ${fy}, ${tx - controlX} ${ty}, ${tx} ${ty}`;
};

// Helper to get image dimensions
const getImageDimensions = (src: string): Promise<{ width: number, height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = src;
    });
};

// Expanded View Component (Modal)
const ExpandedView = ({ media, onClose }: { media: any, onClose: () => void }) => {
    const [visible, setVisible] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (media) {
            requestAnimationFrame(() => setVisible(true));
            setCurrentIndex(media.initialIndex || 0);
        } else {
            setVisible(false);
        }
    }, [media]);

    const handleClose = useCallback(() => {
        setVisible(false);
        setTimeout(onClose, 400);
    }, [onClose]);

    const hasMultiple = media?.images && media.images.length > 1;

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (hasMultiple) {
            setCurrentIndex((prev) => (prev + 1) % media.images.length);
        }
    }, [hasMultiple, media]);

    const handlePrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (hasMultiple) {
            setCurrentIndex((prev) => (prev - 1 + media.images.length) % media.images.length);
        }
    }, [hasMultiple, media]);

    useEffect(() => {
        if (!visible) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, handleClose, handleNext, handlePrev]);

    if (!media) return null;

    // Determine current source and type
    const currentSrc = hasMultiple ? media.images[currentIndex] : media.src;
    const isVideo = (media.type === 'video') && !(currentSrc && currentSrc.startsWith('data:image'));

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500 ease-[${SPRING}] ${visible ? 'bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl' : 'bg-transparent pointer-events-none opacity-0'}`} onClick={handleClose}>
            <div className={`relative w-full h-full flex items-center justify-center p-8 transition-all duration-500 ease-[${SPRING}] ${visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`} onClick={e => e.stopPropagation()}>

                {hasMultiple && (
                    <button
                        onClick={handlePrev}
                        className="absolute left-4 md:left-8 p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-700 dark:text-slate-300 shadow-md transition-all hover:scale-110 z-[110]"
                    >
                        <ChevronLeft size={32} />
                    </button>
                )}

                <div className="relative max-w-full max-h-full flex flex-col items-center">
                    {!isVideo ? (
                        <img
                            key={currentSrc}
                            src={currentSrc}
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in fade-in duration-300 bg-white dark:bg-slate-900"
                            draggable={false}
                        />
                    ) : (
                        <video
                            key={currentSrc}
                            src={currentSrc}
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in fade-in duration-300 bg-white dark:bg-slate-900"
                            controls
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="auto"
                        />
                    )}

                    {hasMultiple && (
                        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-2">
                            {media.images.map((_: any, i: number) => (
                                <div
                                    key={i}
                                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                                    className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${i === currentIndex ? 'bg-cyan-500 scale-125' : 'bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500'}`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {hasMultiple && (
                    <button
                        onClick={handleNext}
                        className="absolute right-4 md:right-8 p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-700 dark:text-slate-300 shadow-md transition-all hover:scale-110 z-[110]"
                    >
                        <ChevronRight size={32} />
                    </button>
                )}

            </div>
            <button onClick={handleClose} className="absolute top-6 right-6 p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-700 dark:text-slate-300 shadow-md transition-colors z-[110]"><X size={24} /></button>
        </div>
    );
};

export default function StudioTab() {
    // === HOOKS ===
    // Viewport Hook - 替换原有的 scale, pan, scaleRef, panRef
    const {
        scale, pan, setScale, setPan,
        scaleRef, panRef,
        screenToCanvas: viewportScreenToCanvas,
    } = useViewport();

    // Interaction Hook - 交互状态机
    const {
        mode,
        modeRef,
        selection,
        setSelection,
        selectNodes,
        selectGroups,
        clearSelection,
        mousePos, setMousePos,
        isSpacePressed, setIsSpacePressed,
        // Selection rect
        startSelecting,
        updateSelecting,
        finishInteraction,
        isSelecting,
        // Connecting
        startConnecting,
        isConnecting,
        // Panning
        startPanning,
        updatePanning,
        isPanning,
    } = useInteraction();

    // 解构选择状态（兼容现有代码）
    const selectedNodeIds = selection.nodeIds;
    const selectedGroupIds = selection.groupIds;
    // 兼容 selectionRect（从 mode 中提取）
    const selectionRect = mode.type === 'selecting' ? mode.rect : null;
    // 兼容 connectionStart（从 mode 中提取）
    const connectionStart = mode.type === 'connecting' ? mode.start : null;
    // Helper: 从 modeRef 获取 connectionStart（用于事件处理器中避免闭包问题）
    const getConnectionStartRef = useCallback(() => {
        const currentMode = modeRef.current;
        return currentMode.type === 'connecting' ? currentMode.start : null;
    }, [modeRef]);
    // 兼容 isDraggingCanvas（从 isPanning 别名）
    const isDraggingCanvas = isPanning;
    // Helper: 从 modeRef 获取 panning 的 lastPos（用于事件处理器中避免闭包问题）
    const getPanningLastPos = useCallback(() => {
        const currentMode = modeRef.current;
        return currentMode.type === 'panning' ? currentMode.lastPos : null;
    }, [modeRef]);

    // Canvas Data Hook - 画布数据 (nodes, connections, groups)
    const {
        nodes, setNodes, nodesRef,
        connections, setConnections, connectionsRef,
        groups, setGroups, groupsRef,
        loadData,
    } = useCanvasData();

    // History Hook - 撤销/重做
    const {
        historyRef, historyIndexRef,
        canUndo, canRedo,
        saveSnapshot,
        undo: undoHistory,
        redo: redoHistory,
    } = useCanvasHistory();

    // --- Global App State ---
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [assetHistory, setAssetHistory] = useState<any[]>([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    // Load theme preference
    useEffect(() => {
        const savedTheme = localStorage.getItem('lsai-theme') as 'light' | 'dark' | null;
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.classList.toggle('dark', savedTheme === 'dark');
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
            document.documentElement.classList.toggle('dark', true);
        }
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('lsai-theme', theme);
    }, [theme]);

    // Settings State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Canvas Management State
    const [canvases, setCanvases] = useState<Canvas[]>([]);
    const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(null);

    // --- Canvas State ---
    // nodes, setNodes, connections, setConnections, groups, setGroups 已迁移到 useCanvasData Hook
    // history, historyIndex, historyRef, historyIndexRef 已迁移到 useCanvasHistory Hook
    const [clipboard, setClipboard] = useState<AppNode | null>(null);

    // Viewport (scale, pan 已迁移到 useViewport, mousePos 已迁移到 useInteraction)
    // isDraggingCanvas 已迁移到 useInteraction.isPanning
    // lastMousePos (panning) 已迁移到 useInteraction.mode.lastPos
    // 保留 lastMousePos 仅用于 draggingNode fallback 场景
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    // Interaction / Selection (已迁移到 useInteraction)
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [draggingNodeParentGroupId, setDraggingNodeParentGroupId] = useState<string | null>(null);
    const [draggingGroup, setDraggingGroup] = useState<any>(null);
    const [resizingGroupId, setResizingGroupId] = useState<string | null>(null);
    const [activeGroupNodeIds, setActiveGroupNodeIds] = useState<string[]>([]);
    // connectionStart 已迁移到 useInteraction.mode
    // selectionRect 已迁移到 useInteraction.mode
    // isSpacePressed 已迁移到 useInteraction

    // Node Resizing
    const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
    const [initialSize, setInitialSize] = useState<{ width: number, height: number } | null>(null);
    const [resizeStartPos, setResizeStartPos] = useState<{ x: number, y: number } | null>(null);

    // Context Menu
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [contextMenuTarget, setContextMenuTarget] = useState<any>(null);

    // Media Overlays
    const [expandedMedia, setExpandedMedia] = useState<any>(null);
    const [editingImage, setEditingImage] = useState<{ nodeId: string; src: string; originalImage?: string; canvasData?: string } | null>(null);
    const [croppingNodeId, setCroppingNodeId] = useState<string | null>(null);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [videoToCrop, setVideoToCrop] = useState<string | null>(null); // 视频帧选择源

    // 组图拖拽放置预览状态
    const [gridDragDropPreview, setGridDragDropPreview] = useState<{
        type: 'image' | 'video';
        src: string;
        canvasX: number;
        canvasY: number;
    } | null>(null);

    // 复制拖拽预览状态
    const [copyDragPreview, setCopyDragPreview] = useState<{
        nodes: { x: number; y: number; width: number; height: number }[];
    } | null>(null);

    // Refs for closures
    // nodesRef, connectionsRef, groupsRef 已迁移到 useCanvasData Hook
    // historyRef, historyIndexRef 已迁移到 useCanvasHistory Hook
    // connectionStartRef 已迁移：使用 modeRef 获取 connectionStart
    const rafRef = useRef<number | null>(null); // For RAF Throttling
    const canvasContainerRef = useRef<HTMLDivElement>(null); // Canvas container ref for coordinate offset
    const nodeRefsMap = useRef<Map<string, HTMLDivElement>>(new Map()); // 节点 DOM 引用，用于直接操作
    const groupRefsMap = useRef<Map<string, HTMLDivElement>>(new Map()); // 分组 DOM 引用，用于直接操作
    const connectionPathsRef = useRef<Map<string, SVGPathElement>>(new Map()); // 连接线 SVG path 引用
    const dragPositionsRef = useRef<Map<string, { x: number, y: number }>>(new Map()); // 拖拽中节点的实时位置

    // Replacement Input Refs
    const replaceVideoInputRef = useRef<HTMLInputElement>(null);
    const replaceImageInputRef = useRef<HTMLInputElement>(null);
    const replacementTargetRef = useRef<string | null>(null);

    // Interaction Refs
    const dragNodeRef = useRef<{
        id: string,
        startX: number,
        startY: number,
        mouseStartX: number,
        mouseStartY: number,
        parentGroupId?: string | null,
        siblingNodeIds: string[],
        nodeWidth: number,
        nodeHeight: number,
        // 多选拖动：其他被选中节点的初始位置
        otherSelectedNodes?: { id: string, startX: number, startY: number }[],
        // 多选拖动：被选中的分组的初始位置及其内部节点
        selectedGroups?: { id: string, startX: number, startY: number, childNodes: { id: string, startX: number, startY: number }[] }[],
        // 当前拖拽位置（用于 DOM 直接操作后提交 state）
        currentX?: number,
        currentY?: number,
        currentDx?: number,
        currentDy?: number,
        // Cmd/Ctrl + 拖拽复制
        isCopyDrag?: boolean
    } | null>(null);

    const resizeContextRef = useRef<{
        nodeId: string,
        initialWidth: number,
        initialHeight: number,
        startX: number,
        startY: number,
        parentGroupId: string | null,
        siblingNodeIds: string[]
    } | null>(null);

    const dragGroupRef = useRef<{
        id: string,
        startX: number,
        startY: number,
        mouseStartX: number,
        mouseStartY: number,
        childNodes: { id: string, startX: number, startY: number }[]
    } | null>(null);

    const resizeGroupRef = useRef<{
        id: string,
        initialWidth: number,
        initialHeight: number,
        startX: number,
        startY: number,
        currentWidth?: number,
        currentHeight?: number
    } | null>(null);

    // Helper to get mouse position relative to canvas container (accounting for Navbar offset)
    const getCanvasMousePos = useCallback((clientX: number, clientY: number) => {
        if (!canvasContainerRef.current) return { x: clientX, y: clientY };
        const rect = canvasContainerRef.current.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }, []);

    // nodesRef, connectionsRef, groupsRef 的同步已由 useCanvasData 内部处理
    // historyRef, historyIndexRef 的同步已由 useCanvasHistory 内部处理

    // --- Persistence ---
    useEffect(() => {
        const win = window as any;
        if (win.aistudio) win.aistudio.hasSelectedApiKey().then((hasKey: boolean) => { if (!hasKey) win.aistudio.openSelectKey(); });
        const loadData = async () => {
            try {
                const sAssets = await loadFromStorage<any[]>('assets'); if (sAssets) setAssetHistory(sAssets);
                const sWfs = await loadFromStorage<Workflow[]>('workflows'); if (sWfs) setWorkflows(sWfs);

                // Load canvases
                const sCanvases = await loadFromStorage<Canvas[]>('canvases');
                const sCurrentCanvasId = await loadFromStorage<string>('currentCanvasId');

                if (sCanvases && sCanvases.length > 0) {
                    setCanvases(sCanvases);
                    // 恢复上次使用的画布
                    const canvasToLoad = sCurrentCanvasId
                        ? sCanvases.find(c => c.id === sCurrentCanvasId) || sCanvases[0]
                        : sCanvases[0];
                    setCurrentCanvasId(canvasToLoad.id);
                    setNodes(JSON.parse(JSON.stringify(canvasToLoad.nodes)));
                    setConnections(JSON.parse(JSON.stringify(canvasToLoad.connections)));
                    setGroups(JSON.parse(JSON.stringify(canvasToLoad.groups)));

                    // 恢复视口状态，如果有保存的话
                    if (canvasToLoad.pan && canvasToLoad.scale) {
                        setPan(canvasToLoad.pan);
                        setScale(canvasToLoad.scale);
                    } else if (canvasToLoad.nodes.length > 0) {
                        // 没有保存的视口状态，延迟调用 fitToContent
                        setTimeout(() => {
                            // 使用内联的 fitToContent 逻辑
                            const loadedNodes = canvasToLoad.nodes;
                            if (loadedNodes.length === 0) return;
                            const padding = 80;
                            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                            loadedNodes.forEach((n: AppNode) => {
                                const h = n.height || 360;
                                const w = n.width || 420;
                                if (n.x < minX) minX = n.x;
                                if (n.y < minY) minY = n.y;
                                if (n.x + w > maxX) maxX = n.x + w;
                                if (n.y + h > maxY) maxY = n.y + h;
                            });
                            const contentW = maxX - minX;
                            const contentH = maxY - minY;
                            const scaleX = (window.innerWidth - padding * 2) / contentW;
                            const scaleY = (window.innerHeight - padding * 2) / contentH;
                            let newScale = Math.min(scaleX, scaleY, 1);
                            newScale = Math.max(0.2, newScale);
                            const contentCenterX = minX + contentW / 2;
                            const contentCenterY = minY + contentH / 2;
                            const newPanX = (window.innerWidth / 2) - (contentCenterX * newScale);
                            const newPanY = (window.innerHeight / 2) - (contentCenterY * newScale);
                            setPan({ x: newPanX, y: newPanY });
                            setScale(newScale);
                        }, 100);
                    }
                } else {
                    // 兼容旧数据：如果没有画布数据，从旧的 nodes/connections/groups 迁移
                    const sNodes = await loadFromStorage<AppNode[]>('nodes');
                    const sConns = await loadFromStorage<Connection[]>('connections');
                    const sGroups = await loadFromStorage<Group[]>('groups');

                    const now = Date.now();
                    const defaultCanvas: Canvas = {
                        id: `canvas-${now}`,
                        title: '默认画布',
                        nodes: sNodes || [],
                        connections: sConns ? sConns.filter((conn, idx, arr) =>
                            arr.findIndex(c => c.from === conn.from && c.to === conn.to) === idx
                        ) : [],
                        groups: sGroups || [],
                        createdAt: now,
                        updatedAt: now
                    };

                    setCanvases([defaultCanvas]);
                    setCurrentCanvasId(defaultCanvas.id);
                    if (sNodes) setNodes(sNodes);
                    if (sConns) {
                        const uniqueConns = sConns.filter((conn, idx, arr) =>
                            arr.findIndex(c => c.from === conn.from && c.to === conn.to) === idx
                        );
                        setConnections(uniqueConns);
                    }
                    if (sGroups) setGroups(sGroups);
                }
            } catch (e) {
                console.error("Failed to load storage", e);
            } finally {
                setIsLoaded(true);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (!isLoaded) return;

        saveToStorage('assets', assetHistory);
        saveToStorage('workflows', workflows);
        saveToStorage('canvases', canvases);
        saveToStorage('currentCanvasId', currentCanvasId);
        // 保留旧的 keys 用于向后兼容，但主要数据在 canvases 中
        saveToStorage('nodes', nodes);
        saveToStorage('connections', connections);
        saveToStorage('groups', groups);
    }, [assetHistory, workflows, nodes, connections, groups, canvases, currentCanvasId, isLoaded]);


    const getApproxNodeHeight = (node: AppNode) => {
        if (node.height) return node.height;
        const width = node.width || 420;
        if (node.type === NodeType.IMAGE_EDITOR) return 360;
        if (node.type === NodeType.AUDIO_GENERATOR) return Math.round(width * 9 / 16); // 16:9 比例
        // 提示词节点和素材节点默认 16:9 比例
        const defaultRatio = (node.type === NodeType.PROMPT_INPUT || node.type === NodeType.IMAGE_ASSET || node.type === NodeType.VIDEO_ASSET) ? '16:9' : '1:1';
        const [w, h] = (node.data.aspectRatio || defaultRatio).split(':').map(Number);
        return (width * h / w);
    };

    const getNodeBounds = (node: AppNode) => {
        const h = node.height || getApproxNodeHeight(node);
        const w = node.width || 420;
        return { x: node.x, y: node.y, width: w, height: h, r: node.x + w, b: node.y + h };
    };

    // 获取节点的实时位置（优先使用拖拽位置）
    const getNodePosition = (nodeId: string) => {
        const dragPos = dragPositionsRef.current.get(nodeId);
        if (dragPos) return dragPos;
        const node = nodesRef.current.find(n => n.id === nodeId);
        return node ? { x: node.x, y: node.y } : null;
    };

    // 计算连接点中心位置
    const getPortCenter = (node: AppNode, portType: 'input' | 'output') => {
        const pos = getNodePosition(node.id) || { x: node.x, y: node.y };
        const width = node.width || 420;
        const height = node.height || getApproxNodeHeight(node);

        // 如果是 output 端口，检查节点是否在有 hasOutputPort 的分组中
        if (portType === 'output') {
            const sourceGroup = groupsRef.current.find(g => {
                if (!g.hasOutputPort) return false;
                const cx = pos.x + width / 2;
                const cy = pos.y + height / 2;
                return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height;
            });
            if (sourceGroup) {
                return {
                    x: sourceGroup.x + sourceGroup.width + PORT_OFFSET,
                    y: sourceGroup.y + sourceGroup.height / 2
                };
            }
        }

        const y = pos.y + height / 2;
        // 连接点中心 = 节点边缘 + PORT_OFFSET（连接点在节点外部）
        return portType === 'output'
            ? { x: pos.x + width + PORT_OFFSET, y }
            : { x: pos.x - PORT_OFFSET, y };
    };

    // 更新与指定节点相关的所有连接线
    const updateConnectionPaths = (nodeIds: string[]) => {
        const nodeIdSet = new Set(nodeIds);
        connectionsRef.current.forEach(conn => {
            if (!nodeIdSet.has(conn.from) && !nodeIdSet.has(conn.to)) return;

            const pathEl = connectionPathsRef.current.get(`${conn.from}-${conn.to}`);
            const hitPathEl = connectionPathsRef.current.get(`${conn.from}-${conn.to}-hit`);
            if (!pathEl) return;

            const fromNode = nodesRef.current.find(n => n.id === conn.from);
            const toNode = nodesRef.current.find(n => n.id === conn.to);
            if (!fromNode || !toNode) return;

            const from = getPortCenter(fromNode, 'output');
            const to = getPortCenter(toNode, 'input');
            // 避免完全水平时渲染问题
            if (Math.abs(from.y - to.y) < 0.5) to.y += 0.5;

            const d = generateBezierPath(from.x, from.y, to.x, to.y);
            pathEl.setAttribute('d', d);
            if (hitPathEl) hitPathEl.setAttribute('d', d);
        });
    };

    // 检测两个矩形是否重叠
    const isOverlapping = (a: { x: number, y: number, width: number, height: number }, b: { x: number, y: number, width: number, height: number }, padding = 20) => {
        return !(a.x + a.width + padding < b.x || b.x + b.width + padding < a.x || a.y + a.height + padding < b.y || b.y + b.height + padding < a.y);
    };

    // 找到不重叠的位置
    const findNonOverlappingPosition = (startX: number, startY: number, width: number, height: number, existingNodes: AppNode[], direction: 'right' | 'down' | 'up' = 'right'): { x: number, y: number } => {
        let x = startX, y = startY;
        const step = direction === 'right' ? 80 : direction === 'up' ? 80 : 60;
        const maxAttempts = 20;

        for (let i = 0; i < maxAttempts; i++) {
            const candidate = { x, y, width, height };
            const hasOverlap = existingNodes.some(node => {
                const bounds = getNodeBounds(node);
                return isOverlapping(candidate, bounds);
            });

            if (!hasOverlap) return { x, y };

            // 尝试下一个位置
            if (direction === 'right') {
                x += step;
            } else if (direction === 'up') {
                y -= step; // 向上偏移
            } else {
                y += step;
            }
        }

        return { x, y }; // 返回最后尝试的位置
    };

    const getNodeNameCN = (t: string) => {
        switch (t) {
            case NodeType.PROMPT_INPUT: return '提示词';
            case NodeType.IMAGE_ASSET: return '插入图片';
            case NodeType.VIDEO_ASSET: return '插入视频';
            case NodeType.IMAGE_GENERATOR: return '图片生成';
            case NodeType.VIDEO_GENERATOR: return '视频生成';
            case NodeType.VIDEO_FACTORY: return '视频工厂';
            case NodeType.AUDIO_GENERATOR: return '灵感音乐';
            case NodeType.IMAGE_EDITOR: return '图像编辑';
            case NodeType.MULTI_FRAME_VIDEO: return '智能多帧';
            default: return t;
        }
    };
    const getNodeIcon = (t: string) => {
        switch (t) {
            case NodeType.PROMPT_INPUT: return Type;
            case NodeType.IMAGE_ASSET: return ImageIcon;
            case NodeType.VIDEO_ASSET: return VideoIcon;
            case NodeType.IMAGE_GENERATOR: return ImageIcon;
            case NodeType.VIDEO_GENERATOR: return Film;
            case NodeType.VIDEO_FACTORY: return VideoIcon;
            case NodeType.AUDIO_GENERATOR: return Mic2;
            case NodeType.IMAGE_EDITOR: return Brush;
            case NodeType.MULTI_FRAME_VIDEO: return Scan;
            default: return Plus;
        }
    };

    const handleFitView = useCallback(() => {
        if (nodes.length === 0) {
            setPan({ x: 0, y: 0 });
            setScale(1);
            return;
        }

        const padding = 100;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(n => {
            const h = n.height || getApproxNodeHeight(n);
            const w = n.width || 420;
            if (n.x < minX) minX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.x + w > maxX) maxX = n.x + w;
            if (n.y + h > maxY) maxY = n.y + h;
        });

        const contentW = maxX - minX;
        const contentH = maxY - minY;

        const scaleX = (window.innerWidth - padding * 2) / contentW;
        const scaleY = (window.innerHeight - padding * 2) / contentH;
        let newScale = Math.min(scaleX, scaleY, 1);
        newScale = Math.max(0.2, newScale);

        const contentCenterX = minX + contentW / 2;
        const contentCenterY = minY + contentH / 2;

        const newPanX = (window.innerWidth / 2) - (contentCenterX * newScale);
        const newPanY = (window.innerHeight / 2) - (contentCenterY * newScale);

        setPan({ x: newPanX, y: newPanY });
        setScale(newScale);
    }, [nodes]);

    // 使用 useCanvasHistory 的 saveSnapshot
    const saveHistory = useCallback(() => {
        try {
            saveSnapshot({
                nodes: nodesRef.current,
                connections: connectionsRef.current,
                groups: groupsRef.current,
            });
        } catch (e) {
            console.warn("History save failed:", e);
        }
    }, [saveSnapshot, nodesRef, connectionsRef, groupsRef]);

    // 使用 useCanvasHistory 的 undo 和 useCanvasData 的 loadData
    const undo = useCallback(() => {
        const prev = undoHistory();
        if (prev) loadData(prev);
    }, [undoHistory, loadData]);

    // redo 功能 (可选)
    const redo = useCallback(() => {
        const next = redoHistory();
        if (next) loadData(next);
    }, [redoHistory, loadData]);

    const deleteNodes = useCallback((ids: string[]) => {
        if (ids.length === 0) return;
        saveHistory();
        setNodes(p => p.filter(n => !ids.includes(n.id)).map(n => ({ ...n, inputs: n.inputs.filter(i => !ids.includes(i)) })));
        setConnections(p => p.filter(c => !ids.includes(c.from) && !ids.includes(c.to)));
        selectNodes([]);
    }, [saveHistory, selectNodes]);

    const addNode = useCallback((type: NodeType, x?: number, y?: number, initialData?: any) => {
        // IMAGE_EDITOR type removed - use ImageEditOverlay on existing images instead

        try { saveHistory(); } catch (e) { }

        // 确定音频节点的默认模式和模型
        const defaultAudioMode = initialData?.audioMode || 'music';
        const defaultAudioModel = defaultAudioMode === 'music' ? 'suno-v4' : 'speech-2.6-hd';

        const defaults: any = {
            model: type === NodeType.VIDEO_GENERATOR ? 'veo3.1' :
                type === NodeType.AUDIO_GENERATOR ? defaultAudioModel :
                    type.includes('IMAGE') ? 'doubao-seedream-4-5-251128' :
                        'gemini-2.5-flash',
            generationMode: type === NodeType.VIDEO_GENERATOR ? 'DEFAULT' : undefined,
            // 图像/视频节点默认比例为 16:9
            aspectRatio: (type === NodeType.IMAGE_GENERATOR || type === NodeType.VIDEO_GENERATOR || type === NodeType.VIDEO_FACTORY || type === NodeType.MULTI_FRAME_VIDEO) ? '16:9' : undefined,
            // 音频节点默认配置
            audioMode: type === NodeType.AUDIO_GENERATOR ? defaultAudioMode : undefined,
            musicConfig: type === NodeType.AUDIO_GENERATOR ? { mv: 'chirp-v4', tags: 'pop, catchy' } : undefined,
            voiceConfig: type === NodeType.AUDIO_GENERATOR ? { voiceId: 'female-shaonv', speed: 1, emotion: 'calm' } : undefined,
            // 多帧视频节点默认配置
            multiFrameData: type === NodeType.MULTI_FRAME_VIDEO ? { frames: [], viduModel: 'viduq2-turbo', viduResolution: '720p' } : undefined,
            ...initialData
        };

        const typeMap: Record<string, string> = {
            [NodeType.PROMPT_INPUT]: '提示词',
            [NodeType.IMAGE_ASSET]: '插入图片',
            [NodeType.VIDEO_ASSET]: '插入视频',
            [NodeType.IMAGE_GENERATOR]: '图片生成',
            [NodeType.VIDEO_GENERATOR]: '视频生成',
            [NodeType.VIDEO_FACTORY]: '视频工厂',
            [NodeType.AUDIO_GENERATOR]: '灵感音乐',
            [NodeType.IMAGE_EDITOR]: '图像编辑',
            [NodeType.MULTI_FRAME_VIDEO]: '智能多帧'
        };

        const baseX = x !== undefined ? x : (-pan.x + window.innerWidth / 2) / scale - 210;
        const baseY = y !== undefined ? y : (-pan.y + window.innerHeight / 2) / scale - 180;
        const safeBaseX = isNaN(baseX) ? 100 : baseX;
        const safeBaseY = isNaN(baseY) ? 100 : baseY;

        // 计算节点预估高度并找到不重叠的位置
        const nodeWidth = 420;
        const [rw, rh] = (defaults.aspectRatio || '16:9').split(':').map(Number);
        const nodeHeight = type === NodeType.AUDIO_GENERATOR ? Math.round(nodeWidth * 9 / 16) : // 16:9 比例
            type === NodeType.PROMPT_INPUT ? Math.round(nodeWidth * 9 / 16) : // 16:9 比例
                type === NodeType.MULTI_FRAME_VIDEO ? Math.round(nodeWidth * 9 / 16) : // 16:9 比例
                    (nodeWidth * rh / rw);

        const { x: finalX, y: finalY } = findNonOverlappingPosition(safeBaseX, safeBaseY, nodeWidth, nodeHeight, nodesRef.current, 'down');

        const newNode: AppNode = {
            id: `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type,
            x: finalX,
            y: finalY,
            width: nodeWidth,
            title: typeMap[type] || '未命名节点',
            status: NodeStatus.IDLE,
            data: defaults,
            inputs: []
        };

        setNodes(prev => [...prev, newNode]);
    }, [pan, scale, saveHistory]);

    const handleAssetGenerated = useCallback((type: 'image' | 'video' | 'audio', src: string, title: string) => {
        setAssetHistory(h => {
            const exists = h.find(a => a.src === src);
            if (exists) return h;
            return [{ id: `a-${Date.now()}`, type, src, title, timestamp: Date.now() }, ...h];
        });
    }, []);

    // 检查画布坐标是否在空白区域（不与任何节点重叠）
    const isPointOnEmptyCanvas = useCallback((canvasX: number, canvasY: number): boolean => {
        // 检查点是否在任何现有节点内部
        for (const node of nodesRef.current) {
            const bounds = getNodeBounds(node);
            if (
                canvasX >= bounds.x &&
                canvasX <= bounds.x + bounds.width &&
                canvasY >= bounds.y &&
                canvasY <= bounds.y + bounds.height
            ) {
                return false; // 在节点上
            }
        }
        // 检查是否在任何分组标题栏上（可选）
        for (const group of groupsRef.current) {
            if (
                canvasX >= group.x &&
                canvasX <= group.x + group.width &&
                canvasY >= group.y &&
                canvasY <= group.y + 40 // 标题栏高度约40px
            ) {
                return false;
            }
        }
        return true; // 空白区域
    }, []);

    // 处理组图拖拽状态变化，用于显示放置预览
    const handleGridDragStateChange = useCallback((state: { isDragging: boolean; type?: 'image' | 'video'; src?: string; screenX?: number; screenY?: number } | null) => {
        if (!state || !state.isDragging || !state.type || !state.src || !state.screenX || !state.screenY) {
            setGridDragDropPreview(null);
            return;
        }

        // 将屏幕坐标转换为画布坐标
        const rect = canvasContainerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const canvasX = (state.screenX - rect.left - pan.x) / scale;
        const canvasY = (state.screenY - rect.top - pan.y) / scale;

        // 仅当鼠标在空白画布区域时才显示预览
        if (!isPointOnEmptyCanvas(canvasX, canvasY)) {
            setGridDragDropPreview(null);
            return;
        }

        setGridDragDropPreview({
            type: state.type,
            src: state.src,
            canvasX: canvasX - 210, // 节点宽度一半
            canvasY: canvasY - 120, // 大致居中
        });
    }, [pan, scale, isPointOnEmptyCanvas]);

    // 从组图宫格拖拽某个结果到画布，创建独立副本节点
    const handleDragResultToCanvas = useCallback((sourceNodeId: string, type: 'image' | 'video', src: string, screenX: number, screenY: number) => {
        // 清除预览
        setGridDragDropPreview(null);

        // 将屏幕坐标转换为画布坐标
        const rect = canvasContainerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const canvasX = (screenX - rect.left - pan.x) / scale;
        const canvasY = (screenY - rect.top - pan.y) / scale;

        // 仅当鼠标在空白画布区域时才创建节点
        if (!isPointOnEmptyCanvas(canvasX, canvasY)) {
            return; // 不在空白区域，不创建
        }

        // 获取源节点信息以复制相关配置
        const sourceNode = nodesRef.current.find(n => n.id === sourceNodeId);
        if (!sourceNode) return;

        saveHistory();

        // 计算节点尺寸
        const nodeWidth = 420;
        const ratio = sourceNode.data.aspectRatio || '16:9';
        const [rw, rh] = ratio.split(':').map(Number);
        const nodeHeight = (nodeWidth * rh) / rw;

        // 寻找不重叠的位置
        const { x: finalX, y: finalY } = findNonOverlappingPosition(
            canvasX - nodeWidth / 2,
            canvasY - nodeHeight / 2,
            nodeWidth,
            nodeHeight,
            nodesRef.current,
            'right'
        );

        // 创建新节点（复制源节点的部分配置）
        const newNode: AppNode = {
            id: `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type: type === 'image' ? NodeType.IMAGE_GENERATOR : NodeType.VIDEO_GENERATOR,
            x: finalX,
            y: finalY,
            width: nodeWidth,
            title: type === 'image' ? '图片副本' : '视频副本',
            status: NodeStatus.SUCCESS,
            data: {
                model: sourceNode.data.model,
                aspectRatio: sourceNode.data.aspectRatio,
                prompt: sourceNode.data.prompt,
                ...(type === 'image'
                    ? { image: src, images: [src] }
                    : { videoUri: src, videoUris: [src] }
                ),
            },
            inputs: [],
        };

        setNodes(prev => [...prev, newNode]);
        // 选中新创建的节点
        selectNodes([newNode.id]);
    }, [pan, scale, saveHistory, isPointOnEmptyCanvas, selectNodes]);

    // 批量上传素材：创建多个纵向排布的节点并用分组框包裹
    const handleBatchUpload = useCallback(async (files: File[], type: 'image' | 'video', sourceNodeId: string) => {
        if (files.length === 0) return;

        saveHistory();

        const sourceNode = nodesRef.current.find(n => n.id === sourceNodeId);
        if (!sourceNode) return;

        // 节点参数
        const nodeWidth = 420;
        const defaultHeight = type === 'image' ? 315 : 236; // 4:3 for images, 16:9 for videos
        const verticalGap = 24; // 节点间垂直间距
        const groupPadding = 30; // 分组框内边距

        // 计算起始位置（在源节点右侧）
        const startX = sourceNode.x + (sourceNode.width || nodeWidth) + 80;
        let currentY = sourceNode.y;

        const newNodes: AppNode[] = [];
        const newNodeIds: string[] = [];

        // 处理每个文件
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const nodeId = `n-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
            newNodeIds.push(nodeId);

            if (type === 'image') {
                // 读取图片并获取尺寸
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                });

                // 获取图片尺寸
                const dimensions = await new Promise<{ width: number; height: number; aspectRatio: string }>((resolve) => {
                    const img = new window.Image();
                    img.onload = () => {
                        const ratio = img.width / img.height;
                        let aspectRatio = '1:1';
                        if (ratio > 1.6) aspectRatio = '16:9';
                        else if (ratio > 1.2) aspectRatio = '4:3';
                        else if (ratio < 0.625) aspectRatio = '9:16';
                        else if (ratio < 0.83) aspectRatio = '3:4';
                        const nodeHeight = nodeWidth * img.height / img.width;
                        resolve({ width: nodeWidth, height: nodeHeight, aspectRatio });
                    };
                    img.src = base64;
                });

                const newNode: AppNode = {
                    id: nodeId,
                    type: NodeType.IMAGE_ASSET,
                    x: startX,
                    y: currentY,
                    width: nodeWidth,
                    height: dimensions.height,
                    title: file.name.replace(/\.[^/.]+$/, '').slice(0, 20) || `图片 ${i + 1}`,
                    status: NodeStatus.SUCCESS,
                    data: { image: base64, aspectRatio: dimensions.aspectRatio },
                    inputs: []
                };
                newNodes.push(newNode);
                currentY += dimensions.height + verticalGap;
            } else {
                // 视频文件
                const url = URL.createObjectURL(file);
                const newNode: AppNode = {
                    id: nodeId,
                    type: NodeType.VIDEO_ASSET,
                    x: startX,
                    y: currentY,
                    width: nodeWidth,
                    height: defaultHeight,
                    title: file.name.replace(/\.[^/.]+$/, '').slice(0, 20) || `视频 ${i + 1}`,
                    status: NodeStatus.SUCCESS,
                    data: { videoUri: url },
                    inputs: []
                };
                newNodes.push(newNode);
                currentY += defaultHeight + verticalGap;
            }
        }

        // 计算分组框尺寸
        const totalHeight = currentY - sourceNode.y - verticalGap; // 减去最后一个间距
        const groupWidth = nodeWidth + groupPadding * 2;
        const groupHeight = totalHeight + groupPadding * 2;

        // 创建分组框
        const newGroup: Group = {
            id: `g-${Date.now()}`,
            title: type === 'image' ? '批量图片' : '批量视频',
            x: startX - groupPadding,
            y: sourceNode.y - groupPadding,
            width: groupWidth,
            height: groupHeight,
            hasOutputPort: true, // 启用右侧连接点
            nodeIds: newNodeIds
        };

        // 更新状态
        setNodes(prev => [...prev, ...newNodes]);
        setGroups(prev => [...prev, newGroup]);

        // 删除原始空节点（如果它是空的）
        const originalNode = nodesRef.current.find(n => n.id === sourceNodeId);
        if (originalNode && !originalNode.data.image && !originalNode.data.videoUri) {
            setNodes(prev => prev.filter(n => n.id !== sourceNodeId));
        }

        // 选中新创建的分组
        setSelection({ nodeIds: [], groupIds: [newGroup.id] });
    }, [saveHistory, setSelection]);

    // scaleRef, panRef 已迁移到 useViewport

    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const rect = canvasContainerRef.current?.getBoundingClientRect();
        if (!rect) return;

        if (e.ctrlKey || e.metaKey) {
            // 以鼠标位置为中心缩放
            const currentScale = scaleRef.current;
            const currentPan = panRef.current;

            // 鼠标在容器中的位置
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // 鼠标在画布坐标系中的位置
            const canvasX = (mouseX - currentPan.x) / currentScale;
            const canvasY = (mouseY - currentPan.y) / currentScale;

            // 计算新的缩放值（使用更平滑的缩放因子）
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.min(Math.max(0.1, currentScale * zoomFactor), 5);

            // 计算新的 pan 值，保持鼠标下的画布位置不变
            const newPanX = mouseX - canvasX * newScale;
            const newPanY = mouseY - canvasY * newScale;

            setScale(newScale);
            setPan({ x: newPanX, y: newPanY });
        } else {
            // 平移画布
            setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
        }
    }, []);

    // 使用原生事件监听器以支持 preventDefault（非 passive 模式）
    useEffect(() => {
        const el = canvasContainerRef.current;
        if (!el) return;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (contextMenu) setContextMenu(null);
        selectGroups([]);
        // 点击画布空白区域时，让当前聚焦的输入框失去焦点
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

        // Space + Left Click = Canvas Drag (like middle mouse or shift+click)
        if (e.button === 0 && isSpacePressed) {
            e.preventDefault();
            startPanning({ x: e.clientX, y: e.clientY });
            return;
        }

        if (e.button === 0 && !e.shiftKey) {
            if (e.detail > 1) { e.preventDefault(); return; }
            e.preventDefault(); // 防止拖拽选中文本
            selectNodes([]);
            // Use canvas-relative coordinates for selection rect
            const canvasPos = getCanvasMousePos(e.clientX, e.clientY);
            startSelecting(canvasPos.x, canvasPos.y);
        }
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) { e.preventDefault(); startPanning({ x: e.clientX, y: e.clientY }); }
    };

    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        const { clientX, clientY } = e;
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            // Get canvas-relative coordinates (accounting for Navbar offset)
            let canvasX = clientX, canvasY = clientY;
            if (canvasContainerRef.current) {
                const rect = canvasContainerRef.current.getBoundingClientRect();
                canvasX = clientX - rect.left;
                canvasY = clientY - rect.top;
            }

            // Always update mousePos for connection preview (using canvas-relative coords)
            setMousePos({ x: canvasX, y: canvasY });

            if (isSelecting) {
                updateSelecting(canvasX, canvasY);
                // Don't return - allow mousePos update for connection preview
                if (!getConnectionStartRef()) return;
            }

            if (dragGroupRef.current) {
                const { id, startX, startY, mouseStartX, mouseStartY, childNodes } = dragGroupRef.current;
                const dx = (clientX - mouseStartX) / scale;
                const dy = (clientY - mouseStartY) / scale;
                setGroups(prev => prev.map(g => g.id === id ? { ...g, x: startX + dx, y: startY + dy } : g));
                if (childNodes.length > 0) {
                    setNodes(prev => prev.map(n => {
                        const child = childNodes.find(c => c.id === n.id);
                        return child ? { ...n, x: child.startX + dx, y: child.startY + dy } : n;
                    }));
                }
                return;
            }

            // Panning: 使用 mode.lastPos 避免闭包问题
            const panningLastPos = getPanningLastPos();
            if (panningLastPos) {
                const dx = clientX - panningLastPos.x;
                const dy = clientY - panningLastPos.y;
                setPan(p => ({ x: p.x + dx, y: p.y + dy }));
                updatePanning({ x: clientX, y: clientY });
            }

            if (draggingNodeId && dragNodeRef.current && dragNodeRef.current.id === draggingNodeId) {
                const { startX, startY, mouseStartX, mouseStartY, nodeWidth, nodeHeight, otherSelectedNodes, isCopyDrag } = dragNodeRef.current;
                // 复制拖拽时显示复制光标
                document.body.style.cursor = isCopyDrag ? 'copy' : '';
                let dx = (clientX - mouseStartX) / scale;
                let dy = (clientY - mouseStartY) / scale;
                let proposedX = startX + dx;
                let proposedY = startY + dy;

                // 获取所有正在拖动的节点 ID（主节点 + 其他选中节点）
                const draggingIds = new Set([draggingNodeId, ...(otherSelectedNodes?.map(n => n.id) || [])]);

                // Snap Logic（只对非拖动中的节点进行吸附检测）
                const SNAP = SNAP_THRESHOLD / scale;
                const myL = proposedX; const myC = proposedX + nodeWidth / 2; const myR = proposedX + nodeWidth;
                const myT = proposedY; const myM = proposedY + nodeHeight / 2; const myB = proposedY + nodeHeight;
                let snappedX = false; let snappedY = false;

                nodesRef.current.forEach(other => {
                    if (draggingIds.has(other.id)) return; // 跳过所有正在拖动的节点
                    const otherBounds = getNodeBounds(other);
                    if (!snappedX) {
                        if (Math.abs(myL - otherBounds.x) < SNAP) { proposedX = otherBounds.x; snappedX = true; }
                        else if (Math.abs(myL - otherBounds.r) < SNAP) { proposedX = otherBounds.r; snappedX = true; }
                        else if (Math.abs(myR - otherBounds.x) < SNAP) { proposedX = otherBounds.x - nodeWidth; snappedX = true; }
                        else if (Math.abs(myR - otherBounds.r) < SNAP) { proposedX = otherBounds.r - nodeWidth; snappedX = true; }
                        else if (Math.abs(myC - (otherBounds.x + otherBounds.width / 2)) < SNAP) { proposedX = (otherBounds.x + otherBounds.width / 2) - nodeWidth / 2; snappedX = true; }
                    }
                    if (!snappedY) {
                        if (Math.abs(myT - otherBounds.y) < SNAP) { proposedY = otherBounds.y; snappedY = true; }
                        else if (Math.abs(myT - otherBounds.b) < SNAP) { proposedY = otherBounds.b; snappedY = true; }
                        else if (Math.abs(myB - otherBounds.y) < SNAP) { proposedY = otherBounds.y - nodeHeight; snappedY = true; }
                        else if (Math.abs(myB - otherBounds.b) < SNAP) { proposedY = otherBounds.b - nodeHeight; snappedY = true; }
                        else if (Math.abs(myM - (otherBounds.y + otherBounds.height / 2)) < SNAP) { proposedY = (otherBounds.y + otherBounds.height / 2) - nodeHeight / 2; snappedY = true; }
                    }
                })

                // 计算实际位移（考虑吸附后的调整）
                const actualDx = proposedX - startX;
                const actualDy = proposedY - startY;

                // 保存当前拖拽位置到 ref（用于 mouseUp 时提交）
                dragNodeRef.current.currentX = proposedX;
                dragNodeRef.current.currentY = proposedY;
                dragNodeRef.current.currentDx = actualDx;
                dragNodeRef.current.currentDy = actualDy;

                if (isCopyDrag) {
                    // 复制拖拽：原节点不动，显示半透明预览
                    const mainEl = nodeRefsMap.current.get(draggingNodeId);
                    if (mainEl) {
                        mainEl.style.opacity = '0.5'; // 原节点变半透明
                    }
                    // 其他选中节点也变半透明
                    otherSelectedNodes?.forEach(on => {
                        const el = nodeRefsMap.current.get(on.id);
                        if (el) el.style.opacity = '0.5';
                    });
                    // 更新复制预览位置
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
                    setCopyDragPreview({ nodes: previewNodes });
                } else {
                    // 普通拖拽：直接操作 DOM，绕过 React 渲染 ⚡
                    const mainEl = nodeRefsMap.current.get(draggingNodeId);
                    if (mainEl) {
                        mainEl.style.transform = `translate(${proposedX}px, ${proposedY}px)`;
                    }
                    // 更新拖拽位置 ref（用于连接线计算）
                    dragPositionsRef.current.set(draggingNodeId, { x: proposedX, y: proposedY });
                    const affectedNodeIds = [draggingNodeId];

                    // 同步移动其他选中节点
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

                    // 同步移动选中的分组及其内部节点 ⚡
                    dragNodeRef.current.selectedGroups?.forEach(sg => {
                        const newX = sg.startX + actualDx;
                        const newY = sg.startY + actualDy;
                        const groupEl = groupRefsMap.current.get(sg.id);
                        if (groupEl) {
                            groupEl.style.left = `${newX}px`;
                            groupEl.style.top = `${newY}px`;
                        }
                        // 移动分组内部的节点
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

                    // 更新相关连接线 ⚡
                    updateConnectionPaths(affectedNodeIds);
                }
                // 不调用 setNodes()！

            } else if (draggingNodeId) {
                // fallback: 没有 dragNodeRef 时的处理（不应该发生）
                const dx = (clientX - lastMousePos.x) / scale;
                const dy = (clientY - lastMousePos.y) / scale;
                const el = nodeRefsMap.current.get(draggingNodeId);
                const node = nodesRef.current.find(n => n.id === draggingNodeId);
                if (el && node) {
                    el.style.transform = `translate(${node.x + dx}px, ${node.y + dy}px)`;
                }
                setLastMousePos({ x: clientX, y: clientY });
            }

            if (resizingNodeId && initialSize && resizeStartPos) {
                const dx = (clientX - resizeStartPos.x) / scale;
                // 等比例缩放：根据宽度变化计算新尺寸
                const aspectRatio = initialSize.width / initialSize.height;
                const newWidth = Math.max(280, initialSize.width + dx);
                const newHeight = newWidth / aspectRatio;
                // 确保高度不会太小
                if (newHeight >= 160) {
                    setNodes(prev => prev.map(n => n.id === resizingNodeId ? { ...n, width: newWidth, height: newHeight } : n));
                }
            }

            // 分组调整尺寸 - 直接操作 DOM ⚡
            if (resizeGroupRef.current && resizingGroupId) {
                const { id, initialWidth, initialHeight, startX, startY } = resizeGroupRef.current;
                const dx = (clientX - startX) / scale;
                const dy = (clientY - startY) / scale;
                const newWidth = Math.max(200, initialWidth + dx);
                const newHeight = Math.max(150, initialHeight + dy);
                // 直接操作 DOM，不触发 React 渲染
                const groupEl = groupRefsMap.current.get(id);
                if (groupEl) {
                    groupEl.style.width = `${newWidth}px`;
                    groupEl.style.height = `${newHeight}px`;
                }
                // 缓存当前尺寸用于 mouseup 提交
                resizeGroupRef.current.currentWidth = newWidth;
                resizeGroupRef.current.currentHeight = newHeight;
            }
        });
    }, [isSelecting, updateSelecting, getConnectionStartRef, getPanningLastPos, updatePanning, draggingNodeId, resizingNodeId, resizingGroupId, initialSize, resizeStartPos, scale, lastMousePos]);

    const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        if (selectionRect) {
            const x = Math.min(selectionRect.startX, selectionRect.currentX);
            const y = Math.min(selectionRect.startY, selectionRect.currentY);
            const w = Math.abs(selectionRect.currentX - selectionRect.startX);
            const h = Math.abs(selectionRect.currentY - selectionRect.startY);
            if (w > 10 && h > 10) {
                const rect = { x: (x - pan.x) / scale, y: (y - pan.y) / scale, w: w / scale, h: h / scale };

                // 检查是否有分组被框选（框选区域与分组有足够重叠）
                const selectedGroups = groupsRef.current.filter(g => {
                    const overlapX = Math.max(0, Math.min(rect.x + rect.w, g.x + g.width) - Math.max(rect.x, g.x));
                    const overlapY = Math.max(0, Math.min(rect.y + rect.h, g.y + g.height) - Math.max(rect.y, g.y));
                    const overlapArea = overlapX * overlapY;
                    const groupArea = g.width * g.height;
                    return overlapArea > groupArea * 0.3;
                });

                // 选中框选区域内的节点（以节点中心判断）
                // 排除已在选中分组内的节点（避免重复移动）
                const enclosedNodes = nodesRef.current.filter(n => {
                    const cx = n.x + (n.width || 420) / 2;
                    const cy = n.y + 160;
                    const inRect = cx > rect.x && cx < rect.x + rect.w && cy > rect.y && cy < rect.y + rect.h;
                    if (!inRect) return false;
                    // 检查节点是否在选中的分组内
                    const inSelectedGroup = selectedGroups.some(g =>
                        cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height
                    );
                    return !inSelectedGroup; // 只选中不在分组内的节点
                });

                // 同时设置选中的分组和节点
                setSelection({
                    groupIds: selectedGroups.map(g => g.id),
                    nodeIds: enclosedNodes.map(n => n.id)
                });
            }
            finishInteraction();
        }

        // 拖拽结束：一次性提交节点位置到 state ⚡
        if (draggingNodeId && dragNodeRef.current && dragNodeRef.current.currentX !== undefined) {
            const { currentX, currentY, currentDx, currentDy, otherSelectedNodes, isCopyDrag, startX, startY } = dragNodeRef.current;

            // 检测是否实际发生了移动（防止点击时复制）
            const hasMoved = Math.abs((currentX || startX) - startX) > 5 || Math.abs((currentY || startY) - startY) > 5;

            // 恢复节点透明度（复制拖拽时会变半透明）
            const mainEl = nodeRefsMap.current.get(draggingNodeId);
            if (mainEl) mainEl.style.opacity = '';
            otherSelectedNodes?.forEach(on => {
                const el = nodeRefsMap.current.get(on.id);
                if (el) el.style.opacity = '';
            });
            // 清除复制预览
            setCopyDragPreview(null);

            if (isCopyDrag && hasMoved) {
                // Cmd/Ctrl + 拖拽：复制节点到新位置
                const nodesToCopy = [draggingNodeId, ...(otherSelectedNodes?.map(n => n.id) || [])];
                const newNodes: AppNode[] = [];
                const idMapping: Record<string, string> = {}; // 旧ID -> 新ID 映射

                nodesToCopy.forEach((nodeId, index) => {
                    const originalNode = nodesRef.current.find(n => n.id === nodeId);
                    if (!originalNode) return;

                    const newId = `n-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`;
                    idMapping[nodeId] = newId;

                    // 计算新位置
                    let newX: number, newY: number;
                    if (nodeId === draggingNodeId) {
                        newX = currentX!;
                        newY = currentY!;
                    } else {
                        const otherNode = otherSelectedNodes?.find(on => on.id === nodeId);
                        if (otherNode && currentDx !== undefined && currentDy !== undefined) {
                            newX = otherNode.startX + currentDx;
                            newY = otherNode.startY + currentDy;
                        } else {
                            newX = originalNode.x;
                            newY = originalNode.y;
                        }
                    }

                    // 继承外部上游连接（不在复制集合中的上游节点）
                    const externalInputs = originalNode.inputs.filter(inputId => !nodesToCopy.includes(inputId));

                    newNodes.push({
                        ...originalNode,
                        id: newId,
                        x: newX,
                        y: newY,
                        title: `${originalNode.title} 副本`,
                        inputs: externalInputs // 继承外部上游连接
                    });
                });

                // 创建外部上游连接的 Connection 对象
                const newConnections: Connection[] = [];
                newNodes.forEach(newNode => {
                    newNode.inputs.forEach(inputId => {
                        newConnections.push({ from: inputId, to: newNode.id });
                    });
                });

                setNodes(prev => [...prev, ...newNodes]);
                if (newConnections.length > 0) {
                    setConnections(prev => [...prev, ...newConnections]);
                }
                // 选中新复制的节点
                selectNodes(newNodes.map(n => n.id));
            } else {
                // 普通拖拽：移动节点（包括选中分组的内部节点）
                const selectedGroupsToMove = dragNodeRef.current?.selectedGroups || [];
                const allChildNodes = selectedGroupsToMove.flatMap(sg => sg.childNodes || []);

                setNodes(prev => prev.map(n => {
                    if (n.id === draggingNodeId) {
                        return { ...n, x: currentX!, y: currentY! };
                    }
                    const otherNode = otherSelectedNodes?.find(on => on.id === n.id);
                    if (otherNode && currentDx !== undefined && currentDy !== undefined) {
                        return { ...n, x: otherNode.startX + currentDx, y: otherNode.startY + currentDy };
                    }
                    // 分组内部节点
                    const childNode = allChildNodes.find(cn => cn.id === n.id);
                    if (childNode && currentDx !== undefined && currentDy !== undefined) {
                        return { ...n, x: childNode.startX + currentDx, y: childNode.startY + currentDy };
                    }
                    return n;
                }));

                // 同步提交选中分组的位置变更
                if (selectedGroupsToMove.length > 0 && currentDx !== undefined && currentDy !== undefined) {
                    setGroups(prev => prev.map(g => {
                        const sg = selectedGroupsToMove.find(sg => sg.id === g.id);
                        if (sg) {
                            return { ...g, x: sg.startX + currentDx, y: sg.startY + currentDy };
                        }
                        return g;
                    }));
                }
            }
        }

        // 清除拖拽位置缓存
        dragPositionsRef.current.clear();

        if (draggingNodeId || resizingNodeId || dragGroupRef.current || resizeGroupRef.current) saveHistory();

        // 分组调整尺寸完成后，提交最终尺寸到 state 并更新 nodeIds
        if (resizeGroupRef.current) {
            const { id: groupId, currentWidth, currentHeight } = resizeGroupRef.current;
            setGroups(prev => prev.map(g => {
                if (g.id !== groupId) return g;
                const newWidth = currentWidth ?? g.width;
                const newHeight = currentHeight ?? g.height;
                // 找出在分组范围内的节点（以节点中心判断）
                const enclosedNodeIds = nodesRef.current.filter(n => {
                    const b = getNodeBounds(n);
                    const cx = b.x + b.width / 2;
                    const cy = b.y + b.height / 2;
                    return cx > g.x && cx < g.x + newWidth && cy > g.y && cy < g.y + newHeight;
                }).map(n => n.id);
                return { ...g, width: newWidth, height: newHeight, nodeIds: enclosedNodeIds };
            }));
        }

        // 检查是否从有输出能力的节点的输出端口开始拖拽并释放到空白区域
        // 如果是，弹出节点选择框（继续编辑功能）
        const connStart = getConnectionStartRef();
        if (connStart && connStart.portType === 'output' && connStart.id !== 'smart-sequence-dock') {
            const sourceNode = nodesRef.current.find(n => n.id === connStart.id);
            if (sourceNode) {
                const hasMedia = !!(sourceNode.data.image || sourceNode.data.videoUri);
                const isPromptNode = sourceNode.type === NodeType.PROMPT_INPUT;
                const hasPromptContent = isPromptNode && !!(sourceNode.data.prompt && sourceNode.data.prompt.trim());
                // 有媒体内容 或 提示词节点有内容
                if (hasMedia || hasPromptContent) {
                    const canvasX = (e.clientX - pan.x) / scale;
                    const canvasY = (e.clientY - pan.y) / scale;
                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: connStart.id });
                    setContextMenuTarget({ type: 'output-action', sourceNodeId: connStart.id, canvasX, canvasY });
                }
            }
        }

        // 检查是否从生成节点/提示词节点的输入端口开始拖拽并释放到空白区域
        // 如果是，弹出上游节点选择框（素材/描述）
        if (connStart && connStart.portType === 'input') {
            const targetNode = nodesRef.current.find(n => n.id === connStart.id);
            // 对生成节点（图像/视频/多帧视频）和提示词节点生效
            if (targetNode && (
                targetNode.type === NodeType.IMAGE_GENERATOR ||
                targetNode.type === NodeType.VIDEO_GENERATOR ||
                targetNode.type === NodeType.VIDEO_FACTORY ||
                targetNode.type === NodeType.MULTI_FRAME_VIDEO ||
                targetNode.type === NodeType.PROMPT_INPUT
            )) {
                const canvasX = (e.clientX - pan.x) / scale;
                const canvasY = (e.clientY - pan.y) / scale;
                setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: connStart.id });
                setContextMenuTarget({ type: 'input-action', targetNodeId: connStart.id, canvasX, canvasY });
            }
        }

        // 清除复制光标
        document.body.style.cursor = '';
        // 重置所有交互状态
        setDraggingNodeId(null); setDraggingNodeParentGroupId(null); setDraggingGroup(null); setResizingGroupId(null); setActiveGroupNodeIds([]); setResizingNodeId(null); setInitialSize(null); setResizeStartPos(null);
        finishInteraction(); // 重置 mode 为 idle (包括 panning, connectionStart, selectionRect)
        dragNodeRef.current = null; resizeContextRef.current = null; dragGroupRef.current = null; resizeGroupRef.current = null;
    }, [selectionRect, finishInteraction, getConnectionStartRef, pan, scale, saveHistory, draggingNodeId, resizingNodeId, resizingGroupId]);

    useEffect(() => { window.addEventListener('mousemove', handleGlobalMouseMove); window.addEventListener('mouseup', handleGlobalMouseUp); return () => { window.removeEventListener('mousemove', handleGlobalMouseMove); window.removeEventListener('mouseup', handleGlobalMouseUp); }; }, [handleGlobalMouseMove, handleGlobalMouseUp]);

    const handleNodeUpdate = useCallback((id: string, data: any, size?: any, title?: string) => {
        setNodes(prev => {
            const newNodes = prev.map(n => {
                if (n.id === id) {
                    // 深度合并 firstLastFrameData（避免快速连续上传时丢失数据）
                    const mergedData = { ...n.data, ...data };
                    if (data.firstLastFrameData) {
                        mergedData.firstLastFrameData = {
                            ...n.data.firstLastFrameData,
                            ...data.firstLastFrameData
                        };
                    }
                    const updated = { ...n, data: mergedData, title: title || n.title };
                    if (size) { if (size.width) updated.width = size.width; if (size.height) updated.height = size.height; }

                    if (data.image) handleAssetGenerated('image', data.image, updated.title);
                    if (data.videoUri) handleAssetGenerated('video', data.videoUri, updated.title);
                    if (data.audioUri) handleAssetGenerated('audio', data.audioUri, updated.title);

                    return updated;
                }
                return n;
            });
            // 同步更新 ref，确保后续操作能立即获取最新数据
            nodesRef.current = newNodes;
            return newNodes;
        });
    }, [handleAssetGenerated]);

    const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        const file = e.target.files?.[0];
        const targetId = replacementTargetRef.current;
        if (file && targetId) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                if (type === 'image') handleNodeUpdate(targetId, { image: result });
                else handleNodeUpdate(targetId, { videoUri: result });
            };
            reader.readAsDataURL(file);
        }
        e.target.value = ''; setContextMenu(null); replacementTargetRef.current = null;
    };

    const handleNodeAction = useCallback(async (id: string, promptOverride?: string) => {
        const node = nodesRef.current.find(n => n.id === id); if (!node) return;
        handleNodeUpdate(id, { error: undefined });
        setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.WORKING } : n));

        try {
            const inputs = node.inputs.map(i => nodesRef.current.find(n => n.id === i)).filter(Boolean) as AppNode[];

            const upstreamTexts = inputs.map(n => {
                if (n?.type === NodeType.PROMPT_INPUT) return n.data.prompt;
                return null;
            }).filter(t => t && t.trim().length > 0) as string[];

            let prompt = promptOverride || node.data.prompt || '';
            if (upstreamTexts.length > 0) {
                const combinedUpstream = upstreamTexts.join('\n');
                prompt = prompt ? `${combinedUpstream}\n${prompt}` : combinedUpstream;
            }

            // 创意描述节点：统一使用 /api/studio/chat 处理文本/图片/视频分析
            if (node.type === NodeType.PROMPT_INPUT) {
                const requestPrompt = promptOverride || ''; // 需求（来自配置框）
                const contentPrompt = node.data.prompt || ''; // 内容（节点内文本）
                const selectedModel = node.data.model || 'gemini-2.5-flash';

                // 检查上游是否有媒体素材
                let upstreamImage = inputs.find(n => n?.data.image)?.data.image;
                let upstreamVideo = inputs.find(n => n?.data.videoUri)?.data.videoUri;

                try {
                    let generatedPrompt = '';

                    // 将 blob URL 转换为 base64（远程 API 无法访问 blob URL）
                    if (upstreamImage && upstreamImage.startsWith('blob:')) {
                        upstreamImage = await urlToBase64(upstreamImage);
                    }
                    if (upstreamVideo && upstreamVideo.startsWith('blob:')) {
                        upstreamVideo = await urlToBase64(upstreamVideo);
                    }

                    // 统一使用 /api/studio/chat 处理文本/图片/视频
                    let userMessage = '';
                    if (contentPrompt.trim() && requestPrompt.trim()) {
                        userMessage = `需求：${requestPrompt}\n\n原内容：${contentPrompt}`;
                    } else if (contentPrompt.trim()) {
                        userMessage = contentPrompt;
                    } else if (requestPrompt.trim()) {
                        userMessage = requestPrompt;
                    } else if (upstreamVideo) {
                        userMessage = '请详细描述这个视频的内容、风格、运动、镜头语言等视觉元素，生成可用于视频生成的提示词。';
                    } else if (upstreamImage) {
                        userMessage = '请详细描述这张图片的内容、风格、构图、色彩等视觉元素，生成可用于AI图片/视频生成的提示词。';
                    } else {
                        throw new Error('请输入内容或连接素材');
                    }

                    const response = await fetch('/api/studio/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messages: [{ role: 'user', text: userMessage }],
                            mode: 'prompt_generator',
                            model: selectedModel,
                            image: upstreamImage || undefined,
                            video: upstreamVideo || undefined
                        })
                    });

                    if (!response.ok) {
                        const error = await response.json().catch(() => ({}));
                        throw new Error(error.error || `API错误: ${response.status}`);
                    }

                    const result = await response.json();
                    generatedPrompt = result.message || '';

                    handleNodeUpdate(id, { prompt: generatedPrompt });
                    setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                    return;
                } catch (e: any) {
                    console.error('[PROMPT_INPUT] Error:', e);
                    handleNodeUpdate(id, { error: e.message });
                    setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR } : n));
                    return;
                }
            }

            if (node.type === NodeType.IMAGE_GENERATOR) {
                const inputImages: string[] = [];
                // 收集上游连接节点的图片
                console.log(`[ImageGen] Node ${node.id} has ${inputs.length} upstream inputs:`, inputs.map(n => ({ id: n?.id, type: n?.type, hasImage: !!n?.data.image })));
                inputs.forEach(n => { if (n?.data.image) inputImages.push(n.data.image); });
                // 如果节点自身有图片（用户上传的参考图或之前的生成结果），也作为参考
                if (node.data.image && !inputImages.includes(node.data.image)) {
                    inputImages.unshift(node.data.image); // 优先放在最前面
                }
                console.log(`[ImageGen] Collected ${inputImages.length} input images for model ${node.data.model}`);

                const isStoryboard = /分镜|storyboard|sequence|shots|frames|json/i.test(prompt);

                if (isStoryboard) {
                    try {
                        const storyboard = await planStoryboard(prompt, upstreamTexts.join('\n'));
                        if (storyboard.length > 1) {
                            // ... (storyboard expansion logic preserved) ...
                            const newNodes: AppNode[] = [];
                            const newConnections: Connection[] = [];
                            const COLUMNS = 3;
                            const gapX = 40; const gapY = 40;
                            const childWidth = node.width || 420;
                            const ratio = node.data.aspectRatio || '16:9';
                            const [rw, rh] = ratio.split(':').map(Number);
                            const childHeight = (childWidth * rh / rw);
                            const startX = node.x + (node.width || 420) + 150;
                            const startY = node.y;
                            const totalRows = Math.ceil(storyboard.length / COLUMNS);

                            // 验证模型是否为图片生成模型
                            const validImageModels = ['doubao-seedream-4-5-251128', 'nano-banana', 'nano-banana-pro'];
                            let usedModel = node.data.model || 'doubao-seedream-4-5-251128';
                            if (!validImageModels.includes(usedModel) && !usedModel.includes('gemini')) {
                                usedModel = 'doubao-seedream-4-5-251128';
                            }
                            storyboard.forEach((shotPrompt, index) => {
                                const col = index % COLUMNS;
                                const row = Math.floor(index / COLUMNS);
                                const posX = startX + col * (childWidth + gapX);
                                const posY = startY + row * (childHeight + gapY);
                                const newNodeId = `n-${Date.now()}-${index}`;
                                newNodes.push({
                                    id: newNodeId, type: NodeType.IMAGE_GENERATOR, x: posX, y: posY, width: childWidth, height: childHeight,
                                    title: `分镜 ${index + 1}`, status: NodeStatus.WORKING,
                                    data: { ...node.data, model: usedModel, aspectRatio: ratio, prompt: shotPrompt, image: undefined, images: undefined, imageCount: 1 },
                                    inputs: [node.id]
                                });
                                newConnections.push({ from: node.id, to: newNodeId });
                            });

                            const groupPadding = 30;
                            const groupWidth = (Math.min(storyboard.length, COLUMNS) * childWidth) + ((Math.min(storyboard.length, COLUMNS) - 1) * gapX) + (groupPadding * 2);
                            const groupHeight = (totalRows * childHeight) + ((totalRows - 1) * gapY) + (groupPadding * 2);

                            setGroups(prev => [...prev, { id: `g-${Date.now()}`, title: '分镜生成组', x: startX - groupPadding, y: startY - groupPadding, width: groupWidth, height: groupHeight }]);
                            setNodes(prev => [...prev, ...newNodes]);
                            setConnections(prev => [...prev, ...newConnections]);
                            handleNodeUpdate(id, { status: NodeStatus.SUCCESS });

                            newNodes.forEach(async (n) => {
                                try {
                                    const res = await generateImageFromText(n.data.prompt!, n.data.model!, inputImages, { aspectRatio: n.data.aspectRatio, resolution: n.data.resolution, count: 1 });
                                    handleNodeUpdate(n.id, { image: res[0], images: res, model: n.data.model, aspectRatio: n.data.aspectRatio, status: NodeStatus.SUCCESS });
                                } catch (e: any) {
                                    handleNodeUpdate(n.id, { error: e.message, status: NodeStatus.ERROR });
                                }
                            });
                            return;
                        }
                    } catch (e) {
                        console.warn("Storyboard planning failed", e);
                    }
                }
                // 判断是否创建新节点：当且仅当节点本身已有素材时
                // 空节点 → 结果直接显示在当前节点
                // 有素材的节点 → 创建新节点显示结果
                const shouldCreateNewNode = !!node.data.image;
                let newNodeId: string | null = null;

                if (shouldCreateNewNode) {
                    // 节点已有素材：创建新节点呈现结果（组图统一在一个节点中）
                    newNodeId = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    const nodeWidth = node.width || 420;
                    const [rw, rh] = (node.data.aspectRatio || '16:9').split(':').map(Number);
                    const nodeHeight = node.height || (nodeWidth * rh / rw);

                    // 向右排布新节点
                    const startX = node.x + nodeWidth + 80;
                    const { x: newX, y: newY } = findNonOverlappingPosition(startX, node.y, nodeWidth, nodeHeight, nodesRef.current, 'right');

                    const newNode: AppNode = {
                        id: newNodeId,
                        type: NodeType.IMAGE_GENERATOR,
                        x: newX,
                        y: newY,
                        width: nodeWidth,
                        height: nodeHeight,
                        title: '生成结果',
                        status: NodeStatus.WORKING,
                        data: {
                            ...node.data,
                            prompt: prompt,
                            image: undefined,
                            images: undefined,
                        },
                        inputs: [], // 自动连接不设置 inputs，不传递上游参数
                    };
                    setNodes(prev => [...prev, newNode]);
                    // 自动连接使用 isAuto 标记
                    setConnections(prev => [...prev, { from: id, to: newNodeId!, isAuto: true }]);
                    // 原节点状态设为成功
                    setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                }

                try {
                    // 获取组图数量（默认1张）
                    const imageCount = node.data.imageCount || 1;
                    // 验证模型是否为图片生成模型
                    const validImageModels = ['doubao-seedream-4-5-251128', 'nano-banana', 'nano-banana-pro'];
                    let usedModel = node.data.model || 'doubao-seedream-4-5-251128';
                    if (!validImageModels.includes(usedModel) && !usedModel.includes('gemini')) {
                        console.warn(`[ImageGen] Invalid model ${usedModel} for image generation, falling back to Seedream`);
                        usedModel = 'doubao-seedream-4-5-251128';
                    }
                    const usedAspectRatio = node.data.aspectRatio || '16:9';
                    const res = await generateImageFromText(prompt, usedModel, inputImages, { aspectRatio: usedAspectRatio, resolution: node.data.resolution, count: imageCount });

                    if (shouldCreateNewNode && newNodeId) {
                        // 有素材节点：更新新节点，组图结果统一呈现（保存实际使用的模型和比例）
                        handleNodeUpdate(newNodeId, { image: res[0], images: res, imageCount, model: usedModel, aspectRatio: usedAspectRatio });
                        setNodes(p => p.map(n => n.id === newNodeId ? { ...n, status: NodeStatus.SUCCESS } : n));
                    } else {
                        // 空节点：结果直接在当前节点显示，组图结果统一呈现（保存实际使用的模型和比例）
                        handleNodeUpdate(id, { image: res[0], images: res, imageCount, model: usedModel, aspectRatio: usedAspectRatio });
                    }
                } catch (imgErr: any) {
                    if (shouldCreateNewNode && newNodeId) {
                        // 新节点显示错误
                        handleNodeUpdate(newNodeId, { error: imgErr.message });
                        setNodes(p => p.map(n => n.id === newNodeId ? { ...n, status: NodeStatus.ERROR } : n));
                    } else {
                        throw imgErr; // 抛给外层 catch 处理
                    }
                }

            } else if (node.type === NodeType.VIDEO_GENERATOR) {
                // 判断是否创建新节点：当且仅当节点本身已有视频时
                const shouldCreateNewNode = !!node.data.videoUri;
                const nodeWidth = node.width || 420;
                const [rw, rh] = (node.data.aspectRatio || '16:9').split(':').map(Number);
                const nodeHeight = node.height || (nodeWidth * rh / rw);

                let factoryNodeId: string | null = null;

                if (shouldCreateNewNode) {
                    // 节点已有视频：创建新的 VIDEO_FACTORY 节点
                    factoryNodeId = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                    // 查找当前节点已有的自动连接下游节点
                    const existingAutoConns = connectionsRef.current.filter(c => c.from === id && c.isAuto);
                    const firstAutoChildId = existingAutoConns.length > 0 ? existingAutoConns[0].to : null;
                    const firstAutoChild = firstAutoChildId ? nodesRef.current.find(n => n.id === firstAutoChildId) : null;

                    let newX: number, newY: number;
                    if (!firstAutoChild) {
                        const startX = node.x + nodeWidth + 80;
                        ({ x: newX, y: newY } = findNonOverlappingPosition(startX, node.y, nodeWidth, nodeHeight, nodesRef.current, 'right'));
                    } else {
                        const startY = firstAutoChild.y - nodeHeight - 80;
                        ({ x: newX, y: newY } = findNonOverlappingPosition(firstAutoChild.x, startY, nodeWidth, nodeHeight, nodesRef.current, 'up'));
                    }

                    const factoryNode: AppNode = {
                        id: factoryNodeId,
                        type: NodeType.VIDEO_FACTORY,
                        x: newX,
                        y: newY,
                        width: nodeWidth,
                        height: nodeHeight,
                        title: '视频工厂',
                        status: NodeStatus.WORKING,
                        data: {
                            ...node.data,
                            prompt: prompt,
                            videoUri: undefined,
                            videoUris: undefined,
                            image: node.data.image,
                        },
                        inputs: [],
                    };
                    setNodes(prev => [...prev, factoryNode]);
                    setConnections(prev => [...prev, { from: id, to: factoryNodeId!, isAuto: true }]);
                    setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                }

                try {
                    const strategy = await getGenerationStrategy(node, inputs, prompt);
                    const usedModel = node.data.model || 'veo3.1';
                    const usedAspectRatio = node.data.aspectRatio || '16:9';

                    const res = await generateVideo(
                        strategy.finalPrompt,
                        usedModel,
                        {
                            aspectRatio: usedAspectRatio,
                            count: node.data.videoCount || 1,
                            generationMode: strategy.generationMode,
                            resolution: node.data.resolution,
                            duration: node.data.duration  // 视频时长
                        },
                        strategy.inputImageForGeneration,
                        strategy.videoInput,
                        strategy.referenceImages,
                        strategy.imageRoles  // 图片角色（首尾帧）
                    );

                    if (shouldCreateNewNode && factoryNodeId) {
                        // 有视频节点：更新新节点（保存实际使用的模型和比例）
                        if (res.isFallbackImage) {
                            handleNodeUpdate(factoryNodeId, {
                                image: res.uri,
                                videoUri: undefined,
                                model: usedModel,
                                aspectRatio: usedAspectRatio,
                                error: "Region restricted: Generated preview image instead."
                            });
                        } else {
                            handleNodeUpdate(factoryNodeId, { videoUri: res.uri, videoMetadata: res.videoMetadata, videoUris: res.uris, model: usedModel, aspectRatio: usedAspectRatio });
                        }
                        setNodes(p => p.map(n => n.id === factoryNodeId ? { ...n, status: NodeStatus.SUCCESS } : n));
                    } else {
                        // 空节点：结果直接在当前节点显示（保存实际使用的模型和比例）
                        if (res.isFallbackImage) {
                            handleNodeUpdate(id, {
                                image: res.uri,
                                videoUri: undefined,
                                model: usedModel,
                                aspectRatio: usedAspectRatio,
                                error: "Region restricted: Generated preview image instead."
                            });
                        } else {
                            handleNodeUpdate(id, { videoUri: res.uri, videoMetadata: res.videoMetadata, videoUris: res.uris, model: usedModel, aspectRatio: usedAspectRatio });
                        }
                    }
                } catch (videoErr: any) {
                    if (shouldCreateNewNode && factoryNodeId) {
                        handleNodeUpdate(factoryNodeId, { error: videoErr.message });
                        setNodes(p => p.map(n => n.id === factoryNodeId ? { ...n, status: NodeStatus.ERROR } : n));
                    } else {
                        throw videoErr;
                    }
                }

            } else if (node.type === NodeType.VIDEO_FACTORY) {
                // 判断是否创建新节点：当且仅当节点本身已有视频时
                const shouldCreateNewNode = !!node.data.videoUri;
                const nodeWidth = node.width || 420;
                const [rw, rh] = (node.data.aspectRatio || '16:9').split(':').map(Number);
                const nodeHeight = node.height || (nodeWidth * rh / rw);

                let newFactoryNodeId: string | null = null;

                if (shouldCreateNewNode) {
                    // 节点已有视频：创建新的 VIDEO_FACTORY 节点
                    newFactoryNodeId = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                    const existingAutoConns = connectionsRef.current.filter(c => c.from === id && c.isAuto);
                    const firstAutoChildId = existingAutoConns.length > 0 ? existingAutoConns[0].to : null;
                    const firstAutoChild = firstAutoChildId ? nodesRef.current.find(n => n.id === firstAutoChildId) : null;

                    let newX: number, newY: number;
                    if (!firstAutoChild) {
                        const startX = node.x + nodeWidth + 80;
                        ({ x: newX, y: newY } = findNonOverlappingPosition(startX, node.y, nodeWidth, nodeHeight, nodesRef.current, 'right'));
                    } else {
                        const startY = firstAutoChild.y - nodeHeight - 80;
                        ({ x: newX, y: newY } = findNonOverlappingPosition(firstAutoChild.x, startY, nodeWidth, nodeHeight, nodesRef.current, 'up'));
                    }

                    const newFactoryNode: AppNode = {
                        id: newFactoryNodeId,
                        type: NodeType.VIDEO_FACTORY,
                        x: newX,
                        y: newY,
                        width: nodeWidth,
                        height: nodeHeight,
                        title: '视频工厂',
                        status: NodeStatus.WORKING,
                        data: {
                            ...node.data,
                            prompt: prompt,
                            videoUri: undefined,
                            videoUris: undefined,
                        },
                        inputs: [],
                    };
                    setNodes(prev => [...prev, newFactoryNode]);
                    setConnections(prev => [...prev, { from: id, to: newFactoryNodeId!, isAuto: true }]);
                    setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                }

                try {
                    // 使用当前视频作为输入进行继续/编辑
                    let videoInput: string | undefined;
                    if (node.data.videoUri) {
                        videoInput = node.data.videoUri.startsWith('http')
                            ? await urlToBase64(node.data.videoUri)
                            : node.data.videoUri;
                    }

                    const strategy = await getGenerationStrategy(node, inputs, prompt);
                    const usedModel = node.data.model || 'veo3.1';
                    const usedAspectRatio = node.data.aspectRatio || '16:9';

                    const res = await generateVideo(
                        strategy.finalPrompt,
                        usedModel,
                        {
                            aspectRatio: usedAspectRatio,
                            count: node.data.videoCount || 1,
                            generationMode: strategy.generationMode,
                            resolution: node.data.resolution,
                            duration: node.data.duration  // 视频时长
                        },
                        strategy.inputImageForGeneration,
                        videoInput || strategy.videoInput,
                        strategy.referenceImages,
                        strategy.imageRoles  // 图片角色（首尾帧）
                    );

                    if (shouldCreateNewNode && newFactoryNodeId) {
                        // 有视频节点：更新新节点（保存实际使用的模型和比例）
                        if (res.isFallbackImage) {
                            handleNodeUpdate(newFactoryNodeId, {
                                image: res.uri,
                                videoUri: undefined,
                                model: usedModel,
                                aspectRatio: usedAspectRatio,
                                error: "Region restricted: Generated preview image instead."
                            });
                        } else {
                            handleNodeUpdate(newFactoryNodeId, { videoUri: res.uri, videoMetadata: res.videoMetadata, videoUris: res.uris, model: usedModel, aspectRatio: usedAspectRatio });
                        }
                        setNodes(p => p.map(n => n.id === newFactoryNodeId ? { ...n, status: NodeStatus.SUCCESS } : n));
                    } else {
                        // 空节点：结果直接在当前节点显示（保存实际使用的模型和比例）
                        if (res.isFallbackImage) {
                            handleNodeUpdate(id, {
                                image: res.uri,
                                videoUri: undefined,
                                model: usedModel,
                                aspectRatio: usedAspectRatio,
                                error: "Region restricted: Generated preview image instead."
                            });
                        } else {
                            handleNodeUpdate(id, { videoUri: res.uri, videoMetadata: res.videoMetadata, videoUris: res.uris, model: usedModel, aspectRatio: usedAspectRatio });
                        }
                    }
                } catch (videoErr: any) {
                    if (shouldCreateNewNode && newFactoryNodeId) {
                        handleNodeUpdate(newFactoryNodeId, { error: videoErr.message });
                        setNodes(p => p.map(n => n.id === newFactoryNodeId ? { ...n, status: NodeStatus.ERROR } : n));
                    } else {
                        throw videoErr;
                    }
                }

            } else if (node.type === NodeType.AUDIO_GENERATOR) {
                const audioMode = node.data.audioMode || 'music';

                if (audioMode === 'music') {
                    // Suno 音乐生成（自定义创作模式）
                    const musicConfig = node.data.musicConfig || {};
                    const songs = await createMusicCustom(
                        {
                            title: musicConfig.title || undefined,
                            tags: musicConfig.tags || undefined,
                            negative_tags: musicConfig.negativeTags || undefined,
                            prompt: prompt || undefined,
                            mv: musicConfig.mv || 'chirp-v4',
                            make_instrumental: musicConfig.instrumental || false,
                        },
                        (progressText, songData) => {
                            // 更新封面图（如果有）
                            if (songData?.[0]?.image_url) {
                                handleNodeUpdate(id, {
                                    musicConfig: {
                                        ...node.data.musicConfig,
                                        coverImage: songData[0].image_url
                                    }
                                });
                            }
                        }
                    );

                    // 获取第一首歌曲的音频 URL
                    const mainSong = songs[0];
                    if (!mainSong?.audio_url) {
                        throw new Error('未获取到音频文件');
                    }

                    // 保存结果
                    handleNodeUpdate(id, {
                        audioUri: mainSong.audio_url,
                        audioUris: songs.map(s => s.audio_url).filter(Boolean) as string[],
                        duration: mainSong.duration,
                        musicConfig: {
                            ...node.data.musicConfig,
                            title: mainSong.title,
                            coverImage: mainSong.image_url,
                            status: 'complete',
                        },
                    });

                } else {
                    // MiniMax 语音合成
                    const voiceConfig = node.data.voiceConfig || {};
                    const params: MinimaxGenerateParams = {
                        model: (node.data.model as any) || 'speech-2.6-hd',
                        text: prompt,
                        voice_setting: {
                            voice_id: voiceConfig.voiceId || 'female-shaonv',
                            speed: voiceConfig.speed || 1.0,
                            vol: voiceConfig.volume || 1.0,
                            pitch: voiceConfig.pitch || 0,
                            emotion: voiceConfig.emotion,
                        },
                    };

                    // 添加声音效果器（如果有）
                    if (voiceConfig.voiceModify) {
                        params.voice_modify = {
                            pitch: voiceConfig.voiceModify.pitch,
                            intensity: voiceConfig.voiceModify.intensity,
                            timbre: voiceConfig.voiceModify.timbre,
                            sound_effects: voiceConfig.voiceModify.soundEffect as any,
                        };
                    }

                    const audioUri = await synthesizeSpeech(params, (progressText) => {
                        handleNodeUpdate(id, { progress: progressText });
                    });

                    handleNodeUpdate(id, { audioUri });
                }

            } else if (node.type === NodeType.IMAGE_EDITOR) {
                const inputImages: string[] = [];
                inputs.forEach(n => { if (n?.data.image) inputImages.push(n.data.image); });
                const img = node.data.image || inputImages[0];
                const res = await editImageWithText(img, prompt, node.data.model || 'gemini-2.5-flash-image');
                handleNodeUpdate(id, { image: res });

            } else if (node.type === NodeType.MULTI_FRAME_VIDEO) {
                // 智能多帧视频生成
                const frames = node.data.multiFrameData?.frames || [];
                if (frames.length < 2) {
                    throw new Error('智能多帧至少需要2张关键帧');
                }

                const viduConfig: ViduMultiFrameConfig = {
                    model: node.data.multiFrameData?.viduModel || 'viduq2-turbo',
                    resolution: node.data.multiFrameData?.viduResolution || '720p',
                };

                // 调用 Vidu API 生成视频
                const result = await generateViduMultiFrame(frames, viduConfig);

                if (!result.success) {
                    throw new Error(result.error || 'Vidu 生成失败');
                }

                // 如果返回 taskId，需要轮询查询结果
                if (result.taskId && !result.videoUrl) {
                    // 保存 taskId 到节点数据
                    handleNodeUpdate(id, {
                        multiFrameData: {
                            ...node.data.multiFrameData,
                            taskId: result.taskId,
                        },
                        progress: '正在生成视频...',
                    });

                    // 轮询查询任务状态
                    const maxAttempts = 120; // 最多查询 120 次（约 10 分钟）
                    let attempts = 0;
                    let finalResult = result;

                    while (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 5000)); // 每 5 秒查询一次
                        attempts++;

                        const queryResult = await queryViduTask(result.taskId);

                        if (!queryResult.success) {
                            throw new Error(queryResult.error || '查询任务状态失败');
                        }

                        if (queryResult.videoUrl) {
                            finalResult = queryResult;
                            break;
                        }

                        if (queryResult.state === 'failed') {
                            throw new Error('视频生成失败');
                        }

                        // 更新进度
                        handleNodeUpdate(id, {
                            progress: `生成中... (${attempts * 5}s)`,
                        });
                    }

                    if (!finalResult.videoUrl) {
                        throw new Error('生成超时，请稍后重试');
                    }

                    // 生成完成，更新节点
                    handleNodeUpdate(id, {
                        videoUri: finalResult.videoUrl,
                        progress: undefined,
                    });
                } else if (result.videoUrl) {
                    // 直接返回视频 URL
                    handleNodeUpdate(id, {
                        videoUri: result.videoUrl,
                    });
                }
            }
            setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
        } catch (e: any) {
            handleNodeUpdate(id, { error: e.message });
            setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR } : n));
        }
    }, [handleNodeUpdate]);


    const saveGroupAsWorkflow = (groupId: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        const nodesInGroup = nodes.filter(n => { const w = n.width || 420; const h = n.height || getApproxNodeHeight(n); const cx = n.x + w / 2; const cy = n.y + h / 2; return cx > group.x && cx < group.x + group.width && cy > group.y && cy < group.y + group.height; });
        const nodeIds = new Set(nodesInGroup.map(n => n.id));
        const connectionsInGroup = connections.filter(c => nodeIds.has(c.from) && nodeIds.has(c.to));
        const thumbNode = nodesInGroup.find(n => n.data.image);
        const thumbnail = thumbNode ? thumbNode.data.image : '';
        const newWf: Workflow = { id: `wf-${Date.now()}`, title: group.title || '未命名工作流', thumbnail: thumbnail || '', nodes: JSON.parse(JSON.stringify(nodesInGroup)), connections: JSON.parse(JSON.stringify(connectionsInGroup)), groups: [JSON.parse(JSON.stringify(group))] };
        setWorkflows(prev => [newWf, ...prev]);
    };

    const loadWorkflow = (id: string | null) => {
        if (!id) return;
        const wf = workflows.find(w => w.id === id);
        if (wf) {
            saveHistory();
            setNodes(JSON.parse(JSON.stringify(wf.nodes)));
            // Deduplicate connections when loading workflow
            const conns = JSON.parse(JSON.stringify(wf.connections)) as Connection[];
            const uniqueConns = conns.filter((conn, idx, arr) =>
                arr.findIndex(c => c.from === conn.from && c.to === conn.to) === idx
            );
            setConnections(uniqueConns);
            setGroups(JSON.parse(JSON.stringify(wf.groups)));
            setSelectedWorkflowId(id);
        }
    };

    const deleteWorkflow = (id: string) => { setWorkflows(prev => prev.filter(w => w.id !== id)); if (selectedWorkflowId === id) setSelectedWorkflowId(null); };
    const renameWorkflow = (id: string, newTitle: string) => { setWorkflows(prev => prev.map(w => w.id === id ? { ...w, title: newTitle } : w)); };

    // --- Canvas Management ---
    const saveCurrentCanvas = useCallback(() => {
        if (!currentCanvasId) return;
        const now = Date.now();
        setCanvases(prev => prev.map(c =>
            c.id === currentCanvasId
                ? {
                    ...c,
                    nodes: JSON.parse(JSON.stringify(nodes)),
                    connections: JSON.parse(JSON.stringify(connections)),
                    groups: JSON.parse(JSON.stringify(groups)),
                    pan: { ...pan },
                    scale: scale,
                    updatedAt: now
                }
                : c
        ));
    }, [currentCanvasId, nodes, connections, groups, pan, scale]);

    const createNewCanvas = useCallback(() => {
        // 先保存当前画布
        if (currentCanvasId && nodes.length > 0) {
            saveCurrentCanvas();
        }

        const now = Date.now();
        const newCanvas: Canvas = {
            id: `canvas-${now}-${Math.floor(Math.random() * 1000)}`,
            title: `画布 ${canvases.length + 1}`,
            nodes: [],
            connections: [],
            groups: [],
            createdAt: now,
            updatedAt: now,
            pan: { x: 0, y: 0 },
            scale: 1
        };

        setCanvases(prev => [newCanvas, ...prev]);
        setCurrentCanvasId(newCanvas.id);
        setNodes([]);
        setConnections([]);
        setGroups([]);
        clearSelection();
        // 重置视口
        setPan({ x: 0, y: 0 });
        setScale(1);
    }, [currentCanvasId, nodes.length, canvases.length, saveCurrentCanvas, clearSelection]);

    const selectCanvas = useCallback((id: string) => {
        if (id === currentCanvasId) return;

        // 保存当前画布
        if (currentCanvasId) {
            saveCurrentCanvas();
        }

        // 加载选中的画布
        const canvas = canvases.find(c => c.id === id);
        if (canvas) {
            setNodes(JSON.parse(JSON.stringify(canvas.nodes)));
            setConnections(JSON.parse(JSON.stringify(canvas.connections)));
            setGroups(JSON.parse(JSON.stringify(canvas.groups)));
            setCurrentCanvasId(id);
            clearSelection();

            // 恢复视口状态
            if (canvas.pan && canvas.scale) {
                setPan(canvas.pan);
                setScale(canvas.scale);
            } else {
                // 没有保存的视口状态，重置并定位到内容
                if (canvas.nodes.length > 0) {
                    setTimeout(() => {
                        // 内联 fitToContent 逻辑
                        const loadedNodes = canvas.nodes;
                        if (loadedNodes.length === 0) return;
                        const padding = 80;
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        loadedNodes.forEach((n: AppNode) => {
                            const h = n.height || 360;
                            const w = n.width || 420;
                            if (n.x < minX) minX = n.x;
                            if (n.y < minY) minY = n.y;
                            if (n.x + w > maxX) maxX = n.x + w;
                            if (n.y + h > maxY) maxY = n.y + h;
                        });
                        const contentW = maxX - minX;
                        const contentH = maxY - minY;
                        const scaleX = (window.innerWidth - padding * 2) / contentW;
                        const scaleY = (window.innerHeight - padding * 2) / contentH;
                        let newScale = Math.min(scaleX, scaleY, 1);
                        newScale = Math.max(0.2, newScale);
                        const contentCenterX = minX + contentW / 2;
                        const contentCenterY = minY + contentH / 2;
                        const newPanX = (window.innerWidth / 2) - (contentCenterX * newScale);
                        const newPanY = (window.innerHeight / 2) - (contentCenterY * newScale);
                        setPan({ x: newPanX, y: newPanY });
                        setScale(newScale);
                    }, 100);
                } else {
                    setPan({ x: 0, y: 0 });
                    setScale(1);
                }
            }
        }
    }, [currentCanvasId, canvases, saveCurrentCanvas]);

    const deleteCanvas = useCallback((id: string) => {
        if (canvases.length <= 1) {
            // 如果只剩一个画布，不允许删除，而是清空它
            setNodes([]);
            setConnections([]);
            setGroups([]);
            setPan({ x: 0, y: 0 });
            setScale(1);
            return;
        }

        setCanvases(prev => {
            const newCanvases = prev.filter(c => c.id !== id);
            // 如果删除的是当前画布，切换到第一个
            if (id === currentCanvasId && newCanvases.length > 0) {
                const firstCanvas = newCanvases[0];
                setNodes(JSON.parse(JSON.stringify(firstCanvas.nodes)));
                setConnections(JSON.parse(JSON.stringify(firstCanvas.connections)));
                setGroups(JSON.parse(JSON.stringify(firstCanvas.groups)));
                setCurrentCanvasId(firstCanvas.id);
                // 恢复视口状态
                if (firstCanvas.pan && firstCanvas.scale) {
                    setPan(firstCanvas.pan);
                    setScale(firstCanvas.scale);
                } else {
                    setPan({ x: 0, y: 0 });
                    setScale(1);
                }
            }
            return newCanvases;
        });
        clearSelection();
    }, [canvases, currentCanvasId, clearSelection]);

    const renameCanvas = useCallback((id: string, newTitle: string) => {
        setCanvases(prev => prev.map(c => c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c));
    }, []);

    // 自动保存当前画布（节流）
    useEffect(() => {
        if (!currentCanvasId || !isLoaded) return;
        const timer = setTimeout(() => {
            saveCurrentCanvas();
        }, 2000); // 2秒后自动保存
        return () => clearTimeout(timer);
    }, [nodes, connections, groups, currentCanvasId, isLoaded, saveCurrentCanvas]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); selectNodes(nodesRef.current.map(n => n.id)); return; }
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); redo(); return; }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') { const lastSelected = selectedNodeIds[selectedNodeIds.length - 1]; if (lastSelected) { const nodeToCopy = nodesRef.current.find(n => n.id === lastSelected); if (nodeToCopy) { e.preventDefault(); setClipboard(JSON.parse(JSON.stringify(nodeToCopy))); } } return; }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
                if (clipboard) {
                    e.preventDefault();
                    saveHistory();
                    const newNodeId = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    // 继承原节点的输入连接
                    const inheritedInputs = clipboard.inputs || [];
                    const newNode: AppNode = {
                        ...clipboard,
                        id: newNodeId,
                        x: clipboard.x + 50,
                        y: clipboard.y + 50,
                        status: NodeStatus.IDLE,
                        inputs: inheritedInputs
                    };
                    setNodes(prev => [...prev, newNode]);
                    // 为继承的输入创建新的连接
                    if (inheritedInputs.length > 0) {
                        const newConnections = inheritedInputs.map(inputId => ({ from: inputId, to: newNodeId }));
                        setConnections(prev => [...prev, ...newConnections]);
                    }
                    selectNodes([newNode.id]);
                }
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedGroupIds.length > 0 || selectedNodeIds.length > 0) {
                    saveHistory();
                    if (selectedGroupIds.length > 0) {
                        setGroups(prev => prev.filter(g => !selectedGroupIds.includes(g.id)));
                        selectGroups([]);
                    }
                    if (selectedNodeIds.length > 0) {
                        deleteNodes(selectedNodeIds);
                    }
                }
            }
        };
        const handleKeyDownSpace = (e: KeyboardEvent) => {
            if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                e.preventDefault(); // Prevent page scroll
                document.body.classList.add('cursor-grab-override');
                setIsSpacePressed(true);
            }
        };
        const handleKeyUpSpace = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                document.body.classList.remove('cursor-grab-override');
                setIsSpacePressed(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown); window.addEventListener('keydown', handleKeyDownSpace); window.addEventListener('keyup', handleKeyUpSpace);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keydown', handleKeyDownSpace); window.removeEventListener('keyup', handleKeyUpSpace); };
    }, [selectedWorkflowId, selectedNodeIds, selectedGroupIds, deleteNodes, undo, saveHistory, clipboard]);

    const handleCanvasDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    const handleCanvasDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const dropX = (e.clientX - pan.x) / scale;
        const dropY = (e.clientY - pan.y) / scale;
        const assetData = e.dataTransfer.getData('application/json');
        const workflowId = e.dataTransfer.getData('application/workflow-id');

        if (workflowId && workflows) {
            const wf = workflows.find(w => w.id === workflowId);
            if (wf) {
                saveHistory();
                const minX = Math.min(...wf.nodes.map(n => n.x));
                const minY = Math.min(...wf.nodes.map(n => n.y));
                const width = Math.max(...wf.nodes.map(n => n.x + (n.width || 420))) - minX;
                const height = Math.max(...wf.nodes.map(n => n.y + 320)) - minY;
                const offsetX = dropX - (minX + width / 2);
                const offsetY = dropY - (minY + height / 2);
                const idMap = new Map<string, string>();
                const newNodes = wf.nodes.map(n => { const newId = `n-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; idMap.set(n.id, newId); return { ...n, id: newId, x: n.x + offsetX, y: n.y + offsetY, status: NodeStatus.IDLE, inputs: [] as string[] }; });
                newNodes.forEach((n, i) => { const original = wf.nodes[i]; n.inputs = original.inputs.map(oldId => idMap.get(oldId)).filter(Boolean) as string[]; });
                const newConnections = wf.connections.map(c => ({ from: idMap.get(c.from)!, to: idMap.get(c.to)! })).filter(c => c.from && c.to);
                const newGroups = (wf.groups || []).map(g => ({ ...g, id: `g-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, x: g.x + offsetX, y: g.y + offsetY }));
                setNodes(prev => [...prev, ...newNodes]); setConnections(prev => [...prev, ...newConnections]); setGroups(prev => [...prev, ...newGroups]);
            }
            return;
        }
        if (assetData) {
            try {
                const asset = JSON.parse(assetData);
                if (asset && asset.type) {
                    if (asset.type === 'image') addNode(NodeType.IMAGE_GENERATOR, dropX - 210, dropY - 180, { image: asset.src, prompt: asset.title });
                    else if (asset.type === 'video') addNode(NodeType.VIDEO_GENERATOR, dropX - 210, dropY - 180, { videoUri: asset.src });
                }
                return;
            } catch (err) { console.error("Drop failed", err); }
        }

        // Updated Multi-File Logic (9-Grid Support)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files) as File[];
            const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));

            if (validFiles.length > 0) {
                const COLS = 3;
                const GAP = 40;
                const BASE_WIDTH = 420;
                const BASE_HEIGHT = 450;

                const startX = dropX - 210;
                const startY = dropY - 180;

                validFiles.forEach((file, index) => {
                    const col = index % COLS;
                    const row = Math.floor(index / COLS);

                    const xPos = startX + (col * (BASE_WIDTH + GAP));
                    const yPos = startY + (row * BASE_HEIGHT);

                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const res = event.target?.result as string;
                        if (file.type.startsWith('image/')) {
                            addNode(NodeType.IMAGE_GENERATOR, xPos, yPos, { image: res, prompt: file.name, status: NodeStatus.SUCCESS });
                        } else if (file.type.startsWith('video/')) {
                            addNode(NodeType.VIDEO_GENERATOR, xPos, yPos, { videoUri: res, prompt: file.name, status: NodeStatus.SUCCESS });
                        }
                    };
                    reader.readAsDataURL(file);
                });
            }
        }
    };

    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = ` .cursor-grab-override, .cursor-grab-override * { cursor: grab !important; } .cursor-grab-override:active, .cursor-grab-override:active * { cursor: grabbing !important; } `;
        document.head.appendChild(style);

        // Disable global scrollbars for Studio canvas
        const htmlEl = document.documentElement;
        const bodyEl = document.body;
        const originalHtmlOverflow = htmlEl.style.overflow;
        const originalBodyOverflow = bodyEl.style.overflow;
        htmlEl.style.overflow = 'hidden';
        bodyEl.style.overflow = 'hidden';

        return () => {
            document.head.removeChild(style);
            // Restore original overflow on unmount
            htmlEl.style.overflow = originalHtmlOverflow;
            bodyEl.style.overflow = originalBodyOverflow;
        };
    }, []);

    return (
        <div className="w-screen h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200" style={{ '--grid-color': '#cbd5e1', '--grid-color-dark': '#334155' } as React.CSSProperties}>
            <div
                ref={canvasContainerRef}
                data-canvas-container
                className={`w-full h-full overflow-hidden text-slate-700 selection:bg-blue-200 ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-default'} ${(isDraggingCanvas || draggingNodeId || resizingNodeId || connectionStart || selectionRect || draggingGroup) ? 'select-none' : ''}`}
                onMouseDown={handleCanvasMouseDown}
                onDoubleClick={(e) => {
                    e.preventDefault();
                    // 只在画布空白区域双击时触发
                    const target = e.target as HTMLElement;

                    // 排除：节点、分组、侧边栏、对话面板、节点配置面板
                    const isOnNode = target.closest('[data-node-id]');
                    const isOnGroup = target.closest('[data-group-id]');
                    const isOnSidebar = target.closest('[data-sidebar]');
                    const isOnChat = target.closest('[data-chat-panel]');
                    const isOnConfigPanel = target.closest('[data-config-panel]');
                    if (isOnNode || isOnGroup || isOnSidebar || isOnChat || isOnConfigPanel || selectionRect) return;

                    // 转换为画布坐标并检查是否在空白区域
                    const rect = canvasContainerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const canvasX = (e.clientX - rect.left - pan.x) / scale;
                    const canvasY = (e.clientY - rect.top - pan.y) / scale;

                    if (isPointOnEmptyCanvas(canvasX, canvasY)) {
                        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: '' });
                        setContextMenuTarget({ type: 'create' });
                    }
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    // 如果有多个节点被选中，显示多选菜单
                    if (selectedNodeIds.length > 1) {
                        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: '' });
                        setContextMenuTarget({ type: 'multi-selection', ids: selectedNodeIds });
                    } else if (e.target === e.currentTarget) {
                        setContextMenu(null);
                    }
                }}
                onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}
            >
                <div className="absolute inset-0 noise-bg opacity-30 dark:opacity-20 pointer-events-none" />
                <div className="absolute inset-0 pointer-events-none opacity-[0.4] dark:opacity-[0.5]" style={{ backgroundImage: 'radial-gradient(circle, var(--grid-color) 1px, transparent 1px)', backgroundSize: `${32 * scale}px ${32 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />
                {/* 深色模式下使用更亮的网格点颜色 */}
                <style dangerouslySetInnerHTML={{ __html: `.dark [data-canvas-container] { --grid-color: #475569; }` }} />

                {/* 空状态 / 初始欢迎页 - 重新设计 (V2: 极简去框) */}
                <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-[${SPRING}] z-10 pointer-events-none ${nodes.length > 0 ? 'opacity-0 scale-110 blur-sm' : 'opacity-100 scale-100 blur-0'}`}>
                    <div className="relative group select-none">
                        {/* 氛围背景光 - 使用主题色 (更柔和低饱和) */}
                        <div className="absolute -top-20 -left-20 w-64 h-64 bg-amber-400/10 dark:bg-amber-900/10 rounded-full blur-[120px] animate-pulse" />
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400/10 dark:bg-blue-900/10 rounded-full blur-[120px] animate-pulse delay-700" />
                        <div className="absolute -bottom-20 left-10 w-64 h-64 bg-emerald-400/10 dark:bg-emerald-900/10 rounded-full blur-[120px] animate-pulse delay-1000" />

                        {/* 主卡片 */}
                        <div className="relative">
                            <div className="relative flex flex-col items-center">

                                {/* Logo & Title */}
                                <div className="flex items-center gap-4 mb-8">
                                    {/* Logo - 根据主题切换 */}
                                    <div className="relative w-16 h-16 flex items-center justify-center">
                                        <img
                                            src={theme === 'dark' ? '/logolight.svg' : '/logodark.svg'}
                                            alt="ZeoCanvas Logo"
                                            className="w-14 h-14 object-contain"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <h1 className="text-4xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                                            Zeo<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500 font-extrabold">Canvas</span>
                                        </h1>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="h-1 w-1 rounded-full bg-amber-400" />
                                            <span className="h-1 w-1 rounded-full bg-blue-400" />
                                            <span className="h-1 w-1 rounded-full bg-emerald-400" />
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">AI Creative Workspace</span>
                                        </div>
                                    </div>
                                </div>



                                <div className="mt-8 flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-medium">
                                    <MousePointerClick size={14} />
                                    <span>双击画布任意位置唤起菜单</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <input type="file" ref={replaceVideoInputRef} className="hidden" accept="video/*" onChange={(e) => handleReplaceFile(e, 'video')} />
                <input type="file" ref={replaceImageInputRef} className="hidden" accept="image/*" onChange={(e) => handleReplaceFile(e, 'image')} />

                <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, width: '100%', height: '100%', transformOrigin: '0 0' }} className="w-full h-full">
                    {/* Groups Layer */}
                    {groups.map(g => (
                        <div
                            key={g.id}
                            ref={(el) => { if (el) groupRefsMap.current.set(g.id, el); else groupRefsMap.current.delete(g.id); }}
                            className={`absolute rounded-[32px] border transition-all ${(draggingGroup?.id === g.id || draggingNodeParentGroupId === g.id || resizingGroupId === g.id) ? 'duration-0' : 'duration-300'} ${selectedGroupIds.includes(g.id) ? 'border-blue-500/50 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'}`}
                            style={{ left: g.x, top: g.y, width: g.width, height: g.height }}
                            onMouseDown={(e) => {
                                // 检查是否点击在连接点上
                                const target = e.target as HTMLElement;
                                if (target.closest('[data-group-port]')) return;
                                if (target.closest('[data-resize-handle]')) return;
                                e.stopPropagation(); e.preventDefault();
                                // 点击分组：选中分组，清除节点选择
                                setSelection({ nodeIds: [], groupIds: [g.id] });
                                const childNodes = nodes.filter(n => { const b = getNodeBounds(n); const cx = b.x + b.width / 2; const cy = b.y + b.height / 2; return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height; }).map(n => ({ id: n.id, startX: n.x, startY: n.y }));
                                dragGroupRef.current = { id: g.id, startX: g.x, startY: g.y, mouseStartX: e.clientX, mouseStartY: e.clientY, childNodes };
                                setActiveGroupNodeIds(childNodes.map(c => c.id)); setDraggingGroup({ id: g.id });
                            }}
                            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: g.id }); setContextMenuTarget({ type: 'group', id: g.id }); }}
                        >
                            <div className="absolute -top-8 left-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{g.title}</div>
                            {/* 分组右侧连接点 - 仅当内容全部为图片素材时显示 */}
                            {(() => {
                                // 找出分组内的所有节点
                                const groupNodes = nodes.filter(n => {
                                    const b = getNodeBounds(n);
                                    const cx = b.x + b.width / 2;
                                    const cy = b.y + b.height / 2;
                                    return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height;
                                });
                                // 仅当有节点且全部为图片素材时显示连接点
                                const shouldShowPort = groupNodes.length > 0 && groupNodes.every(n => n.type === NodeType.IMAGE_ASSET);
                                if (!shouldShowPort) return null;

                                const inverseScale = 1 / Math.max(0.1, scale);
                                return (
                                    <div
                                        data-group-port="output"
                                        className={`absolute rounded-full border bg-white dark:bg-slate-800 cursor-crosshair flex items-center justify-center transition-all duration-300 shadow-md z-50
                                            w-5 h-5 border-blue-400 hover:scale-150 hover:bg-blue-500 hover:border-blue-500 group/output
                                            ${connectionStart ? 'ring-2 ring-purple-400 animate-pulse' : ''}`}
                                        style={{
                                            right: `${-12 * inverseScale}px`,
                                            top: '50%',
                                            transform: `translateY(-50%) scale(${inverseScale})`,
                                            transformOrigin: 'center center'
                                        }}
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            // 开始从分组拖拽连接线
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            const centerX = rect.left + rect.width / 2;
                                            const centerY = rect.top + rect.height / 2;
                                            startConnecting({
                                                id: `group:${g.id}`,
                                                portType: 'output',
                                                screenX: centerX,
                                                screenY: centerY
                                            });
                                        }}
                                        onMouseUp={(e) => {
                                            e.stopPropagation();
                                            // 如果有连接正在进行，完成连接
                                            if (connectionStart && connectionStart.id !== `group:${g.id}`) {
                                                // 分组只能作为输出端，不能接收连接
                                            }
                                            finishInteraction();
                                        }}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            // 双击分组连接点，弹出下游节点选择菜单
                                            const canvasX = (e.clientX - pan.x) / scale;
                                            const canvasY = (e.clientY - pan.y) / scale;
                                            setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: g.id });
                                            setContextMenuTarget({ type: 'group-output-action', groupId: g.id, canvasX, canvasY });
                                        }}
                                        title="双击或拖拽创建下游节点"
                                    >
                                        <Plus size={12} strokeWidth={3} className="text-blue-400 group-hover/output:text-white transition-colors" />
                                    </div>
                                );
                            })()}
                            {/* 分组右下角调整尺寸手柄 */}
                            <div
                                data-resize-handle
                                className="absolute w-5 h-5 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
                                style={{ right: 4, bottom: 4, zIndex: 100 }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setResizingGroupId(g.id);
                                    resizeGroupRef.current = {
                                        id: g.id,
                                        initialWidth: g.width,
                                        initialHeight: g.height,
                                        startX: e.clientX,
                                        startY: e.clientY
                                    };
                                }}
                            >
                                <svg viewBox="0 0 20 20" className="w-full h-full text-slate-400 dark:text-slate-500">
                                    <path d="M17 17L7 17M17 17L17 7M17 17L10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                    ))}

                    {/* Connections Layer */}
                    <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}>
                        {connections.map((conn) => {
                            const f = nodes.find(n => n.id === conn.from), t = nodes.find(n => n.id === conn.to);
                            if (!f || !t) return null;

                            // 检查源节点是否在有 hasOutputPort 的分组中
                            const sourceGroup = groups.find(g => {
                                if (!g.hasOutputPort) return false;
                                const cx = f.x + (f.width || 420) / 2;
                                const cy = f.y + (f.height || getApproxNodeHeight(f)) / 2;
                                return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height;
                            });

                            // 计算连接点中心位置
                            const fW = f.width || 420, fH = f.height || getApproxNodeHeight(f);
                            const tH = t.height || getApproxNodeHeight(t);

                            // 如果源节点在分组中，从分组连接点出发
                            let fx: number, fy: number;
                            if (sourceGroup) {
                                fx = sourceGroup.x + sourceGroup.width + PORT_OFFSET;
                                fy = sourceGroup.y + sourceGroup.height / 2;
                            } else {
                                fx = f.x + fW + PORT_OFFSET;
                                fy = f.y + fH / 2;
                            }

                            const tx = t.x - PORT_OFFSET; let ty = t.y + tH / 2;
                            if (Math.abs(fy - ty) < 0.5) ty += 0.5;
                            if (isNaN(fx) || isNaN(fy) || isNaN(tx) || isNaN(ty)) return null;
                            const d = generateBezierPath(fx, fy, tx, ty);
                            // 自动连接（批量生产）使用虚线样式
                            const isAutoConnection = conn.isAuto;
                            const connKey = `${conn.from}-${conn.to}`;
                            return (
                                <g key={connKey} className="pointer-events-auto group/line">
                                    <path
                                        ref={(el) => { if (el) connectionPathsRef.current.set(connKey, el); else connectionPathsRef.current.delete(connKey); }}
                                        d={d}
                                        stroke={isAutoConnection ? `url(#${theme === 'dark' ? 'autoGradientDark' : 'autoGradient'})` : `url(#${theme === 'dark' ? 'gradientDark' : 'gradient'})`}
                                        strokeWidth={(isAutoConnection ? 2 : 3) / scale}
                                        fill="none"
                                        strokeOpacity={isAutoConnection ? "0.4" : "0.5"}
                                        strokeDasharray={isAutoConnection ? `${8 / scale} ${4 / scale}` : "none"}
                                        className="transition-colors duration-300 group-hover/line:stroke-white group-hover/line:stroke-opacity-40"
                                    />
                                    <path ref={(el) => { if (el) connectionPathsRef.current.set(`${connKey}-hit`, el); else connectionPathsRef.current.delete(`${connKey}-hit`); }} d={d} stroke="transparent" strokeWidth="15" fill="none" style={{ cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: connKey }); setContextMenuTarget({ type: 'connection', from: conn.from, to: conn.to }); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: connKey }); setContextMenuTarget({ type: 'connection', from: conn.from, to: conn.to }); }} />
                                </g>
                            );
                        })}
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.5" />
                            </linearGradient>
                            {/* 自动连接的渐变色（更淡） */}
                            <linearGradient id="autoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.4" />
                            </linearGradient>
                            <linearGradient id="previewGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
                            </linearGradient>
                            {/* Dark mode gradients */}
                            <linearGradient id="gradientDark" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.6" />
                            </linearGradient>
                            <linearGradient id="autoGradientDark" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#64748b" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.5" />
                            </linearGradient>
                            <linearGradient id="previewGradientDark" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.9" />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.9" />
                            </linearGradient>
                        </defs>
                        {connectionStart && (() => {
                            // 计算起点位置（连接点中心）
                            let startX = 0, startY = 0;
                            if (connectionStart.id === 'smart-sequence-dock') {
                                startX = (connectionStart.screenX - pan.x) / scale;
                                startY = (connectionStart.screenY - pan.y) / scale;
                            } else if (connectionStart.id.startsWith('group:')) {
                                // 分组连接点
                                const groupId = connectionStart.id.replace('group:', '');
                                const group = groups.find(g => g.id === groupId);
                                if (!group) return null;
                                startX = group.x + group.width + PORT_OFFSET;
                                startY = group.y + group.height / 2;
                            } else {
                                const startNode = nodes.find(n => n.id === connectionStart.id);
                                if (!startNode) return null;
                                const w = startNode.width || 420;
                                const h = startNode.height || getApproxNodeHeight(startNode);
                                startY = startNode.y + h / 2;
                                startX = connectionStart.portType === 'output'
                                    ? startNode.x + w + PORT_OFFSET
                                    : startNode.x - PORT_OFFSET;
                            }
                            const endX = (mousePos.x - pan.x) / scale;
                            const endY = (mousePos.y - pan.y) / scale;
                            // 预览线使用简单直线，更直观
                            return (
                                <path
                                    d={`M ${startX} ${startY} L ${endX} ${endY}`}
                                    stroke={`url(#${theme === 'dark' ? 'previewGradientDark' : 'previewGradient'})`}
                                    strokeWidth={3 / scale}
                                    fill="none"
                                    strokeLinecap="round"
                                />
                            );
                        })()}
                    </svg>

                    {nodes.map(node => (
                        <Node
                            key={node.id} node={node} zoom={scale} onUpdate={handleNodeUpdate} onAction={handleNodeAction} onDelete={(id) => deleteNodes([id])} onExpand={setExpandedMedia} onEdit={(nodeId, src, originalImage, canvasData) => setEditingImage({ nodeId, src, originalImage, canvasData })} onCrop={(id, src, type) => { setCroppingNodeId(id); if (type === 'video') { setVideoToCrop(src); setImageToCrop(null); } else { setImageToCrop(src); setVideoToCrop(null); } }}
                            onNodeMouseDown={(e, id) => {
                                e.stopPropagation();
                                e.preventDefault(); // 防止拖拽选中文本

                                // 点击节点时，让当前聚焦的输入框失去焦点（除非点击的是输入框本身）
                                const target = e.target as HTMLElement;
                                if (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') {
                                    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                                }

                                // 检测是否是复制拖拽（Cmd/Ctrl + 拖拽）
                                const isCopyDrag = e.metaKey || e.ctrlKey;

                                // 处理选择逻辑 - 仅 Shift 用于多选切换
                                let currentSelection = selectedNodeIds;
                                if (e.shiftKey) {
                                    // Shift 点击：切换选择
                                    currentSelection = selectedNodeIds.includes(id)
                                        ? selectedNodeIds.filter(i => i !== id)
                                        : [...selectedNodeIds, id];
                                    selectNodes(currentSelection);
                                } else if (!selectedNodeIds.includes(id) && !isCopyDrag) {
                                    // 点击未选中的节点：只选中当前节点（复制拖拽时不改变选择）
                                    currentSelection = [id];
                                    selectNodes(currentSelection);
                                }
                                // 如果点击已选中的节点，保持当前选择不变（允许拖动多选）

                                const n = nodes.find(x => x.id === id);
                                if (n) {
                                    const w = n.width || 420;
                                    const h = n.height || getApproxNodeHeight(n);
                                    const cx = n.x + w / 2;
                                    const cy = n.y + 160;
                                    const pGroup = groups.find(g => cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height);
                                    let siblingNodeIds: string[] = [];
                                    if (pGroup) {
                                        siblingNodeIds = nodes.filter(other => {
                                            if (other.id === id) return false;
                                            const b = getNodeBounds(other);
                                            const ocx = b.x + b.width / 2;
                                            const ocy = b.y + b.height / 2;
                                            return ocx > pGroup.x && ocx < pGroup.x + pGroup.width && ocy > pGroup.y && ocy < pGroup.y + pGroup.height;
                                        }).map(s => s.id);
                                    }

                                    // 记录其他选中节点的初始位置（用于多选拖动）
                                    const otherSelectedNodes = currentSelection
                                        .filter(nodeId => nodeId !== id)
                                        .map(nodeId => {
                                            const node = nodes.find(x => x.id === nodeId);
                                            return node ? { id: nodeId, startX: node.x, startY: node.y } : null;
                                        })
                                        .filter((item): item is { id: string, startX: number, startY: number } => item !== null);

                                    // 记录选中的分组的初始位置及其内部节点（用于多选拖动）
                                    const selectedGroupsData = selectedGroupIds.map(gId => {
                                        const group = groups.find(g => g.id === gId);
                                        if (!group) return null;
                                        // 找出分组内部的节点（不包括已在otherSelectedNodes中的节点）
                                        const childNodes = nodes.filter(nd => {
                                            const b = getNodeBounds(nd);
                                            const cx = b.x + b.width / 2;
                                            const cy = b.y + b.height / 2;
                                            const inGroup = cx > group.x && cx < group.x + group.width && cy > group.y && cy < group.y + group.height;
                                            // 排除已经单独选中的节点（避免重复移动）
                                            const alreadySelected = currentSelection.includes(nd.id);
                                            return inGroup && !alreadySelected;
                                        }).map(nd => ({ id: nd.id, startX: nd.x, startY: nd.y }));
                                        return { id: gId, startX: group.x, startY: group.y, childNodes };
                                    }).filter((item): item is { id: string, startX: number, startY: number, childNodes: { id: string, startX: number, startY: number }[] } => item !== null);

                                    dragNodeRef.current = {
                                        id,
                                        startX: n.x,
                                        startY: n.y,
                                        mouseStartX: e.clientX,
                                        mouseStartY: e.clientY,
                                        parentGroupId: pGroup?.id,
                                        siblingNodeIds,
                                        nodeWidth: w,
                                        nodeHeight: h,
                                        otherSelectedNodes,
                                        selectedGroups: selectedGroupsData,
                                        isCopyDrag
                                    };
                                    setDraggingNodeParentGroupId(pGroup?.id || null);
                                    setDraggingNodeId(id);
                                }
                            }}
                            onPortMouseDown={(e, id, type) => {
                                e.stopPropagation();
                                e.preventDefault(); // 防止拖拽选中文本
                                // Get the actual center position of the port element
                                const portElement = e.currentTarget as HTMLElement;
                                const rect = portElement.getBoundingClientRect();
                                const centerX = rect.left + rect.width / 2;
                                const centerY = rect.top + rect.height / 2;
                                startConnecting({ id, portType: type, screenX: centerX, screenY: centerY });
                            }}
                            onPortMouseUp={(e, id, type) => {
                                e.stopPropagation();
                                const start = getConnectionStartRef();
                                if (start && start.id !== id) {
                                    if (start.id === 'smart-sequence-dock') {
                                        // Smart sequence dock connection - do nothing for now
                                    } else if (start.id.startsWith('group:')) {
                                        // 分组连接到节点：将分组内所有素材节点连接到目标节点
                                        const groupId = start.id.replace('group:', '');
                                        const group = groupsRef.current.find(g => g.id === groupId);
                                        if (group) {
                                            // 获取分组内的所有节点（使用 nodeIds 或通过位置计算）
                                            const groupNodeIds = group.nodeIds || nodes.filter(n => {
                                                const b = getNodeBounds(n);
                                                const cx = b.x + b.width / 2;
                                                const cy = b.y + b.height / 2;
                                                return cx > group.x && cx < group.x + group.width && cy > group.y && cy < group.y + group.height;
                                            }).map(n => n.id);

                                            // 为每个分组内节点创建连接
                                            const newConnections: Connection[] = [];
                                            groupNodeIds.forEach(nodeId => {
                                                const exists = connectionsRef.current.some(c => c.from === nodeId && c.to === id);
                                                if (!exists) {
                                                    newConnections.push({ from: nodeId, to: id });
                                                }
                                            });

                                            if (newConnections.length > 0) {
                                                setConnections(p => [...p, ...newConnections]);
                                                // 更新目标节点的 inputs
                                                setNodes(p => p.map(n => {
                                                    if (n.id !== id) return n;
                                                    const newInputs = [...n.inputs];

                                                    // 如果目标是 MULTI_FRAME_VIDEO，添加所有图片为帧
                                                    if (n.type === NodeType.MULTI_FRAME_VIDEO) {
                                                        let currentFrames = n.data.multiFrameData?.frames || [];
                                                        groupNodeIds.forEach(nodeId => {
                                                            if (!newInputs.includes(nodeId)) {
                                                                newInputs.push(nodeId);
                                                                const sourceNode = p.find(x => x.id === nodeId);
                                                                const sourceImage = sourceNode?.data.image;
                                                                if (sourceImage && !currentFrames.some(f => f.src === sourceImage) && currentFrames.length < 10) {
                                                                    currentFrames = [...currentFrames, {
                                                                        id: `mf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                                                        src: sourceImage,
                                                                        transition: { duration: 4, prompt: '' }
                                                                    }];
                                                                }
                                                            }
                                                        });
                                                        return {
                                                            ...n,
                                                            inputs: newInputs,
                                                            data: {
                                                                ...n.data,
                                                                multiFrameData: {
                                                                    ...n.data.multiFrameData,
                                                                    frames: currentFrames,
                                                                }
                                                            }
                                                        };
                                                    }

                                                    // 普通节点
                                                    groupNodeIds.forEach(nodeId => {
                                                        if (!newInputs.includes(nodeId)) {
                                                            newInputs.push(nodeId);
                                                        }
                                                    });
                                                    return { ...n, inputs: newInputs };
                                                }));
                                            }
                                        }
                                    } else {
                                        // Determine connection direction based on port types
                                        // output -> input: from = start, to = target (normal)
                                        // input -> output: from = target, to = start (reversed)
                                        let fromId = start.id;
                                        let toId = id;
                                        if (start.portType === 'input' && type === 'output') {
                                            // Reverse: target output -> start input
                                            fromId = id;
                                            toId = start.id;
                                        }
                                        // Prevent duplicate connections
                                        setConnections(p => {
                                            const exists = p.some(c => c.from === fromId && c.to === toId);
                                            if (exists) return p;
                                            return [...p, { from: fromId, to: toId }];
                                        });
                                        setNodes(p => {
                                            // 获取源节点信息
                                            const sourceNode = p.find(x => x.id === fromId);
                                            const sourceImage = sourceNode?.data.image;
                                            const sourcePrompt = sourceNode?.data.prompt;
                                            const isSourcePromptNode = sourceNode?.type === NodeType.PROMPT_INPUT;

                                            return p.map(n => {
                                                if (n.id !== toId) return n;
                                                // Prevent duplicate inputs
                                                if (n.inputs.includes(fromId)) return n;

                                                // 如果目标是 MULTI_FRAME_VIDEO 且源节点有图片，添加为帧
                                                if (n.type === NodeType.MULTI_FRAME_VIDEO && sourceImage) {
                                                    const currentFrames = n.data.multiFrameData?.frames || [];
                                                    // 检查是否已存在该图片
                                                    const alreadyExists = currentFrames.some(f => f.src === sourceImage);
                                                    if (!alreadyExists && currentFrames.length < 10) {
                                                        const newFrame = {
                                                            id: `mf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                                            src: sourceImage,
                                                            transition: { duration: 4, prompt: '' }
                                                        };
                                                        return {
                                                            ...n,
                                                            inputs: [...n.inputs, fromId],
                                                            data: {
                                                                ...n.data,
                                                                multiFrameData: {
                                                                    ...n.data.multiFrameData,
                                                                    frames: [...currentFrames, newFrame],
                                                                }
                                                            }
                                                        };
                                                    }
                                                }

                                                // 如果源节点是提示词节点，且目标是图片/视频生成节点，自动复制提示词
                                                if (isSourcePromptNode && sourcePrompt && (
                                                    n.type === NodeType.IMAGE_GENERATOR ||
                                                    n.type === NodeType.VIDEO_GENERATOR ||
                                                    n.type === NodeType.VIDEO_FACTORY
                                                )) {
                                                    return {
                                                        ...n,
                                                        inputs: [...n.inputs, fromId],
                                                        data: { ...n.data, prompt: sourcePrompt }
                                                    };
                                                }

                                                return { ...n, inputs: [...n.inputs, fromId] };
                                            });
                                        });
                                    }
                                }
                                // 结束连接模式
                                finishInteraction();
                            }}
                            onNodeContextMenu={(e, id) => {
                                e.stopPropagation(); e.preventDefault();
                                // 如果选中了多个节点，统一显示多选菜单
                                if (selectedNodeIds.length > 1) {
                                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: 'multi' });
                                    setContextMenuTarget({ type: 'multi-selection', ids: selectedNodeIds });
                                } else {
                                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id });
                                    setContextMenuTarget({ type: 'node', id });
                                }
                            }}
                            onOutputPortAction={(nodeId, position) => {
                                // 双击右连接点时，弹出适配上游素材的节点选择框
                                const canvasX = (position.x - pan.x) / scale;
                                const canvasY = (position.y - pan.y) / scale;
                                setContextMenu({ visible: true, x: position.x, y: position.y, id: nodeId });
                                setContextMenuTarget({ type: 'output-action', sourceNodeId: nodeId, canvasX, canvasY });
                            }}
                            onInputPortAction={(nodeId, position) => {
                                // 双击左连接点时，弹出上游节点选择框（素材/描述）
                                const canvasX = (position.x - pan.x) / scale;
                                const canvasY = (position.y - pan.y) / scale;
                                setContextMenu({ visible: true, x: position.x, y: position.y, id: nodeId });
                                setContextMenuTarget({ type: 'input-action', targetNodeId: nodeId, canvasX, canvasY });
                            }}
                            onResizeMouseDown={(e, id, w, h) => {
                                e.stopPropagation(); e.preventDefault(); // 防止拖拽选中文本
                                const n = nodes.find(x => x.id === id);
                                if (n) {
                                    const cx = n.x + w / 2; const cy = n.y + 160;
                                    const pGroup = groups.find(g => { return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height; });
                                    setDraggingNodeParentGroupId(pGroup?.id || null);
                                    let siblingNodeIds: string[] = [];
                                    if (pGroup) { siblingNodeIds = nodes.filter(other => { if (other.id === id) return false; const b = getNodeBounds(other); const ocx = b.x + b.width / 2; const ocy = b.y + b.height / 2; return ocx > pGroup.x && ocx < pGroup.x + pGroup.width && ocy > pGroup.y && ocy < pGroup.y + pGroup.height; }).map(s => s.id); }
                                    resizeContextRef.current = { nodeId: id, initialWidth: w, initialHeight: h, startX: e.clientX, startY: e.clientY, parentGroupId: pGroup?.id || null, siblingNodeIds };
                                }
                                setResizingNodeId(id); setInitialSize({ width: w, height: h }); setResizeStartPos({ x: e.clientX, y: e.clientY });
                            }}
                            onDragResultToCanvas={handleDragResultToCanvas}
                            onGridDragStateChange={handleGridDragStateChange}
                            onBatchUpload={handleBatchUpload}
                            isSelected={selectedNodeIds.includes(node.id)}
                            inputAssets={node.inputs.map(i => nodes.find(n => n.id === i)).filter(n => n && (n.data.image || n.data.videoUri || n.data.croppedFrame)).slice(0, 6).map(n => ({ id: n!.id, type: (n!.data.croppedFrame || n!.data.image) ? 'image' : 'video', src: n!.data.croppedFrame || n!.data.image || n!.data.videoUri! }))}
                            onInputReorder={(nodeId, newOrder) => { const node = nodes.find(n => n.id === nodeId); if (node) { setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, inputs: newOrder } : n)); } }}
                            nodeRef={(el) => { if (el) nodeRefsMap.current.set(node.id, el); else nodeRefsMap.current.delete(node.id); }}
                            isDragging={draggingNodeId === node.id} isResizing={resizingNodeId === node.id} isConnecting={!!connectionStart} isGroupDragging={activeGroupNodeIds.includes(node.id)}
                        />
                    ))}

                    {selectionRect && <div className="absolute border border-cyan-500/40 bg-cyan-500/10 rounded-lg pointer-events-none" style={{ left: (Math.min(selectionRect.startX, selectionRect.currentX) - pan.x) / scale, top: (Math.min(selectionRect.startY, selectionRect.currentY) - pan.y) / scale, width: Math.abs(selectionRect.currentX - selectionRect.startX) / scale, height: Math.abs(selectionRect.currentY - selectionRect.startY) / scale }} />}

                    {/* 复制拖拽预览 - 显示节点副本将被创建的位置 */}
                    {copyDragPreview && copyDragPreview.nodes.map((node, idx) => (
                        <div
                            key={idx}
                            className="absolute pointer-events-none rounded-[24px] border-2 border-dashed border-purple-400 bg-purple-500/10"
                            style={{
                                left: node.x,
                                top: node.y,
                                width: node.width,
                                height: node.height,
                            }}
                        >
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="px-3 py-1.5 bg-purple-500/80 rounded-full text-[10px] font-bold text-white whitespace-nowrap shadow-lg flex items-center gap-1">
                                    <Copy size={10} /> 复制到此处
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* 组图拖拽放置预览 - 显示节点将被创建的位置 */}
                    {gridDragDropPreview && (
                        <div
                            className="absolute pointer-events-none rounded-[24px] border-2 border-dashed border-cyan-400 bg-cyan-500/10 backdrop-blur-sm"
                            style={{
                                left: gridDragDropPreview.canvasX,
                                top: gridDragDropPreview.canvasY,
                                width: 420,
                                height: 236,
                                transition: 'left 0.05s ease-out, top 0.05s ease-out',
                            }}
                        >
                            <div className="absolute inset-2 rounded-[20px] overflow-hidden opacity-60">
                                {gridDragDropPreview.type === 'image' ? (
                                    <img src={gridDragDropPreview.src} className="w-full h-full object-cover" />
                                ) : (
                                    <video src={gridDragDropPreview.src} className="w-full h-full object-cover" muted />
                                )}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-12 h-12 rounded-full bg-cyan-500/30 border-2 border-cyan-400 flex items-center justify-center animate-pulse">
                                    <Plus size={24} className="text-cyan-500" />
                                </div>
                            </div>
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 bg-cyan-500 rounded-full text-[10px] font-bold text-white whitespace-nowrap shadow-lg">
                                松开放置
                            </div>
                        </div>
                    )}
                </div>

                {contextMenu && (
                    <div className="fixed z-[100] bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl p-1.5 min-w-[160px] animate-in fade-in zoom-in-95 duration-200 origin-top-left" style={{ top: contextMenu.y, left: contextMenu.x }} onMouseDown={(e) => e.stopPropagation()}>
                        {contextMenuTarget?.type === 'node' && (
                            <>
                                <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-cyan-500/20 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { const targetNode = nodes.find(n => n.id === contextMenu.id); if (targetNode) setClipboard(JSON.parse(JSON.stringify(targetNode))); setContextMenu(null); }}>
                                    <Copy size={12} /> 复制节点
                                </button>
                                {(() => { const targetNode = nodes.find(n => n.id === contextMenu.id); if (targetNode) { const isVideo = targetNode.type === NodeType.VIDEO_GENERATOR; const isImage = targetNode.type === NodeType.IMAGE_GENERATOR || targetNode.type === NodeType.IMAGE_EDITOR; if (isVideo || isImage) { return (<button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-purple-500/20 hover:text-purple-400 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { replacementTargetRef.current = contextMenu.id ?? null; if (isVideo) replaceVideoInputRef.current?.click(); else replaceImageInputRef.current?.click(); setContextMenu(null); }}> <RefreshCw size={12} /> 替换素材 </button>); } } return null; })()}
                                <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 dark:text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors mt-1" onClick={() => { deleteNodes([contextMenuTarget.id]); setContextMenu(null); }}><Trash2 size={12} /> 删除节点</button>
                            </>
                        )}
                        {contextMenuTarget?.type === 'create' && (
                            <>
                                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">创建新节点</div>
                                {[NodeType.PROMPT_INPUT, NodeType.IMAGE_ASSET, NodeType.VIDEO_ASSET, NodeType.IMAGE_GENERATOR, NodeType.VIDEO_GENERATOR, NodeType.MULTI_FRAME_VIDEO, NodeType.AUDIO_GENERATOR].map(t => { const ItemIcon = getNodeIcon(t); return (<button key={t} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2.5 transition-colors" onClick={() => { addNode(t, (contextMenu.x - pan.x) / scale, (contextMenu.y - pan.y) / scale); setContextMenu(null); }}> <ItemIcon size={12} className="text-blue-600 dark:text-blue-400" /> {getNodeNameCN(t)} </button>); })}
                            </>
                        )}
                        {contextMenuTarget?.type === 'group' && (
                            <>
                                <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 transition-colors mb-1" onClick={() => { if (contextMenu.id) saveGroupAsWorkflow(contextMenu.id); setContextMenu(null); }}> <FolderHeart size={12} className="text-blue-600 dark:text-blue-400" /> 保存为工作流 </button>
                                <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 dark:text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { setGroups(p => p.filter(g => g.id !== contextMenu.id)); setContextMenu(null); }}> <Trash2 size={12} /> 删除分组 </button>
                            </>
                        )}
                        {contextMenuTarget?.type === 'connection' && (
                            <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { setConnections(prev => prev.filter(c => c.from !== contextMenuTarget.from || c.to !== contextMenuTarget.to)); setNodes(prev => prev.map(n => n.id === contextMenuTarget.to ? { ...n, inputs: n.inputs.filter(i => i !== contextMenuTarget.from) } : n)); setContextMenu(null); }}> <Unplug size={12} /> 删除连接线 </button>
                        )}
                        {contextMenuTarget?.type === 'output-action' && (() => {
                            // 获取源节点，根据类型显示适配的下游节点选项
                            const sourceNode = nodes.find(n => n.id === contextMenuTarget.sourceNodeId);
                            if (!sourceNode) return null;
                            const hasImage = !!sourceNode.data.image;
                            const hasVideo = !!sourceNode.data.videoUri;
                            const isPromptNode = sourceNode.type === NodeType.PROMPT_INPUT;
                            const hasPromptContent = isPromptNode && !!(sourceNode.data.prompt && sourceNode.data.prompt.trim());

                            // 根据上游类型确定可用的下游节点类型
                            let availableTypes: { type: NodeType, label: string, icon: any, color: string, generationMode?: VideoGenerationMode }[] = [];
                            if (isPromptNode && hasPromptContent) {
                                // 提示词节点：可以生成图片/视频/音频
                                availableTypes = [
                                    { type: NodeType.IMAGE_GENERATOR, label: '生成图片', icon: ImageIcon, color: 'text-blue-500' },
                                    { type: NodeType.VIDEO_GENERATOR, label: '生成视频', icon: Film, color: 'text-purple-500' },
                                    { type: NodeType.AUDIO_GENERATOR, label: '生成音频', icon: Music, color: 'text-pink-500' },
                                ];
                            } else if (hasImage) {
                                availableTypes = [
                                    { type: NodeType.PROMPT_INPUT, label: '分析图片', icon: FileSearch, color: 'text-emerald-500' },
                                    { type: NodeType.IMAGE_GENERATOR, label: '编辑图片', icon: ImageIcon, color: 'text-blue-500' },
                                    { type: NodeType.VIDEO_GENERATOR, label: '生成视频', icon: Film, color: 'text-purple-500' },
                                    { type: NodeType.MULTI_FRAME_VIDEO, label: '智能多帧', icon: Scan, color: 'text-teal-500' },
                                ];
                            } else if (hasVideo) {
                                availableTypes = [
                                    { type: NodeType.PROMPT_INPUT, label: '分析视频', icon: FileSearch, color: 'text-emerald-500' },
                                    { type: NodeType.VIDEO_FACTORY, label: '剧情延展', icon: Film, color: 'text-purple-500', generationMode: 'CONTINUE' },
                                ];
                            }

                            if (availableTypes.length === 0) return null;

                            const handleCreateDownstreamNode = (nodeType: NodeType, generationMode?: VideoGenerationMode) => {
                                saveHistory();
                                const nodeWidth = 420;
                                // 计算节点高度：音频360，视频分析360，其他16:9
                                const nodeHeight = nodeType === NodeType.AUDIO_GENERATOR
                                    ? 360
                                    : Math.round(nodeWidth * 9 / 16);

                                // 鼠标释放位置对应新节点的左侧连接点位置
                                const newX = contextMenuTarget.canvasX !== undefined
                                    ? contextMenuTarget.canvasX + 12
                                    : sourceNode.x + (sourceNode.width || 420) + 80;
                                const newY = contextMenuTarget.canvasY !== undefined
                                    ? contextMenuTarget.canvasY - nodeHeight / 2
                                    : sourceNode.y;

                                const newNodeId = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                                // 根据生成模式设置标题
                                const getTitleByMode = (): string => {
                                    if (nodeType === NodeType.VIDEO_FACTORY && generationMode === 'CONTINUE') {
                                        return '剧情延展';
                                    }
                                    const typeMap: Record<string, string> = {
                                        [NodeType.PROMPT_INPUT]: '素材分析',
                                        [NodeType.IMAGE_GENERATOR]: '图片生成',
                                        [NodeType.VIDEO_GENERATOR]: '视频生成',
                                        [NodeType.VIDEO_FACTORY]: '视频工厂',
                                        [NodeType.AUDIO_GENERATOR]: '音频生成',
                                        [NodeType.MULTI_FRAME_VIDEO]: '智能多帧',
                                    };
                                    return typeMap[nodeType] || '新节点';
                                };

                                // 根据节点类型设置默认模型
                                const getDefaultModel = () => {
                                    if (nodeType === NodeType.PROMPT_INPUT) return 'gemini-2.5-flash';
                                    if (nodeType === NodeType.IMAGE_GENERATOR) return 'nano-banana';
                                    if (nodeType === NodeType.VIDEO_GENERATOR) return 'veo3.1';
                                    if (nodeType === NodeType.VIDEO_FACTORY) return 'veo3.1';
                                    return undefined;
                                };

                                // 如果源节点是提示词节点，将提示词注入到下游节点
                                const promptToInject = isPromptNode ? sourceNode.data.prompt : undefined;

                                // 如果创建智能多帧节点且源节点有图片，将图片作为第一帧
                                const getMultiFrameData = () => {
                                    if (nodeType === NodeType.MULTI_FRAME_VIDEO && hasImage && sourceNode.data.image) {
                                        return {
                                            frames: [{
                                                id: `mf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                                src: sourceNode.data.image,
                                                transition: { duration: 4, prompt: '' }
                                            }],
                                            viduModel: 'viduq2-turbo' as const,
                                            viduResolution: '720p' as const,
                                        };
                                    }
                                    return nodeType === NodeType.MULTI_FRAME_VIDEO
                                        ? { frames: [], viduModel: 'viduq2-turbo' as const, viduResolution: '720p' as const }
                                        : undefined;
                                };

                                const newNode: AppNode = {
                                    id: newNodeId,
                                    type: nodeType,
                                    x: newX,
                                    y: newY,
                                    width: nodeWidth,
                                    height: nodeHeight,
                                    title: getTitleByMode(),
                                    status: NodeStatus.IDLE,
                                    data: {
                                        model: getDefaultModel(),
                                        aspectRatio: '16:9',
                                        ...(generationMode && { generationMode }),
                                        ...(promptToInject && { prompt: promptToInject }), // 注入提示词
                                        ...(getMultiFrameData() && { multiFrameData: getMultiFrameData() }),
                                    },
                                    inputs: [sourceNode.id]
                                };

                                setNodes(prev => [...prev, newNode]);
                                setConnections(prev => [...prev, { from: sourceNode.id, to: newNodeId }]);
                                setContextMenu(null);
                            };

                            // 菜单标题
                            const menuTitle = isPromptNode ? '创建生成节点' : (hasImage ? '图片后续操作' : '视频后续操作');

                            return (
                                <>
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        {menuTitle}
                                    </div>
                                    {availableTypes.map(({ type, label, icon: Icon, color, generationMode }, idx) => (
                                        <button
                                            key={`${type}-${generationMode || idx}`}
                                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2.5 transition-colors"
                                            onClick={() => handleCreateDownstreamNode(type, generationMode)}
                                        >
                                            <Icon size={12} className={color} /> {label}
                                        </button>
                                    ))}
                                </>
                            );
                        })()}
                        {contextMenuTarget?.type === 'input-action' && (() => {
                            // 左连接点双击：创建上游输入节点
                            const targetNode = nodes.find(n => n.id === contextMenuTarget.targetNodeId);
                            if (!targetNode) return null;

                            // 判断目标节点类型：提示词节点只能连接素材用于分析
                            const isPromptNode = targetNode.type === NodeType.PROMPT_INPUT;

                            const handleCreateUpstreamNode = (type: NodeType) => {
                                saveHistory();
                                const newNodeWidth = 420;
                                // 计算新节点高度：文本360，素材16:9(236)
                                const newNodeHeight = type === NodeType.PROMPT_INPUT ? 360 :
                                    (type === NodeType.IMAGE_ASSET || type === NodeType.VIDEO_ASSET) ? Math.round(420 * 9 / 16) : 320;

                                // 获取目标节点的实际高度
                                const targetHeight = targetNode.height || getApproxNodeHeight(targetNode);

                                // 新节点放在目标节点左侧，保持合理间距
                                const gap = 60; // 节点之间的间距
                                const newX = targetNode.x - gap - newNodeWidth;
                                // 新节点中心对齐目标节点中心
                                const newY = targetNode.y + targetHeight / 2 - newNodeHeight / 2;

                                // 获取节点标题
                                const getTitle = () => {
                                    if (type === NodeType.PROMPT_INPUT) return '文本';
                                    if (type === NodeType.IMAGE_ASSET) return '图片';
                                    if (type === NodeType.VIDEO_ASSET) return '视频';
                                    return '节点';
                                };

                                const newNodeId = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                                const newNode: AppNode = {
                                    id: newNodeId,
                                    type,
                                    x: newX,
                                    y: newY,
                                    title: getTitle(),
                                    status: NodeStatus.IDLE,
                                    data: {},
                                    inputs: []
                                };

                                setNodes(prev => [...prev, newNode]);
                                // 自动连接：新节点 → 目标节点
                                setConnections(prev => [...prev, { from: newNodeId, to: targetNode.id }]);
                                // 同时更新目标节点的 inputs
                                setNodes(prev => prev.map(n => n.id === targetNode.id ? { ...n, inputs: [...n.inputs, newNodeId] } : n));
                                setContextMenu(null);
                            };

                            return (
                                <>
                                    <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${isPromptNode ? 'text-amber-600 dark:text-amber-400' : 'text-teal-600 dark:text-teal-400'}`}>
                                        {isPromptNode ? '添加媒体分析' : '添加输入节点'}
                                    </div>
                                    {/* 非提示词节点才显示文本选项 */}
                                    {!isPromptNode && (
                                        <button
                                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg flex items-center gap-2.5 transition-colors"
                                            onClick={() => handleCreateUpstreamNode(NodeType.PROMPT_INPUT)}
                                        >
                                            <Type size={12} className="text-amber-500 dark:text-amber-400" /> 文本
                                        </button>
                                    )}
                                    <button
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg flex items-center gap-2.5 transition-colors"
                                        onClick={() => handleCreateUpstreamNode(NodeType.IMAGE_ASSET)}
                                    >
                                        <ImageIcon size={12} className="text-blue-500 dark:text-blue-400" /> {isPromptNode ? '分析图片' : '图片'}
                                    </button>
                                    <button
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg flex items-center gap-2.5 transition-colors"
                                        onClick={() => handleCreateUpstreamNode(NodeType.VIDEO_ASSET)}
                                    >
                                        <VideoIcon size={12} className="text-green-500 dark:text-green-400" /> {isPromptNode ? '分析视频' : '视频'}
                                    </button>
                                </>
                            );
                        })()}
                        {contextMenuTarget?.type === 'multi-selection' && (
                            <>
                                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    已选中 {contextMenuTarget.ids?.length || 0} 个节点
                                </div>
                                <button
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg flex items-center gap-2 transition-colors"
                                    onClick={() => {
                                        const selectedNodes = nodes.filter(n => contextMenuTarget.ids?.includes(n.id));
                                        if (selectedNodes.length > 0) {
                                            saveHistory();
                                            const minX = Math.min(...selectedNodes.map(n => n.x));
                                            const minY = Math.min(...selectedNodes.map(n => n.y));
                                            const maxX = Math.max(...selectedNodes.map(n => n.x + (n.width || 420)));
                                            const maxY = Math.max(...selectedNodes.map(n => n.y + (n.height || 320)));
                                            setGroups(prev => [...prev, {
                                                id: `g-${Date.now()}`,
                                                title: '新建分组',
                                                x: minX - 32,
                                                y: minY - 32,
                                                width: (maxX - minX) + 64,
                                                height: (maxY - minY) + 64,
                                                hasOutputPort: true,
                                                nodeIds: selectedNodes.map(n => n.id)
                                            }]);
                                        }
                                        setContextMenu(null);
                                    }}
                                >
                                    <LayoutTemplate size={12} /> 新建分组
                                </button>
                                <button
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors"
                                    onClick={() => {
                                        if (contextMenuTarget.ids) {
                                            deleteNodes(contextMenuTarget.ids);
                                        }
                                        setContextMenu(null);
                                    }}
                                >
                                    <Trash2 size={12} /> 删除选中节点
                                </button>
                            </>
                        )}
                    </div>
                )}

                {croppingNodeId && (imageToCrop || videoToCrop) && <ImageCropper imageSrc={imageToCrop || undefined} videoSrc={videoToCrop || undefined} onCancel={() => { setCroppingNodeId(null); setImageToCrop(null); setVideoToCrop(null); }} onConfirm={(b) => { handleNodeUpdate(croppingNodeId, { croppedFrame: b }); setCroppingNodeId(null); setImageToCrop(null); setVideoToCrop(null); }} />}
                <ExpandedView media={expandedMedia} onClose={() => setExpandedMedia(null)} />
                {editingImage && (
                    <ImageEditOverlay
                        imageSrc={editingImage.src}
                        originalImage={editingImage.originalImage}
                        canvasData={editingImage.canvasData}
                        nodeId={editingImage.nodeId}
                        onClose={() => setEditingImage(null)}
                        onSave={(nodeId, compositeImage, originalImage, canvasData) => {
                            handleNodeUpdate(nodeId, { image: compositeImage, originalImage, canvasData });
                            setEditingImage(null);
                        }}
                    />
                )}
                <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

                <SidebarDock
                    onAddNode={addNode}
                    isChatOpen={isChatOpen}
                    onToggleChat={() => setIsChatOpen(!isChatOpen)}
                    assetHistory={assetHistory}
                    onHistoryItemClick={(item) => { const type = item.type.includes('image') ? NodeType.IMAGE_GENERATOR : NodeType.VIDEO_GENERATOR; const data = item.type === 'image' ? { image: item.src } : { videoUri: item.src }; addNode(type, undefined, undefined, data); }}
                    onDeleteAsset={(id) => setAssetHistory(prev => prev.filter(a => a.id !== id))}
                    canvases={canvases}
                    currentCanvasId={currentCanvasId}
                    onNewCanvas={createNewCanvas}
                    onSelectCanvas={selectCanvas}
                    onDeleteCanvas={deleteCanvas}
                    onRenameCanvas={renameCanvas}
                    theme={theme}
                    onSetTheme={setTheme}
                />

                <AssistantPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

                {/* 底部工具栏：撤销/重做 + 缩放控制 */}
                <div className="absolute bottom-8 right-8 flex items-center gap-1 px-2 py-1.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl border border-slate-300 dark:border-slate-600 rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* 撤销/重做 */}
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 disabled:hover:bg-transparent"
                        title="撤销 (⌘Z)"
                    >
                        <Undo2 size={16} strokeWidth={2} />
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 disabled:hover:bg-transparent"
                        title="重做 (⌘⇧Z)"
                    >
                        <Redo2 size={16} strokeWidth={2} />
                    </button>

                    {/* 分隔线 */}
                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

                    {/* 缩放控制 */}
                    <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
                        <Minus size={14} strokeWidth={2.5} />
                    </button>
                    <span
                        className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 w-10 text-center tabular-nums cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 select-none"
                        onClick={() => setScale(1)}
                        title="重置缩放"
                    >
                        {Math.round(scale * 100)}%
                    </span>
                    <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
                        <Plus size={14} strokeWidth={2.5} />
                    </button>

                    {/* 分隔线 */}
                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

                    {/* 适配视图 */}
                    <button onClick={handleFitView} className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700" title="适配视图">
                        <Scan size={14} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </div>
    );
};
