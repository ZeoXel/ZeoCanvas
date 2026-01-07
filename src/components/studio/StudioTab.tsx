"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Node } from './Node';
import { SidebarDock } from './SidebarDock';
import { AssistantPanel } from './AssistantPanel';
import { ImageCropper } from './ImageCropper';
import { SketchEditor } from './SketchEditor';
import { SmartSequenceDock } from './SmartSequenceDock';
import { SettingsModal } from './SettingsModal';
import { AppNode, NodeType, NodeStatus, Connection, ContextMenuState, Group, Workflow, SmartSequenceItem, Canvas } from '@/types';
import { generateImageFromText, generateVideo, analyzeVideo, editImageWithText, planStoryboard, orchestrateVideoPrompt, compileMultiFramePrompt, urlToBase64, extractLastFrame, generateAudio } from '@/services/geminiService';
import { getGenerationStrategy } from '@/services/videoStrategies';
import { createMusicCustom, SunoSongInfo } from '@/services/sunoService';
import { synthesizeSpeech, MinimaxGenerateParams } from '@/services/minimaxService';
import { saveToStorage, loadFromStorage } from '@/services/storage';
import { 
    Plus, Copy, Trash2, Type, Image as ImageIcon, Video as VideoIcon, 
    ScanFace, Brush, MousePointerClick, LayoutTemplate, X, Film, Link, RefreshCw, Upload,
    Minus, FolderHeart, Unplug, Sparkles, ChevronLeft, ChevronRight, Scan, Music, Mic2
} from 'lucide-react';

// Apple Physics Curve
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const SNAP_THRESHOLD = 8; // Pixels for magnetic snap
const COLLISION_PADDING = 24; // Spacing when nodes bounce off each other

// Helper to get image dimensions
const getImageDimensions = (src: string): Promise<{width: number, height: number}> => {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve({width: img.width, height: img.height});
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
        <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500 ease-[${SPRING}] ${visible ? 'bg-white/95 backdrop-blur-xl' : 'bg-transparent pointer-events-none opacity-0'}`} onClick={handleClose}>
             <div className={`relative w-full h-full flex items-center justify-center p-8 transition-all duration-500 ease-[${SPRING}] ${visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`} onClick={e => e.stopPropagation()}>
                
                {hasMultiple && (
                    <button 
                        onClick={handlePrev}
                        className="absolute left-4 md:left-8 p-3 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 shadow-md transition-all hover:scale-110 z-[110]"
                    >
                        <ChevronLeft size={32} />
                    </button>
                )}

                <div className="relative max-w-full max-h-full flex flex-col items-center">
                    {!isVideo ? (
                        <img 
                            key={currentSrc} 
                            src={currentSrc} 
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in fade-in duration-300 bg-white" 
                            draggable={false} 
                        />
                    ) : (
                        <video 
                            key={currentSrc} 
                            src={currentSrc} 
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in fade-in duration-300 bg-white" 
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
                            {media.images.map((_:any, i:number) => (
                                <div 
                                    key={i} 
                                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }} 
                                    className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${i === currentIndex ? 'bg-cyan-500 scale-125' : 'bg-white/30 hover:bg-slate-500'}`} 
                                />
                            ))}
                        </div>
                    )}
                </div>

                {hasMultiple && (
                    <button 
                        onClick={handleNext}
                        className="absolute right-4 md:right-8 p-3 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 shadow-md transition-all hover:scale-110 z-[110]"
                    >
                        <ChevronRight size={32} />
                    </button>
                )}

             </div>
             <button onClick={handleClose} className="absolute top-6 right-6 p-3 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 shadow-md transition-colors z-[110]"><X size={24} /></button>
        </div>
    );
};

export default function StudioTab() {
  // --- Global App State ---
  const [workflows, setWorkflows] = useState<Workflow[]>([]); 
  const [assetHistory, setAssetHistory] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false); 
  
  // Sketch Editor State
  const [isSketchEditorOpen, setIsSketchEditorOpen] = useState(false);

  // Multi-Frame Dock State
  const [isMultiFrameOpen, setIsMultiFrameOpen] = useState(false);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Canvas Management State
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(null);

  // --- Canvas State ---
  const [nodes, setNodes] = useState<AppNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [clipboard, setClipboard] = useState<AppNode | null>(null); 
  
  // History
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Viewport
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Interaction / Selection
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]); // Changed to Array for multi-select
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingNodeParentGroupId, setDraggingNodeParentGroupId] = useState<string | null>(null);
  const [draggingGroup, setDraggingGroup] = useState<any>(null);
  const [resizingGroupId, setResizingGroupId] = useState<string | null>(null);
  const [activeGroupNodeIds, setActiveGroupNodeIds] = useState<string[]>([]);
  // Connection start stores both the node id and the actual screen position of the port
  const [connectionStart, setConnectionStart] = useState<{
    id: string,
    portType: 'input' | 'output',
    // Screen coordinates of the port center (for converting to canvas coords)
    screenX: number,
    screenY: number
  } | null>(null);
  const [selectionRect, setSelectionRect] = useState<any>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false); // Track space key for canvas drag
  
  // Node Resizing
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [initialSize, setInitialSize] = useState<{width: number, height: number} | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState<{x: number, y: number} | null>(null);

  // Context Menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<any>(null);

  // Media Overlays
  const [expandedMedia, setExpandedMedia] = useState<any>(null);
  const [croppingNodeId, setCroppingNodeId] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  // Refs for closures
  const nodesRef = useRef(nodes);
  const connectionsRef = useRef(connections);
  const groupsRef = useRef(groups);
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  const connectionStartRef = useRef(connectionStart);
  const rafRef = useRef<number | null>(null); // For RAF Throttling
  const canvasContainerRef = useRef<HTMLDivElement>(null); // Canvas container ref for coordinate offset
  
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
      otherSelectedNodes?: { id: string, startX: number, startY: number }[]
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
      childNodes: {id: string, startX: number, startY: number}[]
  } | null>(null);

  // Helper to get mouse position relative to canvas container (accounting for Navbar offset)
  const getCanvasMousePos = useCallback((clientX: number, clientY: number) => {
      if (!canvasContainerRef.current) return { x: clientX, y: clientY };
      const rect = canvasContainerRef.current.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  useEffect(() => {
      nodesRef.current = nodes; connectionsRef.current = connections; groupsRef.current = groups;
      historyRef.current = history; historyIndexRef.current = historyIndex; connectionStartRef.current = connectionStart;
  }, [nodes, connections, groups, history, historyIndex, connectionStart]);

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
      if (['PROMPT_INPUT', 'VIDEO_ANALYZER', 'IMAGE_EDITOR'].includes(node.type)) return 360;
      if (node.type === NodeType.AUDIO_GENERATOR) return 200;
      const [w, h] = (node.data.aspectRatio || '16:9').split(':').map(Number);
      const extra = (node.type === NodeType.VIDEO_GENERATOR && node.data.generationMode === 'CUT') ? 36 : 0;
      return ((width * h / w) + extra);
  };
  
  const getNodeBounds = (node: AppNode) => {
      const h = node.height || getApproxNodeHeight(node);
      const w = node.width || 420;
      return { x: node.x, y: node.y, width: w, height: h, r: node.x + w, b: node.y + h };
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
      switch(t) {
          case NodeType.PROMPT_INPUT: return '创意描述';
          case NodeType.IMAGE_GENERATOR: return '图片生成';
          case NodeType.VIDEO_GENERATOR: return '视频生成';
          case NodeType.VIDEO_FACTORY: return '视频工厂';
          case NodeType.AUDIO_GENERATOR: return '灵感音乐';
          case NodeType.VIDEO_ANALYZER: return '视频分析';
          case NodeType.IMAGE_EDITOR: return '图像编辑';
          default: return t;
      }
  };
  const getNodeIcon = (t: string) => {
      switch(t) {
          case NodeType.PROMPT_INPUT: return Type;
          case NodeType.IMAGE_GENERATOR: return ImageIcon;
          case NodeType.VIDEO_GENERATOR: return Film;
          case NodeType.VIDEO_FACTORY: return VideoIcon;
          case NodeType.AUDIO_GENERATOR: return Mic2;
          case NodeType.VIDEO_ANALYZER: return ScanFace;
          case NodeType.IMAGE_EDITOR: return Brush;
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

  const saveHistory = useCallback(() => {
      try {
          const currentStep = { nodes: JSON.parse(JSON.stringify(nodesRef.current)), connections: JSON.parse(JSON.stringify(connectionsRef.current)), groups: JSON.parse(JSON.stringify(groupsRef.current)) };
          const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
          newHistory.push(currentStep); if (newHistory.length > 50) newHistory.shift(); 
          setHistory(newHistory); setHistoryIndex(newHistory.length - 1);
      } catch (e) {
          console.warn("History save failed:", e);
      }
  }, []);

  const undo = useCallback(() => {
      const idx = historyIndexRef.current; if (idx > 0) { const prev = historyRef.current[idx - 1]; setNodes(prev.nodes); setConnections(prev.connections); setGroups(prev.groups); setHistoryIndex(idx - 1); }
  }, []);

  const deleteNodes = useCallback((ids: string[]) => { 
      if (ids.length === 0) return;
      saveHistory(); 
      setNodes(p => p.filter(n => !ids.includes(n.id)).map(n => ({...n, inputs: n.inputs.filter(i => !ids.includes(i))}))); 
      setConnections(p => p.filter(c => !ids.includes(c.from) && !ids.includes(c.to))); 
      setSelectedNodeIds([]); 
  }, [saveHistory]);

  const addNode = useCallback((type: NodeType, x?: number, y?: number, initialData?: any) => {
      if (type === NodeType.IMAGE_EDITOR) {
          setIsSketchEditorOpen(true);
          return;
      }

      try { saveHistory(); } catch (e) { }

      // 确定音频节点的默认模式和模型
      const defaultAudioMode = initialData?.audioMode || 'music';
      const defaultAudioModel = defaultAudioMode === 'music' ? 'suno-v4' : 'speech-2.6-hd';

      const defaults: any = {
          model: type === NodeType.VIDEO_GENERATOR ? 'veo3.1' :
                 type === NodeType.VIDEO_ANALYZER ? 'gemini-2.5-flash' :
                 type === NodeType.AUDIO_GENERATOR ? defaultAudioModel :
                 type.includes('IMAGE') ? 'nano-banana' :
                 'gemini-2.5-flash',
          generationMode: type === NodeType.VIDEO_GENERATOR ? 'DEFAULT' : undefined,
          // 音频节点默认配置
          audioMode: type === NodeType.AUDIO_GENERATOR ? defaultAudioMode : undefined,
          musicConfig: type === NodeType.AUDIO_GENERATOR ? { mv: 'chirp-v4', tags: 'pop, catchy' } : undefined,
          voiceConfig: type === NodeType.AUDIO_GENERATOR ? { voiceId: 'female-shaonv', speed: 1, emotion: 'calm' } : undefined,
          ...initialData
      };
      
      const typeMap: Record<string, string> = {
          [NodeType.PROMPT_INPUT]: '创意描述',
          [NodeType.IMAGE_GENERATOR]: '图片生成',
          [NodeType.VIDEO_GENERATOR]: '视频生成',
          [NodeType.VIDEO_FACTORY]: '视频工厂',
          [NodeType.AUDIO_GENERATOR]: '灵感音乐',
          [NodeType.VIDEO_ANALYZER]: '视频分析',
          [NodeType.IMAGE_EDITOR]: '图像编辑'
      };

      const baseX = x !== undefined ? x : (-pan.x + window.innerWidth/2)/scale - 210;
      const baseY = y !== undefined ? y : (-pan.y + window.innerHeight/2)/scale - 180;
      const safeBaseX = isNaN(baseX) ? 100 : baseX;
      const safeBaseY = isNaN(baseY) ? 100 : baseY;

      // 计算节点预估高度并找到不重叠的位置
      const nodeWidth = 420;
      const [rw, rh] = (defaults.aspectRatio || '16:9').split(':').map(Number);
      const nodeHeight = type === NodeType.PROMPT_INPUT || type === NodeType.VIDEO_ANALYZER ? 360 :
                         type === NodeType.AUDIO_GENERATOR ? 200 :
                         (nodeWidth * rh / rw);

      const { x: finalX, y: finalY } = findNonOverlappingPosition(safeBaseX, safeBaseY, nodeWidth, nodeHeight, nodesRef.current, 'down');

      const newNode: AppNode = {
        id: `n-${Date.now()}-${Math.floor(Math.random()*1000)}`,
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
  
  const handleSketchResult = (type: 'image' | 'video', result: string, prompt: string) => {
      const centerX = (-pan.x + window.innerWidth/2)/scale - 210;
      const centerY = (-pan.y + window.innerHeight/2)/scale - 180;
      
      if (type === 'image') {
          addNode(NodeType.IMAGE_GENERATOR, centerX, centerY, { image: result, prompt, status: NodeStatus.SUCCESS });
      } else {
          addNode(NodeType.VIDEO_GENERATOR, centerX, centerY, { videoUri: result, prompt, status: NodeStatus.SUCCESS });
      }
      
      handleAssetGenerated(type, result, prompt || 'Sketch Output');
  };

  const handleMultiFrameGenerate = async (frames: SmartSequenceItem[]): Promise<string> => {
      const complexPrompt = compileMultiFramePrompt(frames as any[]);

      try {
          // 使用 veo3.1-components 支持多图参考
          const res = await generateVideo(
              complexPrompt,
              'veo3.1-components',
              { aspectRatio: '16:9', count: 1 },
              frames[0].src,
              null,
              frames.length > 1 ? frames.map(f => f.src) : undefined
          );
          
          if (res.isFallbackImage) {
              handleAssetGenerated('image', res.uri, 'Smart Sequence Preview (Fallback)');
          } else {
              handleAssetGenerated('video', res.uri, 'Smart Sequence');
          }
          return res.uri;
      } catch (e: any) {
          throw new Error(e.message || "Smart Sequence Generation Failed");
      }
  };


  const handleWheel = useCallback((e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = canvasContainerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const newScale = Math.min(Math.max(0.2, scale - e.deltaY * 0.001), 3);
        const x = e.clientX - rect.left; const y = e.clientY - rect.top;
        const scaleDiff = newScale - scale;
        setPan(p => ({ x: p.x - (x - p.x) * (scaleDiff / scale), y: p.y - (y - p.y) * (scaleDiff / scale) }));
        setScale(newScale);
      } else {
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
  }, [scale]);

  // 使用原生事件监听器以支持 preventDefault（非 passive 模式）
  useEffect(() => {
      const el = canvasContainerRef.current;
      if (!el) return;
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (contextMenu) setContextMenu(null); setSelectedGroupId(null);
      // 点击画布空白区域时，让当前聚焦的输入框失去焦点
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

      // Space + Left Click = Canvas Drag (like middle mouse or shift+click)
      if (e.button === 0 && isSpacePressed) {
          e.preventDefault();
          setIsDraggingCanvas(true);
          setLastMousePos({ x: e.clientX, y: e.clientY });
          return;
      }

      if (e.button === 0 && !e.shiftKey) {
          if (e.detail > 1) { e.preventDefault(); return; }
          e.preventDefault(); // 防止拖拽选中文本
          setSelectedNodeIds([]);
          // Use canvas-relative coordinates for selection rect
          const canvasPos = getCanvasMousePos(e.clientX, e.clientY);
          setSelectionRect({ startX: canvasPos.x, startY: canvasPos.y, currentX: canvasPos.x, currentY: canvasPos.y });
      }
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) { e.preventDefault(); setIsDraggingCanvas(true); setLastMousePos({ x: e.clientX, y: e.clientY }); }
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

          if (selectionRect) {
              setSelectionRect((prev:any) => prev ? ({ ...prev, currentX: canvasX, currentY: canvasY }) : null);
              // Don't return - allow mousePos update for connection preview
              if (!connectionStartRef.current) return;
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

          if (isDraggingCanvas) { 
              const dx = clientX - lastMousePos.x; 
              const dy = clientY - lastMousePos.y; 
              setPan(p => ({ x: p.x + dx, y: p.y + dy })); 
              setLastMousePos({ x: clientX, y: clientY }); 
          }
          
          if (draggingNodeId && dragNodeRef.current && dragNodeRef.current.id === draggingNodeId) {
             const { startX, startY, mouseStartX, mouseStartY, nodeWidth, nodeHeight, otherSelectedNodes } = dragNodeRef.current;
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
                     else if (Math.abs(myC - (otherBounds.x+otherBounds.width/2)) < SNAP) { proposedX = (otherBounds.x+otherBounds.width/2) - nodeWidth/2; snappedX = true; }
                 }
                 if (!snappedY) {
                     if (Math.abs(myT - otherBounds.y) < SNAP) { proposedY = otherBounds.y; snappedY = true; }
                     else if (Math.abs(myT - otherBounds.b) < SNAP) { proposedY = otherBounds.b; snappedY = true; }
                     else if (Math.abs(myB - otherBounds.y) < SNAP) { proposedY = otherBounds.y - nodeHeight; snappedY = true; }
                     else if (Math.abs(myB - otherBounds.b) < SNAP) { proposedY = otherBounds.b - nodeHeight; snappedY = true; }
                     else if (Math.abs(myM - (otherBounds.y+otherBounds.height/2)) < SNAP) { proposedY = (otherBounds.y+otherBounds.height/2) - nodeHeight/2; snappedY = true; }
                 }
             });

             // 计算实际位移（考虑吸附后的调整）
             const actualDx = proposedX - startX;
             const actualDy = proposedY - startY;

             // 同时移动主节点和其他选中节点
             setNodes(prev => prev.map(n => {
                 if (n.id === draggingNodeId) {
                     return { ...n, x: proposedX, y: proposedY };
                 }
                 // 移动其他选中的节点
                 const otherNode = otherSelectedNodes?.find(on => on.id === n.id);
                 if (otherNode) {
                     return { ...n, x: otherNode.startX + actualDx, y: otherNode.startY + actualDy };
                 }
                 return n;
             }));

          } else if (draggingNodeId) {
              const dx = (clientX - lastMousePos.x) / scale;
              const dy = (clientY - lastMousePos.y) / scale;
              setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: n.x + dx, y: n.y + dy } : n));
              setLastMousePos({ x: clientX, y: clientY });
          }
          
          if (resizingNodeId && initialSize && resizeStartPos) {
              const dx = (clientX - resizeStartPos.x) / scale; const dy = (clientY - resizeStartPos.y) / scale;
              setNodes(prev => prev.map(n => n.id === resizingNodeId ? { ...n, width: Math.max(360, initialSize.width + dx), height: Math.max(240, initialSize.height + dy) } : n));
          }
      });
  }, [selectionRect, isDraggingCanvas, draggingNodeId, resizingNodeId, initialSize, resizeStartPos, scale, lastMousePos]);

  const handleGlobalMouseUp = useCallback(() => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (selectionRect) {
          const x = Math.min(selectionRect.startX, selectionRect.currentX);
          const y = Math.min(selectionRect.startY, selectionRect.currentY);
          const w = Math.abs(selectionRect.currentX - selectionRect.startX);
          const h = Math.abs(selectionRect.currentY - selectionRect.startY);
          if (w > 10 && h > 10) {
              const rect = { x: (x - pan.x) / scale, y: (y - pan.y) / scale, w: w / scale, h: h / scale };
              // 选中框选区域内的节点（以节点中心判断）
              const enclosed = nodesRef.current.filter(n => {
                  const cx = n.x + (n.width || 420) / 2;
                  const cy = n.y + 160;
                  return cx > rect.x && cx < rect.x + rect.w && cy > rect.y && cy < rect.y + rect.h;
              });
              // 只选中节点，不自动创建分组
              if (enclosed.length > 0) {
                  setSelectedNodeIds(enclosed.map(n => n.id));
              } else {
                  setSelectedNodeIds([]);
              }
          }
          setSelectionRect(null);
      }
      
      // Collision logic for dropped node
      if (draggingNodeId) {
          const draggedNode = nodesRef.current.find(n => n.id === draggingNodeId);
          if (draggedNode) {
              const myBounds = getNodeBounds(draggedNode);
              const otherNodes = nodesRef.current.filter(n => n.id !== draggingNodeId);
              
              // Simple Iterative Solver for Collision
              // We check against all nodes. If we collide, we move out the shortest distance.
              // To handle multiple collisions, a physics engine iterates this, but for UI, one pass usually suffices 
              // or we check the 'closest' collision. Here we iterate all to clear overlaps.
              
              for (const other of otherNodes) {
                  const otherBounds = getNodeBounds(other);
                  
                  // AABB Collision Check
                  const isOverlapping = (
                      myBounds.x < otherBounds.r && 
                      myBounds.r > otherBounds.x &&
                      myBounds.y < otherBounds.b && 
                      myBounds.b > otherBounds.y
                  );

                  if (isOverlapping) {
                       // Calculate overlap amounts on all 4 sides
                       const overlapLeft = myBounds.r - otherBounds.x;
                       const overlapRight = otherBounds.r - myBounds.x;
                       const overlapTop = myBounds.b - otherBounds.y;
                       const overlapBottom = otherBounds.b - myBounds.y;

                       // Find the smallest overlap (shortest path to separate)
                       const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                       if (minOverlap === overlapLeft) {
                           draggedNode.x = otherBounds.x - myBounds.width - COLLISION_PADDING;
                       } else if (minOverlap === overlapRight) {
                           draggedNode.x = otherBounds.r + COLLISION_PADDING;
                       } else if (minOverlap === overlapTop) {
                           draggedNode.y = otherBounds.y - myBounds.height - COLLISION_PADDING;
                       } else if (minOverlap === overlapBottom) {
                           draggedNode.y = otherBounds.b + COLLISION_PADDING;
                       }

                       // Update temporary bounds for next iteration in loop
                       myBounds.x = draggedNode.x;
                       myBounds.y = draggedNode.y;
                       myBounds.r = draggedNode.x + myBounds.width;
                       myBounds.b = draggedNode.y + myBounds.height;
                  }
              }

              // Update State
              setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: draggedNode.x, y: draggedNode.y } : n));
          }
      }

      if (draggingNodeId || resizingNodeId || dragGroupRef.current) saveHistory();
      setIsDraggingCanvas(false); setDraggingNodeId(null); setDraggingNodeParentGroupId(null); setDraggingGroup(null); setResizingGroupId(null); setActiveGroupNodeIds([]); setResizingNodeId(null); setInitialSize(null); setResizeStartPos(null); setConnectionStart(null);
      dragNodeRef.current = null; resizeContextRef.current = null; dragGroupRef.current = null;
  }, [selectionRect, pan, scale, saveHistory, draggingNodeId, resizingNodeId]);

  useEffect(() => { window.addEventListener('mousemove', handleGlobalMouseMove); window.addEventListener('mouseup', handleGlobalMouseUp); return () => { window.removeEventListener('mousemove', handleGlobalMouseMove); window.removeEventListener('mouseup', handleGlobalMouseUp); }; }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  const handleNodeUpdate = useCallback((id: string, data: any, size?: any, title?: string) => {
      setNodes(prev => prev.map(n => {
          if (n.id === id) {
              const updated = { ...n, data: { ...n.data, ...data }, title: title || n.title };
              if (size) { if (size.width) updated.width = size.width; if (size.height) updated.height = size.height; }
              
              if (data.image) handleAssetGenerated('image', data.image, updated.title);
              if (data.videoUri) handleAssetGenerated('video', data.videoUri, updated.title);
              if (data.audioUri) handleAssetGenerated('audio', data.audioUri, updated.title);

              return updated;
          }
          return n;
      }));
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
              if (n?.type === NodeType.VIDEO_ANALYZER) return n.data.analysis;
              return null;
          }).filter(t => t && t.trim().length > 0) as string[];

          let prompt = promptOverride || node.data.prompt || '';
          if (upstreamTexts.length > 0) {
              const combinedUpstream = upstreamTexts.join('\n');
              prompt = prompt ? `${combinedUpstream}\n${prompt}` : combinedUpstream;
          }

          // 创意描述节点：调用 LLM 生成/优化提示词
          if (node.type === NodeType.PROMPT_INPUT) {
              const userInput = promptOverride || node.data.prompt || '';
              if (!userInput.trim()) {
                  throw new Error("请输入您的创意想法");
              }

              try {
                  const response = await fetch('/api/studio/chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          messages: [{ role: 'user', text: userInput }],
                          mode: 'prompt_generator'
                      })
                  });

                  if (!response.ok) {
                      const error = await response.json().catch(() => ({}));
                      throw new Error(error.error || `API错误: ${response.status}`);
                  }

                  const result = await response.json();
                  const generatedPrompt = result.message || '';

                  // 将生成的提示词保存到节点
                  handleNodeUpdate(id, { prompt: generatedPrompt });
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                  return; // 提前返回，不执行后续逻辑
              } catch (e: any) {
                  handleNodeUpdate(id, { error: e.message });
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR } : n));
                  return;
              }
          }

          if (node.type === NodeType.IMAGE_GENERATOR) {
               const inputImages: string[] = [];
               // 收集上游连接节点的图片
               inputs.forEach(n => { if (n?.data.image) inputImages.push(n.data.image); });
               // 如果节点自身有图片（用户上传的参考图或之前的生成结果），也作为参考
               if (node.data.image && !inputImages.includes(node.data.image)) {
                   inputImages.unshift(node.data.image); // 优先放在最前面
               }

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
                          
                          storyboard.forEach((shotPrompt, index) => {
                              const col = index % COLUMNS;
                              const row = Math.floor(index / COLUMNS);
                              const posX = startX + col * (childWidth + gapX);
                              const posY = startY + row * (childHeight + gapY);
                              const newNodeId = `n-${Date.now()}-${index}`;
                              newNodes.push({
                                  id: newNodeId, type: NodeType.IMAGE_GENERATOR, x: posX, y: posY, width: childWidth, height: childHeight,
                                  title: `分镜 ${index + 1}`, status: NodeStatus.WORKING,
                                  data: { ...node.data, aspectRatio: ratio, prompt: shotPrompt, image: undefined, images: undefined, imageCount: 1 },
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
                                   handleNodeUpdate(n.id, { image: res[0], images: res, status: NodeStatus.SUCCESS });
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
              // 判断是否需要批量生产（创建新节点）
              // 条件：有参考图（图生图）OR 原节点已有生成结果（文生图二次点击）
              const hasReferenceImage = !!node.data.image;
              const hasExistingResult = hasReferenceImage || (node.data.images && node.data.images.length > 0);
              let newNodeId: string | null = null;

              if (hasExistingResult) {
                  // 批量生产模式：检查是否已有自动连接的下游节点
                  newNodeId = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                  const nodeWidth = node.width || 420;
                  const [rw, rh] = (node.data.aspectRatio || '16:9').split(':').map(Number);
                  const nodeHeight = node.height || (nodeWidth * rh / rw);

                  // 查找当前节点已有的自动连接下游节点
                  const existingAutoConns = connectionsRef.current.filter(c => c.from === id && c.isAuto);
                  const firstAutoChildId = existingAutoConns.length > 0 ? existingAutoConns[0].to : null;
                  const firstAutoChild = firstAutoChildId ? nodesRef.current.find(n => n.id === firstAutoChildId) : null;

                  let newX: number, newY: number;
                  if (!firstAutoChild) {
                      // 第一次批量生产：向右排布
                      const startX = node.x + nodeWidth + 80;
                      ({ x: newX, y: newY } = findNonOverlappingPosition(startX, node.y, nodeWidth, nodeHeight, nodesRef.current, 'right'));
                  } else {
                      // 后续批量生产：在第一个结果节点上方排布（间距为0）
                      const startY = firstAutoChild.y - nodeHeight;
                      ({ x: newX, y: newY } = findNonOverlappingPosition(firstAutoChild.x, startY, nodeWidth, nodeHeight, nodesRef.current, 'up'));
                  }

                  const newNode: AppNode = {
                      id: newNodeId,
                      type: NodeType.IMAGE_GENERATOR,
                      x: newX,
                      y: newY,
                      width: nodeWidth,
                      height: nodeHeight,
                      title: hasReferenceImage ? '编辑结果' : '生成结果',
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
                  const res = await generateImageFromText(prompt, node.data.model || 'nano-banana', inputImages, { aspectRatio: node.data.aspectRatio || '16:9', resolution: node.data.resolution, count: node.data.imageCount });

                  if (hasExistingResult && newNodeId) {
                      // 更新新节点为成功并填入结果
                      handleNodeUpdate(newNodeId, { image: res[0], images: res });
                      setNodes(p => p.map(n => n.id === newNodeId ? { ...n, status: NodeStatus.SUCCESS } : n));
                  } else {
                      // 首次文生图：结果在原节点显示
                      handleNodeUpdate(id, { image: res[0], images: res });
                  }
              } catch (imgErr: any) {
                  if (hasExistingResult && newNodeId) {
                      // 新节点显示错误
                      handleNodeUpdate(newNodeId, { error: imgErr.message });
                      setNodes(p => p.map(n => n.id === newNodeId ? { ...n, status: NodeStatus.ERROR } : n));
                  } else {
                      throw imgErr; // 抛给外层 catch 处理
                  }
              }

          } else if (node.type === NodeType.VIDEO_GENERATOR) {
              // 预创建 VIDEO_FACTORY 节点显示加载态
              const factoryNodeId = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              const nodeWidth = node.width || 420;
              const [rw, rh] = (node.data.aspectRatio || '16:9').split(':').map(Number);
              const nodeHeight = node.height || (nodeWidth * rh / rw);

              // 查找当前节点已有的自动连接下游节点
              const existingAutoConns = connectionsRef.current.filter(c => c.from === id && c.isAuto);
              const firstAutoChildId = existingAutoConns.length > 0 ? existingAutoConns[0].to : null;
              const firstAutoChild = firstAutoChildId ? nodesRef.current.find(n => n.id === firstAutoChildId) : null;

              let newX: number, newY: number;
              if (!firstAutoChild) {
                  // 第一次批量生产：向右排布
                  const startX = node.x + nodeWidth + 80;
                  ({ x: newX, y: newY } = findNonOverlappingPosition(startX, node.y, nodeWidth, nodeHeight, nodesRef.current, 'right'));
              } else {
                  // 后续批量生产：在第一个结果节点上方排布
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
                      image: node.data.image, // 保留输入图片作为封面
                  },
                  inputs: [], // 自动连接不传递上游参数
              };
              setNodes(prev => [...prev, factoryNode]);
              setConnections(prev => [...prev, { from: id, to: factoryNodeId, isAuto: true }]);
              // 原节点状态设为成功
              setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));

              try {
                  const strategy = await getGenerationStrategy(node, inputs, prompt);

                  const res = await generateVideo(
                      strategy.finalPrompt,
                      node.data.model || 'veo3.1',
                      {
                          aspectRatio: node.data.aspectRatio || '16:9',
                          count: node.data.videoCount || 1,
                          generationMode: strategy.generationMode,
                          resolution: node.data.resolution
                      },
                      strategy.inputImageForGeneration,
                      strategy.videoInput,
                      strategy.referenceImages
                  );

                  if (res.isFallbackImage) {
                      handleNodeUpdate(factoryNodeId, {
                          image: res.uri,
                          videoUri: undefined,
                          error: "Region restricted: Generated preview image instead."
                      });
                  } else {
                      handleNodeUpdate(factoryNodeId, { videoUri: res.uri, videoMetadata: res.videoMetadata, videoUris: res.uris });
                  }
                  setNodes(p => p.map(n => n.id === factoryNodeId ? { ...n, status: NodeStatus.SUCCESS } : n));
              } catch (videoErr: any) {
                  handleNodeUpdate(factoryNodeId, { error: videoErr.message });
                  setNodes(p => p.map(n => n.id === factoryNodeId ? { ...n, status: NodeStatus.ERROR } : n));
              }

          } else if (node.type === NodeType.VIDEO_FACTORY) {
              // VIDEO_FACTORY 节点：基于现有视频继续生成/编辑
              const newFactoryNodeId = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              const nodeWidth = node.width || 420;
              const [rw, rh] = (node.data.aspectRatio || '16:9').split(':').map(Number);
              const nodeHeight = node.height || (nodeWidth * rh / rw);

              // 查找当前节点已有的自动连接下游节点
              const existingAutoConns = connectionsRef.current.filter(c => c.from === id && c.isAuto);
              const firstAutoChildId = existingAutoConns.length > 0 ? existingAutoConns[0].to : null;
              const firstAutoChild = firstAutoChildId ? nodesRef.current.find(n => n.id === firstAutoChildId) : null;

              let newX: number, newY: number;
              if (!firstAutoChild) {
                  // 第一次批量生产：向右排布
                  const startX = node.x + nodeWidth + 80;
                  ({ x: newX, y: newY } = findNonOverlappingPosition(startX, node.y, nodeWidth, nodeHeight, nodesRef.current, 'right'));
              } else {
                  // 后续批量生产：在第一个结果节点上方排布
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
                  inputs: [], // 自动连接不传递上游参数
              };
              setNodes(prev => [...prev, newFactoryNode]);
              setConnections(prev => [...prev, { from: id, to: newFactoryNodeId, isAuto: true }]);
              setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));

              try {
                  // 使用当前视频作为输入进行继续/编辑
                  let videoInput: string | undefined;
                  if (node.data.videoUri) {
                      videoInput = node.data.videoUri.startsWith('http')
                          ? await urlToBase64(node.data.videoUri)
                          : node.data.videoUri;
                  }

                  const strategy = await getGenerationStrategy(node, inputs, prompt);

                  const res = await generateVideo(
                      strategy.finalPrompt,
                      node.data.model || 'veo3.1',
                      {
                          aspectRatio: node.data.aspectRatio || '16:9',
                          count: node.data.videoCount || 1,
                          generationMode: strategy.generationMode,
                          resolution: node.data.resolution
                      },
                      strategy.inputImageForGeneration,
                      videoInput || strategy.videoInput,
                      strategy.referenceImages
                  );

                  if (res.isFallbackImage) {
                      handleNodeUpdate(newFactoryNodeId, {
                          image: res.uri,
                          videoUri: undefined,
                          error: "Region restricted: Generated preview image instead."
                      });
                  } else {
                      handleNodeUpdate(newFactoryNodeId, { videoUri: res.uri, videoMetadata: res.videoMetadata, videoUris: res.uris });
                  }
                  setNodes(p => p.map(n => n.id === newFactoryNodeId ? { ...n, status: NodeStatus.SUCCESS } : n));
              } catch (videoErr: any) {
                  handleNodeUpdate(newFactoryNodeId, { error: videoErr.message });
                  setNodes(p => p.map(n => n.id === newFactoryNodeId ? { ...n, status: NodeStatus.ERROR } : n));
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

          } else if (node.type === NodeType.VIDEO_ANALYZER) {
             const vid = node.data.videoUri || inputs.find(n => n?.data.videoUri)?.data.videoUri;
             if (!vid) throw new Error("未找到视频输入");
             let vidData = vid;
             if (vid.startsWith('http')) vidData = await urlToBase64(vid);
             const txt = await analyzeVideo(vidData, prompt, node.data.model || 'gemini-2.5-flash');
             handleNodeUpdate(id, { analysis: txt });
          } else if (node.type === NodeType.IMAGE_EDITOR) {
             const inputImages: string[] = [];
             inputs.forEach(n => { if (n?.data.image) inputImages.push(n.data.image); });
             const img = node.data.image || inputImages[0];
             const res = await editImageWithText(img, prompt, node.data.model || 'gemini-2.5-flash-image');
             handleNodeUpdate(id, { image: res });
          }
          setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
      } catch (e: any) {
          handleNodeUpdate(id, { error: e.message });
          setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR } : n));
      }
  }, [handleNodeUpdate]);

  
  const saveCurrentAsWorkflow = () => {
      const thumbnailNode = nodes.find(n => n.data.image);
      const thumbnail = thumbnailNode?.data.image || '';
      const newWf: Workflow = { id: `wf-${Date.now()}`, title: `工作流 ${new Date().toLocaleDateString()}`, thumbnail, nodes: JSON.parse(JSON.stringify(nodes)), connections: JSON.parse(JSON.stringify(connections)), groups: JSON.parse(JSON.stringify(groups)) };
      setWorkflows(prev => [newWf, ...prev]);
  };
  
  const saveGroupAsWorkflow = (groupId: string) => {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;
      const nodesInGroup = nodes.filter(n => { const w = n.width || 420; const h = n.height || getApproxNodeHeight(n); const cx = n.x + w/2; const cy = n.y + h/2; return cx > group.x && cx < group.x + group.width && cy > group.y && cy < group.y + group.height; });
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
        ? { ...c, nodes: JSON.parse(JSON.stringify(nodes)), connections: JSON.parse(JSON.stringify(connections)), groups: JSON.parse(JSON.stringify(groups)), updatedAt: now }
        : c
    ));
  }, [currentCanvasId, nodes, connections, groups]);

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
      updatedAt: now
    };

    setCanvases(prev => [newCanvas, ...prev]);
    setCurrentCanvasId(newCanvas.id);
    setNodes([]);
    setConnections([]);
    setGroups([]);
    setSelectedNodeIds([]);
    setSelectedGroupId(null);
  }, [currentCanvasId, nodes.length, canvases.length, saveCurrentCanvas]);

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
      setSelectedNodeIds([]);
      setSelectedGroupId(null);
    }
  }, [currentCanvasId, canvases, saveCurrentCanvas]);

  const deleteCanvas = useCallback((id: string) => {
    if (canvases.length <= 1) {
      // 如果只剩一个画布，不允许删除，而是清空它
      setNodes([]);
      setConnections([]);
      setGroups([]);
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
      }
      return newCanvases;
    });
    setSelectedNodeIds([]);
    setSelectedGroupId(null);
  }, [canvases, currentCanvasId]);

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
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelectedNodeIds(nodesRef.current.map(n => n.id)); return; }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') { const lastSelected = selectedNodeIds[selectedNodeIds.length - 1]; if (lastSelected) { const nodeToCopy = nodesRef.current.find(n => n.id === lastSelected); if (nodeToCopy) { e.preventDefault(); setClipboard(JSON.parse(JSON.stringify(nodeToCopy))); } } return; }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') { if (clipboard) { e.preventDefault(); saveHistory(); const newNode: AppNode = { ...clipboard, id: `n-${Date.now()}-${Math.floor(Math.random()*1000)}`, x: clipboard.x + 50, y: clipboard.y + 50, status: NodeStatus.IDLE, inputs: [] }; setNodes(prev => [...prev, newNode]); setSelectedNodeIds([newNode.id]); } return; }
        if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedGroupId) { saveHistory(); setGroups(prev => prev.filter(g => g.id !== selectedGroupId)); setSelectedGroupId(null); return; } if (selectedNodeIds.length > 0) { deleteNodes(selectedNodeIds); } }
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
  }, [selectedWorkflowId, selectedNodeIds, selectedGroupId, deleteNodes, undo, saveHistory, clipboard]);

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
              const width = Math.max(...wf.nodes.map(n => n.x + (n.width||420))) - minX;
              const height = Math.max(...wf.nodes.map(n => n.y + 320)) - minY;
              const offsetX = dropX - (minX + width/2);
              const offsetY = dropY - (minY + height/2);
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
    <div className="w-screen h-screen overflow-hidden bg-slate-50">
      <div
          ref={canvasContainerRef}
          className={`w-full h-full overflow-hidden text-slate-700 selection:bg-blue-200 ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-default'} ${(isDraggingCanvas || draggingNodeId || resizingNodeId || connectionStart || selectionRect || draggingGroup) ? 'select-none' : ''}`}
          onMouseDown={handleCanvasMouseDown}
          onDoubleClick={(e) => { e.preventDefault(); if (e.detail > 1 && !selectionRect) { setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: '' }); setContextMenuTarget({ type: 'create' }); } }}
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
          <div className="absolute inset-0 noise-bg" />
          <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #aaa 1px, transparent 1px)', backgroundSize: `${32 * scale}px ${32 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />

          <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-[${SPRING}] z-50 pointer-events-none ${nodes.length > 0 ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>
                <div className="flex flex-col items-center justify-center mb-10 select-none animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div className="relative flex flex-col items-center gap-4">
                        <div className="relative p-6 rounded-[32px] bg-white border border-slate-200 shadow-2xl">
                            <Image src="/logo.svg" alt="AgentPlatform Logo" width={96} height={96} priority className="w-24 h-24" />
                            <div className="absolute -inset-3 bg-gradient-to-r from-blue-200/30 via-cyan-200/30 to-purple-200/30 blur-[80px] opacity-80 pointer-events-none" />
                        </div>
                        <p className="text-4xl md:text-5xl font-bold tracking-tight text-slate-700 drop-shadow-sm">AgentPlatform Studio</p>
                        <span className="text-sm font-semibold tracking-[0.4em] text-slate-400 uppercase">AgentPlatform</span>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2 mb-6 text-slate-500 text-xs font-medium tracking-wide opacity-90">
                    <div className="px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-600 flex items-center gap-1">
                        <MousePointerClick size={12} className="text-blue-500" />
                        <span>双击画布开始创作</span>
                    </div>
                    <span>拖拽节点或载入工作流模板，快速搭建智能场景</span>
                </div>

                <div className={`flex items-center gap-1.5 p-1.5 rounded-[18px] bg-white/90 border border-slate-200 backdrop-blur-xl shadow-2xl ${nodes.length > 0 ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                    <button onClick={() => addNode(NodeType.IMAGE_GENERATOR)} className="flex items-center gap-2.5 px-5 py-3 rounded-[14px] bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all border border-slate-200 hover:border-slate-300 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300">
                        <ImageIcon size={16} className="text-slate-400 transition-colors group-hover:text-blue-600" />
                        <span className="text-[13px] font-medium tracking-wide">图片生成</span>
                    </button>

                     <button onClick={() => addNode(NodeType.VIDEO_GENERATOR)} className="flex items-center gap-2.5 px-5 py-3 rounded-[14px] bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all border border-slate-200 hover:border-slate-300 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300">
                        <Film size={16} className="text-slate-400 transition-colors group-hover:text-purple-400" />
                        <span className="text-[13px] font-medium tracking-wide">视频生成</span>
                    </button>

                    <button onClick={() => addNode(NodeType.VIDEO_GENERATOR, undefined, undefined, { generationMode: 'FIRST_LAST_FRAME' })} className="flex items-center gap-2.5 px-5 py-3 rounded-[14px] bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all border border-slate-200 hover:border-slate-300 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300">
                        <Link size={16} className="text-slate-400 transition-colors group-hover:text-emerald-400" />
                        <span className="text-[13px] font-medium tracking-wide">首尾插帧</span>
                    </button>
                </div>
            </div>

          <input type="file" ref={replaceVideoInputRef} className="hidden" accept="video/*" onChange={(e) => handleReplaceFile(e, 'video')} />
          <input type="file" ref={replaceImageInputRef} className="hidden" accept="image/*" onChange={(e) => handleReplaceFile(e, 'image')} />

          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, width: '100%', height: '100%', transformOrigin: '0 0' }} className="w-full h-full">
              {/* Groups Layer */}
              {groups.map(g => (
                  <div 
                      key={g.id} className={`absolute rounded-[32px] border transition-all ${(draggingGroup?.id === g.id || draggingNodeParentGroupId === g.id) ? 'duration-0' : 'duration-300'} ${selectedGroupId === g.id ? 'border-blue-500/50 bg-blue-50' : 'border-slate-300 bg-slate-50'}`} style={{ left: g.x, top: g.y, width: g.width, height: g.height }} 
                      onMouseDown={(e) => {
                          e.stopPropagation(); e.preventDefault(); // 防止拖拽选中文本
                          setSelectedGroupId(g.id);
                          const childNodes = nodes.filter(n => { const b = getNodeBounds(n); const cx = b.x + b.width/2; const cy = b.y + b.height/2; return cx>g.x && cx<g.x+g.width && cy>g.y && cy<g.y+g.height; }).map(n=>({id:n.id, startX:n.x, startY:n.y}));
                          dragGroupRef.current = { id: g.id, startX: g.x, startY: g.y, mouseStartX: e.clientX, mouseStartY: e.clientY, childNodes };
                          setActiveGroupNodeIds(childNodes.map(c => c.id)); setDraggingGroup({ id: g.id });
                      }} 
                      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({visible:true, x:e.clientX, y:e.clientY, id:g.id}); setContextMenuTarget({type:'group', id:g.id}); }}
                  >
                      <div className="absolute -top-8 left-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{g.title}</div>
                  </div>
              ))}

              {/* Connections Layer */}
              <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}>
                  {connections.map((conn) => {
                      const f = nodes.find(n => n.id === conn.from), t = nodes.find(n => n.id === conn.to);
                      if (!f || !t) return null;
                      const fHeight = f.height || getApproxNodeHeight(f); const tHeight = t.height || getApproxNodeHeight(t);
                      const fx = f.x + (f.width||420) + 3; let fy = f.y + fHeight/2; const tx = t.x - 3; let ty = t.y + tHeight/2;
                      if (Math.abs(fy - ty) < 0.5) ty += 0.5;
                      if (isNaN(fx) || isNaN(fy) || isNaN(tx) || isNaN(ty)) return null;
                      const d = `M ${fx} ${fy} C ${fx + (tx-fx)*0.5} ${fy} ${tx - (tx-fx)*0.5} ${ty} ${tx} ${ty}`;
                      // 自动连接（批量生产）使用虚线样式
                      const isAutoConnection = conn.isAuto;
                      return (
                          <g key={`${conn.from}-${conn.to}`} className="pointer-events-auto group/line">
                              <path
                                  d={d}
                                  stroke={isAutoConnection ? "url(#autoGradient)" : "url(#gradient)"}
                                  strokeWidth={isAutoConnection ? "2" : "3"}
                                  fill="none"
                                  strokeOpacity={isAutoConnection ? "0.4" : "0.5"}
                                  strokeDasharray={isAutoConnection ? "8 4" : "none"}
                                  className="transition-colors duration-300 group-hover/line:stroke-white group-hover/line:stroke-opacity-40"
                              />
                              <path d={d} stroke="transparent" strokeWidth="15" fill="none" style={{ cursor: 'pointer' }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: `${conn.from}-${conn.to}` }); setContextMenuTarget({ type: 'connection', from: conn.from, to: conn.to }); }} />
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
                  </defs>
                  {connectionStart && (() => {
                      // Calculate start position based on node position (like original Vite version)
                      let startX = 0, startY = 0;
                      if (connectionStart.id === 'smart-sequence-dock') {
                          // For smart sequence dock, use screen coordinates
                          startX = (connectionStart.screenX - pan.x) / scale;
                          startY = (connectionStart.screenY - pan.y) / scale;
                      } else {
                          // For regular nodes, calculate from node position
                          const startNode = nodes.find(n => n.id === connectionStart.id);
                          if (!startNode) return null;
                          const startHeight = startNode.height || getApproxNodeHeight(startNode);
                          // Output port is on the right side of the node
                          if (connectionStart.portType === 'output') {
                              startX = startNode.x + (startNode.width || 420) + 3;
                              startY = startNode.y + startHeight / 2;
                          } else {
                              // Input port is on the left side
                              startX = startNode.x - 3;
                              startY = startNode.y + startHeight / 2;
                          }
                      }
                      const endX = (mousePos.x - pan.x) / scale;
                      const endY = (mousePos.y - pan.y) / scale;
                      return (
                          <path
                              d={`M ${startX} ${startY} L ${endX} ${endY}`}
                              stroke="url(#previewGradient)"
                              strokeWidth="3"
                              fill="none"
                              className="connection-preview-line"
                              strokeLinecap="round"
                          />
                      );
                  })()}
              </svg>

              {nodes.map(node => (
              <Node
                  key={node.id} node={node} onUpdate={handleNodeUpdate} onAction={handleNodeAction} onDelete={(id) => deleteNodes([id])} onExpand={setExpandedMedia} onCrop={(id, img) => { setCroppingNodeId(id); setImageToCrop(img); }}
                  onNodeMouseDown={(e, id) => {
                      e.stopPropagation();
                      e.preventDefault(); // 防止拖拽选中文本

                      // 处理选择逻辑
                      let currentSelection = selectedNodeIds;
                      if (e.shiftKey || e.metaKey || e.ctrlKey) {
                          // Shift/Ctrl/Meta 点击：切换选择
                          currentSelection = selectedNodeIds.includes(id)
                              ? selectedNodeIds.filter(i => i !== id)
                              : [...selectedNodeIds, id];
                          setSelectedNodeIds(currentSelection);
                      } else if (!selectedNodeIds.includes(id)) {
                          // 点击未选中的节点：只选中当前节点
                          currentSelection = [id];
                          setSelectedNodeIds(currentSelection);
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
                              otherSelectedNodes
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
                      setConnectionStart({ id, portType: type, screenX: centerX, screenY: centerY });
                  }}
                  onPortMouseUp={(e, id, type) => {
                      e.stopPropagation();
                      const start = connectionStartRef.current;
                      if (start && start.id !== id) {
                          if (start.id === 'smart-sequence-dock') {
                              // Smart sequence dock connection - do nothing for now
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
                              setNodes(p => p.map(n => {
                                  if (n.id !== toId) return n;
                                  // Prevent duplicate inputs
                                  if (n.inputs.includes(fromId)) return n;
                                  return { ...n, inputs: [...n.inputs, fromId] };
                              }));
                          }
                      }
                      setConnectionStart(null);
                  }}
                  onNodeContextMenu={(e, id) => { e.stopPropagation(); e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id }); setContextMenuTarget({ type: 'node', id }); }}
                  onResizeMouseDown={(e, id, w, h) => {
                      e.stopPropagation(); e.preventDefault(); // 防止拖拽选中文本
                      const n = nodes.find(x => x.id === id);
                      if (n) {
                          const cx = n.x + w/2; const cy = n.y + 160; 
                          const pGroup = groups.find(g => { return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height; });
                          setDraggingNodeParentGroupId(pGroup?.id || null);
                          let siblingNodeIds: string[] = [];
                          if (pGroup) { siblingNodeIds = nodes.filter(other => { if (other.id === id) return false; const b = getNodeBounds(other); const ocx = b.x + b.width/2; const ocy = b.y + b.height/2; return ocx > pGroup.x && ocx < pGroup.x + pGroup.width && ocy > pGroup.y && ocy < pGroup.y + pGroup.height; }).map(s => s.id); }
                          resizeContextRef.current = { nodeId: id, initialWidth: w, initialHeight: h, startX: e.clientX, startY: e.clientY, parentGroupId: pGroup?.id || null, siblingNodeIds };
                      }
                      setResizingNodeId(id); setInitialSize({ width: w, height: h }); setResizeStartPos({ x: e.clientX, y: e.clientY }); 
                  }}
                  isSelected={selectedNodeIds.includes(node.id)} 
                  inputAssets={node.inputs.map(i => nodes.find(n => n.id === i)).filter(n => n && (n.data.image || n.data.videoUri || n.data.croppedFrame)).slice(0, 6).map(n => ({ id: n!.id, type: (n!.data.croppedFrame || n!.data.image) ? 'image' : 'video', src: n!.data.croppedFrame || n!.data.image || n!.data.videoUri! }))}
                  onInputReorder={(nodeId, newOrder) => { const node = nodes.find(n => n.id === nodeId); if (node) { setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, inputs: newOrder } : n)); } }}
                  isDragging={draggingNodeId === node.id} isResizing={resizingNodeId === node.id} isConnecting={!!connectionStart} isGroupDragging={activeGroupNodeIds.includes(node.id)}
              />
              ))}

              {selectionRect && <div className="absolute border border-cyan-500/40 bg-cyan-500/10 rounded-lg pointer-events-none" style={{ left: (Math.min(selectionRect.startX, selectionRect.currentX) - pan.x) / scale, top: (Math.min(selectionRect.startY, selectionRect.currentY) - pan.y) / scale, width: Math.abs(selectionRect.currentX - selectionRect.startX) / scale, height: Math.abs(selectionRect.currentY - selectionRect.startY) / scale }} />}
          </div>

          {contextMenu && (
              <div className="fixed z-[100] bg-white/80 backdrop-blur-xl border border-slate-300 rounded-2xl shadow-2xl p-1.5 min-w-[160px] animate-in fade-in zoom-in-95 duration-200 origin-top-left" style={{ top: contextMenu.y, left: contextMenu.x }} onMouseDown={(e) => e.stopPropagation()}>
                  {contextMenuTarget?.type === 'node' && (
                      <>
                          <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-cyan-500/20 hover:text-blue-600 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { const targetNode = nodes.find(n => n.id === contextMenu.id); if (targetNode) setClipboard(JSON.parse(JSON.stringify(targetNode))); setContextMenu(null); }}>
                              <Copy size={12} /> 复制节点
                          </button>
                          {(() => { const targetNode = nodes.find(n => n.id === contextMenu.id); if (targetNode) { const isVideo = targetNode.type === NodeType.VIDEO_GENERATOR || targetNode.type === NodeType.VIDEO_ANALYZER; const isImage = targetNode.type === NodeType.IMAGE_GENERATOR || targetNode.type === NodeType.IMAGE_EDITOR; if (isVideo || isImage) { return ( <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-purple-500/20 hover:text-purple-400 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { replacementTargetRef.current = contextMenu.id ?? null; if (isVideo) replaceVideoInputRef.current?.click(); else replaceImageInputRef.current?.click(); setContextMenu(null); }}> <RefreshCw size={12} /> 替换素材 </button> ); } } return null; })()}
                          <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors mt-1" onClick={() => { deleteNodes([contextMenuTarget.id]); setContextMenu(null); }}><Trash2 size={12} /> 删除节点</button>
                      </>
                  )}
                  {contextMenuTarget?.type === 'create' && (
                      <>
                          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">创建新节点</div>
                          {[NodeType.PROMPT_INPUT, NodeType.IMAGE_GENERATOR, NodeType.VIDEO_GENERATOR, NodeType.VIDEO_FACTORY, NodeType.AUDIO_GENERATOR, NodeType.VIDEO_ANALYZER, NodeType.IMAGE_EDITOR].map(t => { const ItemIcon = getNodeIcon(t); return ( <button key={t} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2.5 transition-colors" onClick={() => { addNode(t, (contextMenu.x-pan.x)/scale, (contextMenu.y-pan.y)/scale); setContextMenu(null); }}> <ItemIcon size={12} className="text-blue-600" /> {getNodeNameCN(t)} </button> ); })}
                      </>
                  )}
                  {contextMenuTarget?.type === 'group' && (
                      <>
                           <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors mb-1" onClick={() => { if (contextMenu.id) saveGroupAsWorkflow(contextMenu.id); setContextMenu(null); }}> <FolderHeart size={12} className="text-blue-600" /> 保存为工作流 </button>
                           <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { setGroups(p => p.filter(g => g.id !== contextMenu.id)); setContextMenu(null); }}> <Trash2 size={12} /> 删除分组 </button>
                      </>
                  )}
                  {contextMenuTarget?.type === 'connection' && (
                      <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { setConnections(prev => prev.filter(c => c.from !== contextMenuTarget.from || c.to !== contextMenuTarget.to)); setNodes(prev => prev.map(n => n.id === contextMenuTarget.to ? { ...n, inputs: n.inputs.filter(i => i !== contextMenuTarget.from) } : n)); setContextMenu(null); }}> <Unplug size={12} /> 删除连接线 </button>
                  )}
                  {contextMenuTarget?.type === 'multi-selection' && (
                      <>
                          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              已选中 {contextMenuTarget.ids?.length || 0} 个节点
                          </div>
                          <button
                              className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-blue-500/20 hover:text-blue-600 rounded-lg flex items-center gap-2 transition-colors"
                              onClick={() => {
                                  const selectedNodes = nodes.filter(n => contextMenuTarget.ids?.includes(n.id));
                                  if (selectedNodes.length > 0) {
                                      saveHistory();
                                      const minX = Math.min(...selectedNodes.map(n => n.x));
                                      const minY = Math.min(...selectedNodes.map(n => n.y));
                                      const maxX = Math.max(...selectedNodes.map(n => n.x + (n.width || 420)));
                                      const maxY = Math.max(...selectedNodes.map(n => n.y + 320));
                                      setGroups(prev => [...prev, {
                                          id: `g-${Date.now()}`,
                                          title: '新建分组',
                                          x: minX - 32,
                                          y: minY - 32,
                                          width: (maxX - minX) + 64,
                                          height: (maxY - minY) + 64
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
          
          {croppingNodeId && imageToCrop && <ImageCropper imageSrc={imageToCrop} onCancel={() => {setCroppingNodeId(null); setImageToCrop(null);}} onConfirm={(b) => {handleNodeUpdate(croppingNodeId, {croppedFrame: b}); setCroppingNodeId(null); setImageToCrop(null);}} />}
          <ExpandedView media={expandedMedia} onClose={() => setExpandedMedia(null)} />
          {isSketchEditorOpen && <SketchEditor onClose={() => setIsSketchEditorOpen(false)} onGenerate={handleSketchResult} />}
          <SmartSequenceDock 
             isOpen={isMultiFrameOpen} 
             onClose={() => setIsMultiFrameOpen(false)} 
             onGenerate={handleMultiFrameGenerate}
             onConnectStart={(e, type) => {
                 e.preventDefault();
                 e.stopPropagation();
                 const portElement = e.currentTarget as HTMLElement;
                 const rect = portElement.getBoundingClientRect();
                 setConnectionStart({ id: 'smart-sequence-dock', portType: 'output', screenX: rect.left + rect.width / 2, screenY: rect.top + rect.height / 2 });
             }}
          />
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

          <SidebarDock
              onAddNode={addNode}
              onUndo={undo}
              isChatOpen={isChatOpen}
              onToggleChat={() => setIsChatOpen(!isChatOpen)}
              isMultiFrameOpen={isMultiFrameOpen}
              onToggleMultiFrame={() => setIsMultiFrameOpen(!isMultiFrameOpen)}
              assetHistory={assetHistory}
              onHistoryItemClick={(item) => { const type = item.type.includes('image') ? NodeType.IMAGE_GENERATOR : NodeType.VIDEO_GENERATOR; const data = item.type === 'image' ? { image: item.src } : { videoUri: item.src }; addNode(type, undefined, undefined, data); }}
              onDeleteAsset={(id) => setAssetHistory(prev => prev.filter(a => a.id !== id))}
              workflows={workflows}
              selectedWorkflowId={selectedWorkflowId}
              onSelectWorkflow={loadWorkflow}
              onSaveWorkflow={saveCurrentAsWorkflow}
              onDeleteWorkflow={deleteWorkflow}
              onRenameWorkflow={renameWorkflow}
              canvases={canvases}
              currentCanvasId={currentCanvasId}
              onNewCanvas={createNewCanvas}
              onSelectCanvas={selectCanvas}
              onDeleteCanvas={deleteCanvas}
              onRenameCanvas={renameCanvas}
          />

          <AssistantPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

          <div className="absolute bottom-8 right-8 flex items-center gap-3 px-4 py-2 bg-white/80 backdrop-blur-2xl border border-slate-300 rounded-full shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-1.5 text-slate-600 hover:text-slate-900 transition-colors rounded-full hover:bg-slate-100"><Minus size={14} strokeWidth={3} /></button>
              <div className="flex items-center gap-2 min-w-[100px]">
                   <input type="range" min="0.2" max="3" step="0.1" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-125 transition-all" />
                   <span className="text-[10px] font-bold text-slate-600 w-8 text-right tabular-nums cursor-pointer hover:text-slate-900" onClick={() => setScale(1)} title="Reset Zoom">{Math.round(scale * 100)}%</span>
              </div>
              <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-1.5 text-slate-600 hover:text-slate-900 transition-colors rounded-full hover:bg-slate-100"><Plus size={14} strokeWidth={3} /></button>
              <button onClick={handleFitView} className="p-1.5 text-slate-600 hover:text-slate-900 transition-colors rounded-full hover:bg-slate-100 ml-2 border-l border-slate-300 pl-3" title="适配视图">
                  <Scan size={14} strokeWidth={3} />
              </button>
          </div>
      </div>
    </div>
  );
};
