"use client";

// ... existing imports
import { AppNode, NodeStatus, NodeType, AudioGenerationMode } from '@/types';
import { ImageIcon as ImageIconLucide, Video as VideoIconLucide, FolderOpen } from 'lucide-react';
import { RefreshCw, Play, Image as ImageIcon, Video as VideoIcon, Type, AlertCircle, CheckCircle, Plus, Maximize2, Download, MoreHorizontal, Wand2, Scaling, FileSearch, Edit, Loader2, Layers, Trash2, X, Upload, Scissors, Film, MousePointerClick, Crop as CropIcon, ChevronDown, ChevronUp, GripHorizontal, Link, Copy, Monitor, Music, Pause, Volume2, Mic2, Grid3X3, Check } from 'lucide-react';
import { AudioNodePanel } from './AudioNodePanel';
import React, { memo, useRef, useState, useEffect, useCallback } from 'react';

// ... (keep constants and helper functions: arePropsEqual, safePlay, safePause, InputThumbnails, AudioVisualizer) ...

// Restore missing constants
interface InputAsset {
    id: string;
    type: 'image' | 'video';
    src: string;
}

interface NodeProps {
    node: AppNode;
    onUpdate: (id: string, data: Partial<AppNode['data']>, size?: { width?: number, height?: number }, title?: string) => void;
    onAction: (id: string, prompt?: string) => void;
    onDelete: (id: string) => void;
    onExpand?: (data: { type: 'image' | 'video', src: string, rect: DOMRect, images?: string[], initialIndex?: number }) => void;
    onEdit?: (nodeId: string, src: string, originalImage?: string, canvasData?: string) => void;
    onCrop?: (id: string, src: string, type?: 'image' | 'video') => void;
    onNodeMouseDown: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, id: string, type: 'input' | 'output') => void;
    onPortMouseUp: (e: React.MouseEvent, id: string, type: 'input' | 'output') => void;
    onOutputPortAction?: (nodeId: string, position: { x: number, y: number }) => void; // 双击/拖拽释放右连接点时触发
    onInputPortAction?: (nodeId: string, position: { x: number, y: number }) => void; // 双击/拖拽释放左连接点时触发（创建上游节点）
    onNodeContextMenu: (e: React.MouseEvent, id: string) => void;
    onMediaContextMenu?: (e: React.MouseEvent, nodeId: string, type: 'image' | 'video', src: string) => void;
    onResizeMouseDown: (e: React.MouseEvent, id: string, initialWidth: number, initialHeight: number) => void;
    onDragResultToCanvas?: (sourceNodeId: string, type: 'image' | 'video', src: string, canvasX: number, canvasY: number) => void; // 从组图宫格拖拽结果到画布
    onGridDragStateChange?: (state: { isDragging: boolean; type?: 'image' | 'video'; src?: string; screenX?: number; screenY?: number } | null) => void; // 通知父组件拖拽状态变化
    inputAssets?: InputAsset[];
    onInputReorder?: (nodeId: string, newOrder: string[]) => void;
    nodeRef?: (el: HTMLDivElement | null) => void; // 用于父组件直接操作 DOM

    isDragging?: boolean;
    isGroupDragging?: boolean;
    isSelected?: boolean;
    isResizing?: boolean;
    isConnecting?: boolean;
    zoom?: number;
}

const IMAGE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const VIDEO_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const IMAGE_RESOLUTIONS = ['1k', '2k', '4k'];
const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'];
const IMAGE_COUNTS = [1, 2, 3, 4];
const VIDEO_COUNTS = [1, 2, 3, 4];

// Seedream 比例到尺寸映射
const SEEDREAM_SIZE_MAP: Record<string, string> = {
    '1:1': '2048x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '16:9': '2560x1440',
    '9:16': '1440x2560',
};

// 图像模型参数配置映射
const IMAGE_MODEL_CONFIG: Record<string, {
    supportsAspectRatio: boolean;
    supportsResolution: boolean;
    supportsMultiImage: boolean;
    aspectRatios?: string[];
    resolutions?: string[];
    defaultAspectRatio?: string;
    defaultResolution?: string;
    sizeMap?: Record<string, string>;  // 比例到尺寸映射
}> = {
    'doubao-seedream-4-5-251128': {
        supportsAspectRatio: true,
        supportsResolution: false,
        supportsMultiImage: true,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultAspectRatio: '1:1',
        sizeMap: SEEDREAM_SIZE_MAP,
    },
    'nano-banana': {
        supportsAspectRatio: true,
        supportsResolution: false,
        supportsMultiImage: true,
        aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
        defaultAspectRatio: '1:1',
    },
    'nano-banana-pro': {
        supportsAspectRatio: true,
        supportsResolution: false,
        supportsMultiImage: true,
        aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
        defaultAspectRatio: '1:1',
    },
};

// 获取模型配置
const getImageModelConfig = (model: string) => {
    return IMAGE_MODEL_CONFIG[model] || {
        supportsAspectRatio: true,
        supportsResolution: false,
        supportsMultiImage: false,
        aspectRatios: IMAGE_ASPECT_RATIOS,
        defaultAspectRatio: '1:1',
    };
};
const GLASS_PANEL = "bg-[#ffffff]/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-300 dark:border-slate-700 shadow-2xl";
const DEFAULT_NODE_WIDTH = 420;
const DEFAULT_FIXED_HEIGHT = 360;
const AUDIO_NODE_HEIGHT = Math.round(DEFAULT_NODE_WIDTH * 9 / 16); // 16:9 比例 = 236

// --- SECURE VIDEO COMPONENT ---
// Fetches video as blob to bypass auth/cors issues with <video src>
// Volcengine URLs are routed through proxy API to avoid CORS

// Helper: Check if URL is from Volcengine and needs proxy
const isVolcengineUrl = (url: string): boolean => {
    if (!url || !url.startsWith('http')) return false;
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.includes('tos-cn-beijing.volces.com');
    } catch {
        return false;
    }
};

// Helper: Get proxied URL for Volcengine
const getProxiedUrl = (url: string): string => {
    if (isVolcengineUrl(url)) {
        return `/api/studio/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
};

// 全局视频 blob URL 缓存 - SecureVideo 加载后存入，ImageCropper 可直接使用
export const globalVideoBlobCache = new Map<string, string>();

const SecureVideo = ({ src, className, autoPlay, muted, loop, onMouseEnter, onMouseLeave, onClick, controls, videoRef, style }: any) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!src) return;
        if (src.startsWith('data:') || src.startsWith('blob:')) {
            setBlobUrl(src);
            return;
        }

        // 检查全局缓存 - 避免重复加载
        const cached = globalVideoBlobCache.get(src);
        if (cached) {
            setBlobUrl(cached);
            return;
        }

        let active = true;
        // Use proxy for Volcengine URLs to bypass CORS
        const fetchUrl = getProxiedUrl(src);

        // Fetch the video content
        fetch(fetchUrl)
            .then(response => {
                if (!response.ok) throw new Error("Video fetch failed");
                return response.blob();
            })
            .then(blob => {
                if (active) {
                    // FORCE MIME TYPE TO VIDEO/MP4 to fix black screen issues with generic binary blobs
                    const mp4Blob = new Blob([blob], { type: 'video/mp4' });
                    const url = URL.createObjectURL(mp4Blob);
                    // 存入全局缓存
                    globalVideoBlobCache.set(src, url);
                    setBlobUrl(url);
                }
            })
            .catch(err => {
                console.error("SecureVideo load error:", err);
                if (active) setError(true);
            });

        return () => {
            active = false;
            // 不再 revoke，因为已存入全局缓存供其他组件使用
        };
    }, [src]);

    if (error) {
        return <div className={`flex items-center justify-center bg-rose-50 text-xs text-rose-500 ${className}`}>Load Error</div>;
    }

    if (!blobUrl) {
        return <div className={`flex items-center justify-center bg-slate-100 ${className}`}><Loader2 className="animate-spin text-slate-400" /></div>;
    }

    return (
        <video
            ref={videoRef}
            src={blobUrl}
            className={className}
            autoPlay={autoPlay}
            muted={muted}
            loop={loop}
            controls={controls}
            playsInline
            preload="auto"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            style={{ backgroundColor: '#f8fafc', ...style }} // Light canvas background for media placeholders
        />
    );
};

// Helper for safe video playback
const safePlay = (e: React.SyntheticEvent<HTMLVideoElement> | HTMLVideoElement) => {
    const vid = (e as any).currentTarget || e;
    if (!vid) return;
    const p = vid.play();
    if (p !== undefined) {
        p.catch((error: any) => {
            // Ignore AbortError which happens when pausing immediately after playing
            if (error.name !== 'AbortError') {
                console.debug("Video play prevented:", error);
            }
        });
    }
};

const safePause = (e: React.SyntheticEvent<HTMLVideoElement> | HTMLVideoElement) => {
    const vid = (e as any).currentTarget || e;
    if (vid) {
        vid.pause();
        vid.currentTime = 0; // Optional: reset to start
    }
};

// Custom Comparator for React.memo to prevent unnecessary re-renders during drag
const arePropsEqual = (prev: NodeProps, next: NodeProps) => {
    if (prev.isDragging !== next.isDragging ||
        prev.isResizing !== next.isResizing ||
        prev.isSelected !== next.isSelected ||
        prev.isGroupDragging !== next.isGroupDragging ||
        prev.isConnecting !== next.isConnecting ||
        prev.zoom !== next.zoom) {
        return false;
    }
    if (prev.node !== next.node) return false;
    const prevInputs = prev.inputAssets || [];
    const nextInputs = next.inputAssets || [];
    if (prevInputs.length !== nextInputs.length) return false;
    for (let i = 0; i < prevInputs.length; i++) {
        if (prevInputs[i].id !== nextInputs[i].id || prevInputs[i].src !== nextInputs[i].src) return false;
    }
    return true;
};

const InputThumbnails = ({ assets, onReorder }: { assets: InputAsset[], onReorder: (newOrder: string[]) => void }) => {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState(0);
    const onReorderRef = useRef(onReorder);
    onReorderRef.current = onReorder;
    const stateRef = useRef({ draggingId: null as string | null, startX: 0, originalAssets: [] as InputAsset[] });
    const THUMB_WIDTH = 48;
    const GAP = 6;
    const ITEM_FULL_WIDTH = THUMB_WIDTH + GAP;

    // Use refs to store handlers for cleanup
    const handlersRef = useRef<{ move: ((e: MouseEvent) => void) | null; up: ((e: MouseEvent) => void) | null }>({ move: null, up: null });

    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        if (!stateRef.current.draggingId) return;
        const delta = e.clientX - stateRef.current.startX;
        setDragOffset(delta);
    }, []);

    const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
        if (!stateRef.current.draggingId) return;
        const { draggingId, startX, originalAssets } = stateRef.current;
        const currentOffset = e.clientX - startX;
        const moveSlots = Math.round(currentOffset / ITEM_FULL_WIDTH);
        const currentIndex = originalAssets.findIndex(a => a.id === draggingId);
        const newIndex = Math.max(0, Math.min(originalAssets.length - 1, currentIndex + moveSlots));

        if (newIndex !== currentIndex) {
            const newOrderIds = originalAssets.map(a => a.id);
            const [moved] = newOrderIds.splice(currentIndex, 1);
            newOrderIds.splice(newIndex, 0, moved);
            onReorderRef.current(newOrderIds);
        }
        setDraggingId(null);
        setDragOffset(0);
        stateRef.current.draggingId = null;
        document.body.style.cursor = '';
        if (handlersRef.current.move) window.removeEventListener('mousemove', handlersRef.current.move);
        if (handlersRef.current.up) window.removeEventListener('mouseup', handlersRef.current.up);
    }, [ITEM_FULL_WIDTH]);

    // Update refs when handlers change
    useEffect(() => {
        handlersRef.current = { move: handleGlobalMouseMove, up: handleGlobalMouseUp };
    }, [handleGlobalMouseMove, handleGlobalMouseUp]);

    useEffect(() => {
        return () => {
            document.body.style.cursor = '';
            if (handlersRef.current.move) window.removeEventListener('mousemove', handlersRef.current.move);
            if (handlersRef.current.up) window.removeEventListener('mouseup', handlersRef.current.up);
        }
    }, []);

    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        setDraggingId(id);
        setDragOffset(0);
        stateRef.current = { draggingId: id, startX: e.clientX, originalAssets: [...assets] };
        document.body.style.cursor = 'grabbing';
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
    };

    if (!assets || assets.length === 0) return null;

    return (
        <div className="flex items-center justify-center h-14 pointer-events-none select-none relative z-0" onMouseDown={e => e.stopPropagation()}>
            <div className="relative flex items-center gap-[6px]">
                {assets.map((asset, index) => {
                    const isItemDragging = asset.id === draggingId;
                    const originalIndex = assets.findIndex(a => a.id === draggingId);
                    let translateX = 0;
                    let scale = 1;
                    let zIndex = 10;

                    if (isItemDragging) {
                        translateX = dragOffset;
                        scale = 1.15;
                        zIndex = 100;
                    } else if (draggingId) {
                        const draggingVirtualIndex = Math.max(0, Math.min(assets.length - 1, originalIndex + Math.round(dragOffset / ITEM_FULL_WIDTH)));
                        if (index > originalIndex && index <= draggingVirtualIndex) translateX = -ITEM_FULL_WIDTH;
                        else if (index < originalIndex && index >= draggingVirtualIndex) translateX = ITEM_FULL_WIDTH;
                    }
                    const isVideo = asset.type === 'video';
                    return (
                        <div
                            key={asset.id}
                            className={`relative rounded-md overflow-hidden cursor-grab active:cursor-grabbing pointer-events-auto border border-slate-400 shadow-lg bg-white/90 group`}
                            style={{
                                width: `${THUMB_WIDTH}px`, height: `${THUMB_WIDTH}px`,
                                transform: `translateX(${translateX}px) scale(${scale})`,
                                zIndex,
                                transition: isItemDragging ? 'none' : 'transform 0.5s cubic-bezier(0.32,0.72,0,1)',
                            }}
                            onMouseDown={(e) => handleMouseDown(e, asset.id)}
                        >
                            {isVideo ? (
                                <SecureVideo src={asset.src} className="w-full h-full object-cover pointer-events-none select-none opacity-80 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800" muted loop autoPlay />
                            ) : (
                                <img src={asset.src} className="w-full h-full object-cover pointer-events-none select-none opacity-80 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800" alt="" />
                            )}
                            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-md"></div>
                            <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center border border-slate-400 z-20 shadow-sm pointer-events-none">
                                <span className="text-[9px] font-bold text-slate-900 leading-none">{index + 1}</span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
};

const AudioVisualizer = ({ isPlaying }: { isPlaying: boolean }) => (
    <div className="flex items-center justify-center gap-[2px] h-12 w-full opacity-60">
        {[...Array(20)].map((_, i) => (
            <div key={i} className="w-1 bg-cyan-400/80 rounded-full" style={{ height: isPlaying ? `${20 + Math.random() * 80}%` : '20%', transition: 'height 0.1s ease', animation: isPlaying ? `pulse 0.5s infinite ${i * 0.05}s` : 'none' }} />
        ))}
    </div>
);

const NodeComponent: React.FC<NodeProps> = ({
    node, onUpdate, onAction, onDelete, onExpand, onEdit, onCrop, onNodeMouseDown, onPortMouseDown, onPortMouseUp, onOutputPortAction, onInputPortAction, onNodeContextMenu, onMediaContextMenu, onResizeMouseDown, onDragResultToCanvas, onGridDragStateChange, inputAssets, onInputReorder, nodeRef, isDragging, isGroupDragging, isSelected, isResizing, isConnecting, zoom = 1
}) => {
    const inverseScale = 1 / Math.max(0.1, zoom);
    // 检测深色模式
    const [isDarkMode, setIsDarkMode] = useState(false);
    useEffect(() => {
        const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    const isWorking = node.status === NodeStatus.WORKING;
    const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | HTMLAudioElement | null>(null);
    const playPromiseRef = useRef<Promise<void> | null>(null);
    const isHoveringRef = useRef(false);
    const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const [showImageGrid, setShowImageGrid] = useState(false);
    const [isGridAnimating, setIsGridAnimating] = useState(false); // 网格展开/收起动画中
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(node.title);
    const [isHovered, setIsHovered] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isEditingResult, setIsEditingResult] = useState(false); // 编辑已有结果的模式
    const generationMode = node.data.generationMode || 'CONTINUE';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [localPrompt, setLocalPrompt] = useState(node.data.prompt || '');
    const [inputHeight, setInputHeight] = useState(80);
    const isResizingInput = useRef(false);
    const inputStartDragY = useRef(0);
    const inputStartHeight = useRef(0);

    // 组图宫格拖拽状态
    const [gridDragState, setGridDragState] = useState<{
        isDragging: boolean;
        src: string;
        type: 'image' | 'video';
    } | null>(null);

    useEffect(() => { setLocalPrompt(node.data.prompt || ''); }, [node.data.prompt]);

    // 网格展开/收起动画控制：收起时延迟显示底部面板
    useEffect(() => {
        if (showImageGrid) {
            // 展开时立即隐藏底部面板
            setIsGridAnimating(true);
        } else {
            // 收起时等待动画完成（500ms）后再显示底部面板
            const timer = setTimeout(() => setIsGridAnimating(false), 500);
            return () => clearTimeout(timer);
        }
    }, [showImageGrid]);
    const commitPrompt = () => { if (localPrompt !== (node.data.prompt || '')) onUpdate(node.id, { prompt: localPrompt }); };
    const handleActionClick = () => {
        commitPrompt();
        // 如果在编辑已有结果的模式下，先清除旧结果再生成
        if (isEditingResult) {
            onUpdate(node.id, {
                image: undefined,
                images: undefined,
                videoUri: undefined,
                videoUris: undefined,
                videoMetadata: undefined,
                error: undefined,
            });
            setIsEditingResult(false);
            setTimeout(() => {
                onAction(node.id, localPrompt);
            }, 50);
        } else {
            onAction(node.id, localPrompt);
        }
    };
    const handleCmdEnter = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleActionClick();
        }
    };

    const handleInputResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation(); e.preventDefault();
        isResizingInput.current = true; inputStartDragY.current = e.clientY; inputStartHeight.current = inputHeight;
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!isResizingInput.current) return;
            setInputHeight(Math.max(48, Math.min(inputStartHeight.current + (e.clientY - inputStartDragY.current), 300)));
        };
        const handleGlobalMouseUp = () => { isResizingInput.current = false; window.removeEventListener('mousemove', handleGlobalMouseMove); window.removeEventListener('mouseup', handleGlobalMouseUp); };
        window.addEventListener('mousemove', handleGlobalMouseMove); window.addEventListener('mouseup', handleGlobalMouseUp);
    };

    React.useEffect(() => {
        if (videoBlobUrl) { URL.revokeObjectURL(videoBlobUrl); setVideoBlobUrl(null); }
        if ((node.type === NodeType.VIDEO_GENERATOR || node.type === NodeType.VIDEO_FACTORY) && node.data.videoUri) {
            if (node.data.videoUri.startsWith('data:')) { setVideoBlobUrl(node.data.videoUri); return; }
            let isActive = true; setIsLoadingVideo(true);
            // Use proxy for Volcengine URLs to bypass CORS
            const fetchUrl = getProxiedUrl(node.data.videoUri);
            fetch(fetchUrl).then(res => res.blob()).then(blob => {
                if (isActive) {
                    // Force video/mp4 for local analysis blob too
                    const mp4Blob = new Blob([blob], { type: 'video/mp4' });
                    setVideoBlobUrl(URL.createObjectURL(mp4Blob));
                    setIsLoadingVideo(false);
                }
            }).catch(err => { if (isActive) setIsLoadingVideo(false); });
            return () => { isActive = false; if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl); };
        }
    }, [node.data.videoUri, node.type]);

    const toggleAudio = (e: React.MouseEvent) => {
        e.stopPropagation();
        const audio = mediaRef.current as HTMLAudioElement;
        if (!audio) return;
        if (audio.paused) { audio.play(); setIsPlayingAudio(true); } else { audio.pause(); setIsPlayingAudio(false); }
    };

    useEffect(() => {
        return () => {
            if (mediaRef.current && (mediaRef.current instanceof HTMLVideoElement || mediaRef.current instanceof HTMLAudioElement)) {
                try { mediaRef.current.pause(); mediaRef.current.src = ""; mediaRef.current.load(); } catch (e) { }
            }
        }
    }, []);

    const handleMouseEnter = () => {
        isHoveringRef.current = true;
        // 移除悬停自动展开宫格，改为点击展开

        // Play Video on Hover
        if (mediaRef.current instanceof HTMLVideoElement) {
            safePlay(mediaRef.current);
        }
    };

    const handleMouseLeave = () => {
        isHoveringRef.current = false;
        // 移除悬停关闭宫格，由点击控制

        // Pause Video on Leave
        if (mediaRef.current instanceof HTMLVideoElement) {
            safePause(mediaRef.current);
        }
    };

    const handleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onExpand && mediaRef.current) {
            const rect = mediaRef.current.getBoundingClientRect();
            if (node.type.includes('IMAGE') && node.data.image) {
                onExpand({ type: 'image', src: node.data.image, rect, images: node.data.images || [node.data.image], initialIndex: (node.data.images || [node.data.image]).indexOf(node.data.image) });
            } else if (node.type.includes('VIDEO') && node.data.videoUri) {
                const src = node.data.videoUri;
                const videos = node.data.videoUris && node.data.videoUris.length > 0 ? node.data.videoUris : [src];
                const currentIndex = node.data.videoUris ? node.data.videoUris.indexOf(node.data.videoUri) : 0;
                const safeIndex = currentIndex >= 0 ? currentIndex : 0;
                // Pass the URIs directly; ExpandedView will use SecureVideo logic
                onExpand({ type: 'video', src: src, rect, images: videos, initialIndex: safeIndex });
            }
        }
    };
    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const src = node.data.image || videoBlobUrl || node.data.audioUri || '';
        if (!src) return;

        try {
            let blobUrl = src;
            // 如果是远程 URL（非 base64/blob），需要 fetch 转 blob
            if (src.startsWith('http')) {
                // Use proxy for Volcengine URLs to bypass CORS
                const fetchUrl = getProxiedUrl(src);
                const response = await fetch(fetchUrl);
                const blob = await response.blob();
                blobUrl = URL.createObjectURL(blob);
            }

            const ext = src.includes('video') || videoBlobUrl ? 'mp4' : src.includes('audio') ? 'wav' : 'png';
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `studio-${Date.now()}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // 清理临时 blob URL
            if (src.startsWith('http')) URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Download failed:', err);
            // 降级：在新窗口打开
            window.open(src, '_blank');
        }
    };
    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onEdit && node.data.image) {
            onEdit(node.id, node.data.image, node.data.originalImage, node.data.canvasData);
        }
    };
    const handleUploadVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const dataUrl = evt.target?.result as string;
                // 检测视频尺寸并更新节点比例
                const video = document.createElement('video');
                video.onloadedmetadata = () => {
                    const w = video.videoWidth;
                    const h = video.videoHeight;
                    const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
                    const divisor = gcd(w, h);
                    const ratioW = w / divisor;
                    const ratioH = h / divisor;
                    // 简化常见比例
                    let aspectRatio = `${ratioW}:${ratioH}`;
                    if (Math.abs(w / h - 16 / 9) < 0.1) aspectRatio = '16:9';
                    else if (Math.abs(w / h - 9 / 16) < 0.1) aspectRatio = '9:16';
                    else if (Math.abs(w / h - 1) < 0.1) aspectRatio = '1:1';
                    else if (Math.abs(w / h - 4 / 3) < 0.1) aspectRatio = '4:3';
                    else if (Math.abs(w / h - 3 / 4) < 0.1) aspectRatio = '3:4';

                    const nodeWidth = node.width || DEFAULT_NODE_WIDTH;
                    const [rw, rh] = aspectRatio.split(':').map(Number);
                    const newHeight = (nodeWidth * rh) / rw;
                    onUpdate(node.id, { videoUri: dataUrl, aspectRatio }, { height: newHeight });
                    // 上传视频后进入编辑模式，允许用户继续编辑提示词
                    setIsEditingResult(true);
                };
                video.src = dataUrl;
            };
            reader.readAsDataURL(file);
        }
    };
    const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const dataUrl = evt.target?.result as string;
                // 检测图片尺寸并更新节点比例
                const img = new Image();
                img.onload = () => {
                    const w = img.width;
                    const h = img.height;
                    const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
                    const divisor = gcd(w, h);
                    const ratioW = w / divisor;
                    const ratioH = h / divisor;
                    // 简化常见比例
                    let aspectRatio = `${ratioW}:${ratioH}`;
                    if (Math.abs(w / h - 16 / 9) < 0.1) aspectRatio = '16:9';
                    else if (Math.abs(w / h - 9 / 16) < 0.1) aspectRatio = '9:16';
                    else if (Math.abs(w / h - 1) < 0.1) aspectRatio = '1:1';
                    else if (Math.abs(w / h - 4 / 3) < 0.1) aspectRatio = '4:3';
                    else if (Math.abs(w / h - 3 / 4) < 0.1) aspectRatio = '3:4';

                    const nodeWidth = node.width || DEFAULT_NODE_WIDTH;
                    const [rw, rh] = aspectRatio.split(':').map(Number);
                    const newHeight = (nodeWidth * rh) / rw;
                    onUpdate(node.id, { image: dataUrl, aspectRatio }, { height: newHeight });
                    // 上传图片后进入编辑模式，允许用户继续编辑提示词
                    setIsEditingResult(true);
                };
                img.src = dataUrl;
            };
            reader.readAsDataURL(file);
        }
    };
    const handleAspectRatioSelect = (newRatio: string) => {
        const [w, h] = newRatio.split(':').map(Number);
        if (w && h) {
            // 使用默认宽度 420 作为基准，保持节点尺寸一致
            const newWidth = DEFAULT_NODE_WIDTH;
            const newHeight = (DEFAULT_NODE_WIDTH * h) / w;
            onUpdate(node.id, { aspectRatio: newRatio }, { width: newWidth, height: newHeight });
        } else {
            onUpdate(node.id, { aspectRatio: newRatio });
        }
    };
    const handleTitleSave = () => { setIsEditingTitle(false); if (tempTitle.trim() && tempTitle !== node.title) onUpdate(node.id, {}, undefined, tempTitle); else setTempTitle(node.title); };

    const getNodeConfig = () => {
        switch (node.type) {
            case NodeType.PROMPT_INPUT: return { icon: Type, color: 'text-amber-400', border: 'border-amber-500/30' };
            case NodeType.IMAGE_ASSET: return { icon: ImageIcon, color: 'text-blue-400', border: 'border-blue-500/30' };
            case NodeType.VIDEO_ASSET: return { icon: VideoIcon, color: 'text-green-400', border: 'border-green-500/30' };
            case NodeType.IMAGE_GENERATOR: return { icon: ImageIcon, color: 'text-blue-400', border: 'border-blue-500/30' };
            case NodeType.VIDEO_GENERATOR: return { icon: VideoIcon, color: 'text-green-400', border: 'border-green-500/30' };
            case NodeType.VIDEO_FACTORY: return { icon: Film, color: 'text-green-400', border: 'border-green-500/30' };
            case NodeType.AUDIO_GENERATOR: return { icon: Mic2, color: 'text-red-400', border: 'border-red-500/30' };
            case NodeType.IMAGE_EDITOR: return { icon: Edit, color: 'text-blue-400', border: 'border-blue-500/30' };
            default: return { icon: Type, color: 'text-slate-600', border: 'border-slate-300' };
        }
    };
    const { icon: NodeIcon, color: iconColor } = getNodeConfig();

    const getNodeHeight = () => {
        if (node.height) return node.height;
        if (node.type === NodeType.IMAGE_EDITOR) return DEFAULT_FIXED_HEIGHT;
        if (node.type === NodeType.AUDIO_GENERATOR) return AUDIO_NODE_HEIGHT;
        // 提示词节点和素材节点：默认 16:9 比例
        if (node.type === NodeType.PROMPT_INPUT || node.type === NodeType.IMAGE_ASSET || node.type === NodeType.VIDEO_ASSET) {
            const ratio = node.data.aspectRatio || '16:9';
            const [w, h] = ratio.split(':').map(Number);
            return (node.width || DEFAULT_NODE_WIDTH) * h / w;
        }
        const ratio = node.data.aspectRatio || '16:9';
        const [w, h] = ratio.split(':').map(Number);
        return ((node.width || DEFAULT_NODE_WIDTH) * h / w);
    };
    const nodeHeight = getNodeHeight();
    const nodeWidth = node.width || DEFAULT_NODE_WIDTH;
    const hasInputs = inputAssets && inputAssets.length > 0;

    const renderTopBar = () => {
        const showTopBar = isSelected || isHovered;
        return (
            <div className={`absolute -top-10 left-0 w-full flex items-center justify-between px-1 transition-all duration-300 ${showTopBar ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                <div className="flex items-center gap-1.5 pointer-events-auto">
                    {(node.data.image || node.data.videoUri || node.data.audioUri) && (
                        <div className="flex items-center gap-1">
                            <button onClick={handleDownload} className="p-1.5 bg-white/70 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-600 backdrop-blur-md rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:border-white/30 dark:hover:border-slate-500/30 transition-colors" title="下载"><Download size={14} /></button>
                            {node.data.image && onEdit && <button onClick={handleEdit} className="p-1.5 bg-white/70 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-600 backdrop-blur-md rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:border-white/30 dark:hover:border-slate-500/30 transition-colors" title="编辑涂鸦"><Edit size={14} /></button>}
                            {node.type !== NodeType.AUDIO_GENERATOR && <button onClick={handleExpand} className="p-1.5 bg-white/70 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-600 backdrop-blur-md rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:border-white/30 dark:hover:border-slate-500/30 transition-colors" title="全屏预览"><Maximize2 size={14} /></button>}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 pointer-events-auto">
                    {isWorking && <div className="bg-[#ffffff]/90 dark:bg-slate-800/90 backdrop-blur-md p-1.5 rounded-full border border-slate-300 dark:border-slate-600"><Loader2 className="animate-spin w-3 h-3 text-blue-400 dark:text-blue-300" /></div>}
                    <div className={`px-2 py-1 flex items-center gap-2`}>
                        {isEditingTitle ? (
                            <input className="bg-transparent border-none outline-none text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider w-24 text-right" value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} onBlur={handleTitleSave} onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()} onMouseDown={e => e.stopPropagation()} autoFocus />
                        ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-100 cursor-text text-right" onClick={() => setIsEditingTitle(true)}>{node.title}</span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderMediaContent = () => {
        if (node.type === NodeType.PROMPT_INPUT) {
            // 提示词节点：文本输入框 + 结果展示，悬停弹出配置框
            const hasContent = localPrompt && localPrompt.trim().length > 0;
            // 检查是否有上游媒体素材
            const hasUpstreamMedia = inputAssets && inputAssets.length > 0;

            return (
                <div className="w-full h-full p-3 flex flex-col gap-2 group/text bg-white dark:bg-slate-800">
                    {/* 文本编辑区 - 黄色主题 */}
                    <div className="flex-1 bg-amber-50/50 dark:bg-amber-900/10 rounded-[16px] border border-amber-200/50 dark:border-amber-700/30 relative overflow-hidden hover:border-amber-300 dark:hover:border-amber-600 focus-within:border-amber-400 dark:focus-within:border-amber-500 transition-colors">
                        <textarea
                            className="w-full h-full bg-transparent resize-none focus:outline-none text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400/60 dark:placeholder-slate-500/60 p-3 font-medium leading-relaxed custom-scrollbar"
                            placeholder={hasUpstreamMedia
                                ? "分析/优化结果将在此显示...\n\n可手动编辑或通过下方配置框触发 AI 处理。"
                                : "在此输入或编辑您的提示词...\n\n可手动编辑，或通过下方配置框让 AI 优化。"}
                            value={localPrompt}
                            onChange={(e) => setLocalPrompt(e.target.value)}
                            onBlur={(e) => { commitPrompt(); (e.target as HTMLTextAreaElement).blur(); }}
                            onKeyDown={(e) => {
                                handleCmdEnter(e);
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    (e.target as HTMLTextAreaElement).blur();
                                }
                            }}
                            onWheel={(e) => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                        />
                        {/* 右上角复制按钮 */}
                        {hasContent && (
                            <button
                                className="absolute top-2 right-2 p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all opacity-0 group-hover/text:opacity-100"
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(localPrompt); }}
                                title="复制内容"
                            >
                                <Copy size={12} />
                            </button>
                        )}
                    </div>
                    {/* 底部字数统计 */}
                    <div className="flex items-center justify-between px-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                            {localPrompt.length > 0 ? `${localPrompt.length} 字` : ''}
                        </span>
                        {hasUpstreamMedia && (
                            <span className="text-[10px] text-green-500 dark:text-green-400 font-bold flex items-center gap-1">
                                <FileSearch size={10} />
                                已连接素材
                            </span>
                        )}
                    </div>
                    {/* 加载遮罩 */}
                    {isWorking && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 rounded-[24px]">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="animate-spin text-amber-500 dark:text-amber-400" size={28} />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                    {hasUpstreamMedia ? 'AI 正在分析素材...' : 'AI 正在优化提示词...'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // 图片素材节点
        if (node.type === NodeType.IMAGE_ASSET) {
            const hasImage = !!node.data.image;
            const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file || !file.type.startsWith('image/')) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const base64 = ev.target?.result as string;
                    // 读取图片尺寸并自适应节点大小
                    const img = new window.Image();
                    img.onload = () => {
                        const imgWidth = img.width;
                        const imgHeight = img.height;
                        // 计算最接近的标准比例
                        const ratio = imgWidth / imgHeight;
                        let aspectRatio = '1:1';
                        if (ratio > 1.6) aspectRatio = '16:9';
                        else if (ratio > 1.2) aspectRatio = '4:3';
                        else if (ratio < 0.625) aspectRatio = '9:16';
                        else if (ratio < 0.83) aspectRatio = '3:4';
                        // 计算节点尺寸，使用默认宽度 420 保持一致
                        const newWidth = DEFAULT_NODE_WIDTH;
                        const newHeight = DEFAULT_NODE_WIDTH * imgHeight / imgWidth;
                        // 更新节点数据和尺寸
                        onUpdate(node.id, { image: base64, aspectRatio }, { width: newWidth, height: newHeight });
                    };
                    img.src = base64;
                };
                reader.readAsDataURL(file);
            };
            return (
                <div className="w-full h-full relative group/asset overflow-hidden bg-white dark:bg-slate-800" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                    {!hasImage ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-50/30 dark:bg-blue-900/10 group-hover/asset:bg-blue-50/50 dark:group-hover/asset:bg-blue-900/20 transition-colors">
                            <div
                                className="flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 select-none"
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <Upload size={28} className="text-blue-400/60 dark:text-blue-500/50" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">上传图片</span>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </div>
                    ) : (
                        <>
                            <img
                                ref={mediaRef as any}
                                src={node.data.image}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover/asset:scale-105 bg-white dark:bg-slate-800"
                                draggable={false}
                                onContextMenu={(e) => onMediaContextMenu?.(e, node.id, 'image', node.data.image!)}
                            />
                            <button
                                className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 backdrop-blur-md opacity-0 group-hover/asset:opacity-100 transition-all shadow-lg z-10"
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                title="替换图片"
                            >
                                <Upload size={14} />
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </>
                    )}
                </div>
            );
        }

        // 视频素材节点
        if (node.type === NodeType.VIDEO_ASSET) {
            const hasVideo = !!node.data.videoUri;
            const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file || !file.type.startsWith('video/')) return;
                const url = URL.createObjectURL(file);
                onUpdate(node.id, { videoUri: url });
            };
            return (
                <div className="w-full h-full relative group/asset overflow-hidden bg-white dark:bg-slate-800" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                    {!hasVideo ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-50/30 dark:bg-emerald-900/10 group-hover/asset:bg-emerald-50/50 dark:group-hover/asset:bg-emerald-900/20 transition-colors">
                            <div
                                className="flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 select-none"
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <Upload size={28} className="text-emerald-400/60 dark:text-emerald-500/50" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 dark:text-emerald-400">上传视频</span>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleVideoUpload} />
                        </div>
                    ) : (
                        <>
                            <SecureVideo
                                videoRef={mediaRef}
                                src={node.data.videoUri}
                                className="w-full h-full object-cover bg-white dark:bg-slate-800"
                                loop
                                muted
                                onContextMenu={(e: React.MouseEvent) => onMediaContextMenu?.(e, node.id, 'video', node.data.videoUri!)}
                            />
                            <button
                                className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 backdrop-blur-md opacity-0 group-hover/asset:opacity-100 transition-all shadow-lg z-10"
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                title="替换视频"
                            >
                                <Upload size={14} />
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleVideoUpload} />
                        </>
                    )}
                </div>
            );
        }

        if (node.type === NodeType.AUDIO_GENERATOR) {
            const audioMode = node.data.audioMode || 'music';
            const isMusic = audioMode === 'music';
            const coverImage = node.data.musicConfig?.coverImage;

            return (
                <div className="w-full h-full p-4 flex flex-col justify-center items-center relative overflow-hidden group/audio bg-red-50/30 dark:bg-red-900/10 group-hover/media:bg-red-50/60 dark:group-hover/media:bg-red-900/20 transition-colors">

                    {/* 封面图（音乐模式且有封面时显示） */}
                    {isMusic && coverImage && (
                        <div className="absolute inset-0 z-0">
                            <img src={coverImage} className="w-full h-full object-cover opacity-30 blur-sm" alt="" />
                        </div>
                    )}

                    {/* 模式指示器 - 统一粉红色调 */}
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-pink-500/20 text-pink-600 dark:text-pink-400">
                        {isMusic ? <Music size={10} /> : <Mic2 size={10} />}
                        <span>{isMusic ? '音乐' : '语音'}</span>
                    </div>

                    {node.data.audioUri ? (
                        <div className="flex flex-col items-center gap-3 w-full z-10">
                            <audio ref={mediaRef as any} src={node.data.audioUri} onEnded={() => setIsPlayingAudio(false)} onPlay={() => setIsPlayingAudio(true)} onPause={() => setIsPlayingAudio(false)} className="hidden" />

                            {/* 歌曲标题（音乐模式） */}
                            {isMusic && node.data.musicConfig?.title && (
                                <div className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center truncate max-w-full px-4">
                                    {node.data.musicConfig.title}
                                </div>
                            )}

                            {/* 音频可视化器 */}
                            <div className="w-full px-4"><AudioVisualizer isPlaying={isPlayingAudio} /></div>

                            {/* 播放控制 */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={toggleAudio}
                                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 bg-pink-500/20 hover:bg-pink-500/40 border border-pink-500/50"
                                >
                                    {isPlayingAudio ? <Pause size={18} className="text-slate-900 dark:text-white" /> : <Play size={18} className="text-slate-900 dark:text-white ml-0.5" />}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 z-10 select-none">
                            {isWorking ? (
                                <Loader2 size={28} className="animate-spin text-red-500" />
                            ) : (
                                <>
                                    {isMusic ? <Music size={28} className="text-red-400/60" /> : <Mic2 size={28} className="text-red-400/60" />}
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">准备生成</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* 错误显示 */}
                    {node.status === NodeStatus.ERROR && (
                        <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center z-20">
                            <AlertCircle className="text-red-500 mb-2" size={24} />
                            <span className="text-[10px] text-red-500 leading-relaxed">{node.data.error}</span>
                        </div>
                    )}
                </div>
            )
        }

        // VIDEO_FACTORY 剧情延展模式: croppedFrame 不算作主内容，只在底部缩略图显示
        const hasContent = node.data.image || node.data.videoUri;

        // 剧情延展模式特殊处理：始终显示空状态样式，即使有 croppedFrame（CUT已合并到CONTINUE，保留向后兼容）
        const isCutOrContinueMode = node.type === NodeType.VIDEO_FACTORY && (generationMode === 'CUT' || generationMode === 'CONTINUE');
        const showEmptyState = isCutOrContinueMode ? !hasContent : !hasContent;

        const isVideoNode = node.type === NodeType.VIDEO_GENERATOR || node.type === NodeType.VIDEO_FACTORY;
        const themeColor = isVideoNode ? 'emerald' : 'blue';
        const bgClass = isVideoNode
            ? 'bg-emerald-50/30 dark:bg-emerald-900/10 group-hover/media:bg-emerald-50/60 dark:group-hover/media:bg-emerald-900/20'
            : 'bg-blue-50/30 dark:bg-blue-900/10 group-hover/media:bg-blue-50/60 dark:group-hover/media:bg-blue-900/20';

        return (
            <div className="w-full h-full relative group/media overflow-hidden bg-white dark:bg-slate-800" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                {showEmptyState ? (
                    <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-400 transition-colors ${!isCutOrContinueMode ? bgClass : ''}`}>
                        {isCutOrContinueMode ? (
                            // 剧情延展模式：根据是否已选择关键帧显示不同状态
                            (() => {
                                const upstreamVideo = inputAssets?.find(a => a.type === 'video');
                                const hasCroppedFrame = !!node.data.croppedFrame;

                                return (
                                    <div className="flex flex-col items-center gap-2 select-none">
                                        {isWorking ? (
                                            <Loader2 className="animate-spin text-emerald-500" size={28} />
                                        ) : hasCroppedFrame ? (
                                            <VideoIcon size={28} className="text-emerald-400/60 dark:text-emerald-500/50" />
                                        ) : (
                                            <Film size={28} className="text-emerald-400/60 dark:text-emerald-500/50" />
                                        )}
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 dark:text-emerald-400">
                                            {isWorking ? "生成中..." : (hasCroppedFrame ? "准备生成" : (upstreamVideo ? "可选关键帧" : "连接上游"))}
                                        </span>
                                        <span className="text-[8px] text-slate-400 dark:text-slate-500">
                                            {!isWorking && !hasCroppedFrame && upstreamVideo && "不选取则使用最后一帧"}
                                        </span>
                                        {/* 悬浮按钮 - 选择/重新选择关键帧 */}
                                        {upstreamVideo && !isWorking && (
                                            <div
                                                className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800/90 dark:bg-black/90 backdrop-blur-sm rounded-full flex items-center justify-center cursor-pointer hover:bg-emerald-600 dark:hover:bg-emerald-700 transition-all opacity-0 group-hover/media:opacity-100 hover:scale-105 shadow-lg"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onCrop?.(node.id, upstreamVideo.src, 'video');
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <Film size={12} className="text-white mr-1.5" />
                                                <span className="text-[10px] text-white font-medium tracking-wide">{hasCroppedFrame ? "重新选择" : "选取关键帧"}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()
                        ) : (
                            // 普通生成节点空状态：仅图标+提示文本（统一样式与音频节点一致）
                            <div className="flex flex-col items-center gap-2 select-none">
                                {isWorking ? (
                                    <Loader2 className={`animate-spin ${isVideoNode ? 'text-emerald-500' : 'text-blue-500'}`} size={28} />
                                ) : (
                                    isVideoNode ? (
                                        <VideoIcon size={28} className="text-emerald-400/60 dark:text-emerald-500/50" />
                                    ) : (
                                        <ImageIcon size={28} className="text-blue-400/60 dark:text-blue-500/50" />
                                    )
                                )}
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${isVideoNode ? 'text-emerald-500 dark:text-emerald-400' : 'text-blue-500 dark:text-blue-400'}`}>
                                    {isWorking ? "生成中..." : "准备生成"}
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {node.data.image ? (
                            <img ref={mediaRef as any} src={node.data.image} className="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-105 bg-white dark:bg-slate-800" draggable={false} style={{ filter: showImageGrid ? 'blur(10px)' : 'none' }} onContextMenu={(e) => onMediaContextMenu?.(e, node.id, 'image', node.data.image!)} />
                        ) : (
                            <SecureVideo
                                videoRef={mediaRef} // Pass Ref to Video
                                src={node.data.videoUri}
                                className="w-full h-full object-cover bg-white dark:bg-slate-800"
                                loop
                                muted
                                // autoPlay removed to rely on hover logic
                                onContextMenu={(e: React.MouseEvent) => onMediaContextMenu?.(e, node.id, 'video', node.data.videoUri!)}
                                style={{ filter: showImageGrid ? 'blur(10px)' : 'none' }} // Pass Style
                            />
                        )}
                        {/* 组图数量徽章 - 右上角显示 */}
                        {node.data.images && node.data.images.length > 1 && !showImageGrid && (
                            <button
                                className="absolute z-30 flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg hover:bg-white dark:hover:bg-slate-700 hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer group/badge"
                                style={{
                                    top: `${12 * inverseScale}px`,
                                    right: `${12 * inverseScale}px`,
                                    transform: `scale(${inverseScale})`,
                                    transformOrigin: 'top right'
                                }}
                                onClick={(e) => { e.stopPropagation(); setShowImageGrid(true); }}
                                title="点击查看全部结果"
                            >
                                <Grid3X3 size={12} className="text-slate-500 dark:text-slate-400 group-hover/badge:text-blue-500 dark:group-hover/badge:text-blue-400" />
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 group-hover/badge:text-blue-600 dark:group-hover/badge:text-blue-300">{node.data.images.length}</span>
                            </button>
                        )}
                        {node.status === NodeStatus.ERROR && <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20"><AlertCircle className="text-red-500 mb-2" /><span className="text-xs text-red-200">{node.data.error}</span></div>}
                    </>
                )}
            </div>
        );
    };

    // 复制状态 - 必须在组件顶层声明
    const [promptCopied, setPromptCopied] = useState(false);

    // 提示词节点的需求输入状态
    const [promptRequest, setPromptRequest] = useState(node.data.userInput || '');

    const renderBottomPanel = () => {
        // 素材节点不需要底部面板
        if (node.type === NodeType.IMAGE_ASSET || node.type === NodeType.VIDEO_ASSET) return null;

        const isOpen = (isHovered || isInputFocused);

        // 提示词节点：专用配置框
        if (node.type === NodeType.PROMPT_INPUT) {
            const hasUpstreamMedia = inputAssets && inputAssets.length > 0;
            const models = [
                { l: 'Gemini 2.5 Flash', v: 'gemini-2.5-flash' },
                { l: 'Gemini 2.5 Pro', v: 'gemini-2.5-pro' },
            ];
            const currentModel = node.data.model || 'gemini-2.5-flash';
            const currentModelLabel = models.find(m => m.v === currentModel)?.l || 'Gemini 2.5 Flash';

            const handleExecute = () => {
                if (isWorking) return;
                // 先保存节点内文本到 prompt，再保存需求到 userInput，最后触发 action
                onUpdate(node.id, { prompt: localPrompt, userInput: promptRequest });
                onAction(node.id, promptRequest);
            };

            return (
                <div data-config-panel className={`absolute top-full left-1/2 w-[98%] z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? `opacity-100 translate-y-0 scale-100` : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}
                    style={{
                        paddingTop: `${8 * inverseScale}px`,
                        transform: `translateX(-50%) scale(${inverseScale})`,
                        transformOrigin: 'top center'
                    }}
                >
                    <div className={`w-full rounded-[20px] p-1 flex flex-col gap-1 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
                        <div className="relative group/input bg-white dark:bg-slate-800 rounded-[16px] flex flex-col overflow-hidden">
                            <textarea
                                className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-500/60 dark:placeholder-slate-400/60 p-3 focus:outline-none resize-none custom-scrollbar font-medium leading-relaxed"
                                style={{ height: `${Math.min(inputHeight, 200)}px` }}
                                placeholder={hasUpstreamMedia
                                    ? "输入分析需求（可选）...\n如「这是什么风格」「描述画面内容用于复刻」\n置空时生成详细描述"
                                    : "输入优化需求（可选）...\n如「优化为高质量视频提示词」「扩写更多细节」"}
                                value={promptRequest}
                                onChange={(e) => setPromptRequest(e.target.value)}
                                onBlur={() => setIsInputFocused(false)}
                                onKeyDown={(e) => {
                                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                        e.preventDefault();
                                        handleExecute();
                                    }
                                }}
                                onFocus={() => setIsInputFocused(true)}
                                onMouseDown={e => e.stopPropagation()}
                                readOnly={isWorking}
                            />
                            <div className="absolute bottom-0 left-0 w-full h-3 cursor-row-resize flex items-center justify-center opacity-0 group-hover/input:opacity-100 transition-opacity" onMouseDown={handleInputResizeStart}><div className="w-8 h-1 rounded-full bg-slate-100 dark:bg-slate-700 group-hover/input:bg-slate-200 dark:group-hover/input:bg-slate-600" /></div>
                        </div>
                        <div className="flex items-center justify-between px-2 pb-1 pt-1 relative z-20">
                            <div className="flex items-center gap-2">
                                {/* 模型选择 */}
                                <div className="relative group/model">
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400">
                                        <span>{currentModelLabel}</span>
                                        <ChevronDown size={10} />
                                    </div>
                                    <div className="absolute bottom-full left-0 pb-2 w-40 opacity-0 translate-y-2 pointer-events-none group-hover/model:opacity-100 group-hover/model:translate-y-0 group-hover/model:pointer-events-auto transition-all duration-200 z-[200]">
                                        <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                                            {models.map(m => (
                                                <div key={m.v} onClick={() => onUpdate(node.id, { model: m.v })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${node.data.model === m.v ? 'text-amber-500 dark:text-amber-400 bg-slate-50 dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300'}`}>{m.l}</div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {/* 素材状态指示 */}
                                {hasUpstreamMedia && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30">
                                        已连接素材
                                    </span>
                                )}
                            </div>
                            {/* 执行按钮 */}
                            <button
                                onClick={handleExecute}
                                disabled={isWorking || (!hasUpstreamMedia && !localPrompt.trim())}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-[12px] font-bold text-[10px] tracking-wide transition-all duration-300 ${isWorking
                                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:shadow-lg hover:shadow-amber-500/20 hover:scale-105 active:scale-95'
                                    }`}
                            >
                                {isWorking ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
                                <span>{isWorking ? '处理中...' : 'AI 执行'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // 音频节点使用专用面板
        if (node.type === NodeType.AUDIO_GENERATOR) {
            return (
                <AudioNodePanel
                    node={node}
                    isOpen={isOpen}
                    isWorking={isWorking}
                    localPrompt={localPrompt}
                    setLocalPrompt={setLocalPrompt}
                    inputHeight={inputHeight}
                    inverseScale={inverseScale}
                    onUpdate={onUpdate}
                    onAction={handleActionClick}
                    onInputFocus={() => setIsInputFocused(true)}
                    onInputBlur={() => { setIsInputFocused(false); commitPrompt(); }}
                    onInputResizeStart={handleInputResizeStart}
                    onCmdEnter={handleCmdEnter}
                />
            );
        }

        // 结果节点：显示提示词+模型信息（只读）
        const hasMediaResult = !!(node.data.image || node.data.videoUri);
        if (hasMediaResult && !isEditingResult) {
            const promptText = node.data.prompt || '';
            const MODEL_LABELS: Record<string, string> = { 'doubao-seedream-4-5-251128': 'Seedream 4.5', 'nano-banana': 'Nano Banana', 'nano-banana-pro': 'Nano Pro', 'veo3.1': 'Veo 3.1', 'veo3.1-pro': 'Veo 3.1 Pro', 'doubao-seedance-1-5-pro-251215': 'Seedance 1.5' };
            const modelName = MODEL_LABELS[node.data.model || ''] || node.data.model || '默认';
            const tags = [node.data.aspectRatio, node.data.resolution].filter(Boolean);

            const handleCopy = () => { navigator.clipboard.writeText(promptText); setPromptCopied(true); setTimeout(() => setPromptCopied(false), 1500); };

            return (
                <div className={`absolute top-full left-1/2 w-[98%] z-50 transition-all duration-500 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
                    style={{
                        paddingTop: `${8 * inverseScale}px`,
                        transform: `translateX(-50%) scale(${inverseScale})`,
                        transformOrigin: 'top center'
                    }}
                >
                    <div className={`rounded-[20px] p-1 ${GLASS_PANEL}`} onMouseDown={e => e.stopPropagation()}>
                        <div className="bg-white dark:bg-slate-800 rounded-[16px] p-3">
                            {/* 模型+配置+复制 */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">{modelName}</span>
                                {tags.map((t, i) => <span key={i} className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 px-1.5 py-0.5 rounded">{t}</span>)}
                                {promptText && (
                                    <button onClick={handleCopy} className={`ml-auto p-1 rounded transition-colors ${promptCopied ? 'text-green-500 dark:text-green-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`} title="复制">
                                        {promptCopied ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                )}
                            </div>
                            {/* 提示词 */}
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">{promptText || <span className="text-slate-400 dark:text-slate-500 italic">无提示词</span>}</p>
                        </div>
                    </div>
                </div>
            );
        }

        let models: { l: string, v: string, group?: string }[] = [];
        if (node.type === NodeType.VIDEO_GENERATOR || node.type === NodeType.VIDEO_FACTORY) {
            // 视频生成模型
            models = [
                // Veo 3.1 系列
                { l: 'Veo 3.1', v: 'veo3.1' },
                { l: 'Veo 3.1 Pro', v: 'veo3.1-pro' },
                { l: 'Veo 3.1 多图参考', v: 'veo3.1-components' },
                // Seedance (火山引擎)
                { l: 'Seedance 1.5 Pro', v: 'doubao-seedance-1-5-pro-251215' },
            ];
        } else {
            // 图像生成模型
            models = [
                { l: 'Seedream 4.5', v: 'doubao-seedream-4-5-251128' },
                { l: 'Nano Banana', v: 'nano-banana' },
                { l: 'Nano Banana Pro', v: 'nano-banana-pro' },
            ];
        }

        // 获取默认模型名称（当 node.data.model 未设置时）
        const defaultModel = models[0];
        const currentModelLabel = models.find(m => m.v === node.data.model)?.l || defaultModel?.l || 'AI Model';

        // 剧情延展模式：底部缩略图显示已选取的关键帧而非上游视频
        const isCutOrContinueMode = node.type === NodeType.VIDEO_FACTORY && (generationMode === 'CUT' || generationMode === 'CONTINUE');
        const thumbnailAssets: InputAsset[] = isCutOrContinueMode && node.data.croppedFrame
            ? [{ id: 'croppedFrame', type: 'image', src: node.data.croppedFrame }]
            : (inputAssets || []);
        const showThumbnails = isCutOrContinueMode ? !!node.data.croppedFrame : hasInputs;

        return (
            <div data-config-panel className={`absolute top-full left-1/2 w-[98%] z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? `opacity-100 translate-y-0 scale-100` : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}
                style={{
                    paddingTop: `${8 * inverseScale}px`,
                    transform: `translateX(-50%) scale(${inverseScale})`,
                    transformOrigin: 'top center'
                }}
            >
                {/* Glass Panel: Set strict Z-Index to higher layer to overlap thumbnails */}
                <div className={`w-full rounded-[20px] p-1 flex flex-col gap-1 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
                    <div className="relative group/input bg-white dark:bg-slate-800 rounded-[16px] flex flex-col overflow-hidden">
                        {/* InputThumbnails: CUT/CONTINUE显示croppedFrame，其他模式显示上游输入 */}
                        {showThumbnails && (<div className="w-full px-1 pt-1 z-10"><InputThumbnails assets={thumbnailAssets} onReorder={isCutOrContinueMode ? () => { } : (newOrder) => onInputReorder?.(node.id, newOrder)} /></div>)}
                        <textarea className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-500/60 dark:placeholder-slate-400/60 p-3 focus:outline-none resize-none custom-scrollbar font-medium leading-relaxed" style={{ height: `${Math.min(inputHeight, 200)}px` }} placeholder="描述您的修改或生成需求..." value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)} onBlur={() => { setIsInputFocused(false); commitPrompt(); }} onKeyDown={handleCmdEnter} onFocus={() => setIsInputFocused(true)} onMouseDown={e => e.stopPropagation()} readOnly={isWorking} />
                        <div className="absolute bottom-0 left-0 w-full h-3 cursor-row-resize flex items-center justify-center opacity-0 group-hover/input:opacity-100 transition-opacity" onMouseDown={handleInputResizeStart}><div className="w-8 h-1 rounded-full bg-slate-100 dark:bg-slate-700 group-hover/input:bg-slate-200 dark:group-hover/input:bg-slate-600" /></div>
                    </div>
                    <div className="flex items-center justify-between px-2 pb-1 pt-1 relative z-20">
                        <div className="flex items-center gap-2">
                            <div className="relative group/model">
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-400 dark:hover:text-blue-300"><span>{currentModelLabel}</span><ChevronDown size={10} /></div>
                                <div className="absolute bottom-full left-0 pb-2 w-40 opacity-0 translate-y-2 pointer-events-none group-hover/model:opacity-100 group-hover/model:translate-y-0 group-hover/model:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">{models.map(m => (<div key={m.v} onClick={() => onUpdate(node.id, { model: m.v })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${node.data.model === m.v ? 'text-blue-400 dark:text-blue-300 bg-slate-50 dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300'}`}>{m.l}</div>))}</div></div>
                            </div>
                            {/* 比例选择 - 有素材时只读，无素材时可选择 */}
                            {(() => {
                                const isImageNode = node.type.includes('IMAGE');
                                const modelConfig = isImageNode ? getImageModelConfig(node.data.model || '') : null;
                                const showAspectRatio = !isImageNode || modelConfig?.supportsAspectRatio;
                                const aspectRatios = isImageNode && modelConfig?.aspectRatios ? modelConfig.aspectRatios : (node.type.includes('VIDEO') ? VIDEO_ASPECT_RATIOS : IMAGE_ASPECT_RATIOS);
                                const defaultRatio = modelConfig?.defaultAspectRatio || '16:9';
                                // 有素材时比例只读
                                const hasMedia = !!(node.data.image || node.data.videoUri);

                                if (!showAspectRatio) return null;

                                // 有素材时显示只读比例
                                if (hasMedia) {
                                    return (
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                            <Scaling size={12} /><span>{node.data.aspectRatio || defaultRatio}</span>
                                        </div>
                                    );
                                }

                                // 无素材时可选择比例
                                return (
                                    <div className="relative group/ratio">
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-400 dark:hover:text-blue-300">
                                            <Scaling size={12} /><span>{node.data.aspectRatio || defaultRatio}</span>
                                        </div>
                                        <div className="absolute bottom-full left-0 pb-2 w-20 opacity-0 translate-y-2 pointer-events-none group-hover/ratio:opacity-100 group-hover/ratio:translate-y-0 group-hover/ratio:pointer-events-auto transition-all duration-200 z-[200]">
                                            <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                                                {aspectRatios.map(r => (
                                                    <div key={r} onClick={() => handleAspectRatioSelect(r)} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${node.data.aspectRatio === r ? 'text-blue-400 dark:text-blue-300 bg-slate-50 dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300'}`}>{r}</div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            {/* 分辨率选择 - 根据模型配置显示 */}
                            {(() => {
                                const isImageNode = node.type.includes('IMAGE');
                                const modelConfig = isImageNode ? getImageModelConfig(node.data.model || '') : null;
                                const showResolution = isImageNode ? modelConfig?.supportsResolution : (node.type === NodeType.VIDEO_GENERATOR || node.type === NodeType.VIDEO_FACTORY);
                                const resolutions = isImageNode && modelConfig?.resolutions ? modelConfig.resolutions : (node.type.includes('IMAGE') ? IMAGE_RESOLUTIONS : VIDEO_RESOLUTIONS);
                                const defaultRes = modelConfig?.defaultResolution || (node.type.includes('IMAGE') ? '1k' : '720p');

                                return showResolution && (
                                    <div className="relative group/resolution">
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-400 dark:hover:text-blue-300">
                                            <Monitor size={12} /><span>{node.data.resolution || defaultRes}</span>
                                        </div>
                                        <div className="absolute bottom-full left-0 pb-2 w-20 opacity-0 translate-y-2 pointer-events-none group-hover/resolution:opacity-100 group-hover/resolution:translate-y-0 group-hover/resolution:pointer-events-auto transition-all duration-200 z-[200]">
                                            <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                                                {resolutions.map(r => (
                                                    <div key={r} onClick={() => onUpdate(node.id, { resolution: r })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${node.data.resolution === r ? 'text-blue-400 dark:text-blue-300 bg-slate-50 dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300'}`}>{r}</div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            {/* 组图数量选择 - 仅图像生成节点显示 */}
                            {node.type === NodeType.IMAGE_GENERATOR && (
                                <div className="relative group/count">
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-400 dark:hover:text-blue-300">
                                        <Grid3X3 size={12} /><span>{node.data.imageCount || 1}张</span>
                                    </div>
                                    <div className="absolute bottom-full left-0 pb-2 w-20 opacity-0 translate-y-2 pointer-events-none group-hover/count:opacity-100 group-hover/count:translate-y-0 group-hover/count:pointer-events-auto transition-all duration-200 z-[200]">
                                        <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                                            {IMAGE_COUNTS.map(c => (
                                                <div key={c} onClick={() => onUpdate(node.id, { imageCount: c })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${(node.data.imageCount || 1) === c ? 'text-blue-400 dark:text-blue-300 bg-slate-50 dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300'}`}>{c}张</div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* 编辑模式下显示取消按钮 */}
                            {isEditingResult && (
                                <button
                                    onClick={() => setIsEditingResult(false)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-[12px] font-bold text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
                                >
                                    <X size={12} />
                                    <span>取消</span>
                                </button>
                            )}
                            <button onClick={handleActionClick} disabled={isWorking} className={`relative flex items-center gap-2 px-4 py-1.5 rounded-[12px] font-bold text-[10px] tracking-wide transition-all duration-300 ${isWorking ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-black hover:shadow-lg hover:shadow-cyan-500/20 hover:scale-105 active:scale-95'}`}>{isWorking ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}<span>{isWorking ? '生成中...' : '生成'}</span></button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const isInteracting = isDragging || isResizing || isGroupDragging;

    // 根据节点类型获取边框颜色（始终显示，不依赖内容）
    const getContentBorderColor = () => {
        // 文本节点 - 黄色
        if (node.type === NodeType.PROMPT_INPUT) {
            return 'ring-amber-400/80';
        }
        // 图片相关节点 - 蓝色
        if (node.type === NodeType.IMAGE_GENERATOR || node.type === NodeType.IMAGE_ASSET || node.type === NodeType.IMAGE_EDITOR) {
            return 'ring-blue-400/80';
        }
        // 视频相关节点 - 绿色
        if (node.type === NodeType.VIDEO_GENERATOR || node.type === NodeType.VIDEO_FACTORY || node.type === NodeType.VIDEO_ASSET) {
            return 'ring-green-400/80';
        }
        // 音频节点 - 红色
        if (node.type === NodeType.AUDIO_GENERATOR) {
            return 'ring-red-400/80';
        }
        // 默认
        return 'ring-slate-300/80';
    };
    const contentBorderColor = getContentBorderColor();

    // 组图宫格计算
    const gridItems = node.data.images || node.data.videoUris || [];
    const hasGrid = gridItems.length > 1;
    const gridCols = 2;
    const gridRows = Math.ceil(gridItems.length / gridCols);
    const gap = 4;
    const gridPadding = 4;
    const gridWidth = gridCols * nodeWidth + (gridCols - 1) * gap + gridPadding * 2;
    const gridHeight = gridRows * nodeHeight + (gridRows - 1) * gap + gridPadding * 2;

    // 展开时使用网格尺寸，否则使用节点尺寸
    const displayWidth = (hasGrid && showImageGrid) ? gridWidth : nodeWidth;
    const displayHeight = (hasGrid && showImageGrid) ? gridHeight : nodeHeight;

    return (
        <>
            <div
                ref={nodeRef}
                className={`absolute rounded-[24px] group ring-2 ${contentBorderColor} ${isSelected ? 'ring-[3px] shadow-[0_20px_60px_rgba(59,130,246,0.15)]' : 'hover:ring-[3px]'}`}
                style={{
                    left: 0, top: 0, width: displayWidth, height: displayHeight,
                    transform: `translate(${node.x}px, ${node.y}px)`,
                    zIndex: isSelected ? 60 : (isHovered ? 55 : 10),
                    background: isDarkMode
                        ? (isSelected ? 'rgba(30, 41, 59, 0.96)' : 'rgba(15, 23, 42, 0.9)')
                        : (isSelected ? 'rgba(255, 255, 255, 0.96)' : 'rgba(250, 250, 255, 0.9)'),
                    transition: isInteracting ? 'none' : 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), width 0.5s cubic-bezier(0.32, 0.72, 0, 1), height 0.5s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.3s',
                    backdropFilter: isInteracting ? 'none' : 'blur(18px)',
                    boxShadow: isInteracting ? 'none' : `0 0 0 ${(isSelected || isHovered ? 3 : 2) * inverseScale}px var(--tw-ring-color)${isSelected ? ', 0 20px 60px rgba(59,130,246,0.15)' : ''}`,
                    willChange: isInteracting ? 'transform' : 'auto'
                }}
                onMouseDown={(e) => onNodeMouseDown(e, node.id)} onMouseEnter={() => !isInteracting && setIsHovered(true)} onMouseLeave={() => !isInteracting && setIsHovered(false)} onContextMenu={(e) => onNodeContextMenu(e, node.id)}
            >
                {renderTopBar()}
                {/* 左连接点 - 生成节点/提示词节点可双击/拖拽创建上游节点，素材节点不显示 */}
                {(() => {
                    // 素材节点不需要左连接点
                    const isAssetNode = node.type === NodeType.IMAGE_ASSET || node.type === NodeType.VIDEO_ASSET;
                    if (isAssetNode) return null;

                    // 生成节点（图像/视频）支持左连接点交互创建上游节点
                    const isGeneratorNode = node.type === NodeType.IMAGE_GENERATOR ||
                        node.type === NodeType.VIDEO_GENERATOR ||
                        node.type === NodeType.VIDEO_FACTORY;

                    // 提示词节点也支持左连接点（连接图片/视频进行分析）
                    const isPromptNode = node.type === NodeType.PROMPT_INPUT;
                    const hasInputPortAction = isGeneratorNode || isPromptNode;

                    const handleInputDoubleClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (hasInputPortAction && onInputPortAction) {
                            onInputPortAction(node.id, { x: e.clientX, y: e.clientY });
                        }
                    };

                    const handleInputMouseUp = (e: React.MouseEvent) => {
                        // 先保存连接状态，因为 onPortMouseUp 会清除它
                        const wasConnecting = isConnecting;
                        onPortMouseUp(e, node.id, 'input');
                        // 如果是从其他节点拖拽释放到生成节点/提示词节点的输入端口，弹出创建菜单
                        if (hasInputPortAction && onInputPortAction && wasConnecting) {
                            onInputPortAction(node.id, { x: e.clientX, y: e.clientY });
                        }
                    };

                    // 左连接点统一绿色，无状态灰色
                    const portColorClass = hasInputPortAction
                        ? 'w-5 h-5 border-green-400 hover:scale-150 hover:bg-green-500 hover:border-green-500 group/input'
                        : 'w-4 h-4 border-slate-300 dark:border-slate-600 hover:scale-125';
                    const iconColorClass = hasInputPortAction
                        ? 'text-green-400 group-hover/input:text-white'
                        : 'text-slate-400';

                    return (
                        <div
                            className={`absolute -left-3 top-1/2 -translate-y-1/2 rounded-full border bg-white dark:bg-slate-800 flex items-center justify-center transition-all duration-300 cursor-crosshair z-50 shadow-md
                                ${portColorClass}
                                ${isConnecting ? 'ring-2 ring-cyan-400 animate-pulse' : ''}`}
                            style={{
                                left: `${-12 * inverseScale}px`,
                                transform: `translateY(-50%) scale(${inverseScale})`,
                                transformOrigin: 'center center'
                            }}
                            onMouseDown={(e) => onPortMouseDown(e, node.id, 'input')}
                            onMouseUp={handleInputMouseUp}
                            onDoubleClick={handleInputDoubleClick}
                            title={isPromptNode ? "双击添加媒体分析" : isGeneratorNode ? "双击添加输入节点" : "Input"}
                        >
                            <Plus size={hasInputPortAction ? 12 : 10} strokeWidth={3} className={`transition-colors ${iconColorClass}`} />
                        </div>
                    );
                })()}
                {/* 右连接点 - 有媒体结果或提示词时增强交互，统一蓝色 */}
                {(() => {
                    const hasMedia = !!(node.data.image || node.data.videoUri);
                    // 提示词节点：有内容时可以创建下游生成节点
                    const isPromptNode = node.type === NodeType.PROMPT_INPUT;
                    const hasPromptContent = isPromptNode && !!(node.data.prompt && node.data.prompt.trim());
                    // 有输出能力：有媒体结果 或 提示词节点有内容
                    const hasOutputAction = hasMedia || hasPromptContent;

                    // 右连接点统一蓝色，无状态灰色
                    const portColorClass = hasOutputAction
                        ? 'w-5 h-5 border-blue-400 hover:scale-150 hover:bg-blue-500 hover:border-blue-500 group/output'
                        : 'w-4 h-4 border-slate-300 dark:border-slate-600 hover:scale-125';
                    const iconColorClass = hasOutputAction
                        ? 'text-blue-400 group-hover/output:text-white'
                        : 'text-slate-400';

                    const handleOutputDoubleClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (hasOutputAction && onOutputPortAction) {
                            onOutputPortAction(node.id, { x: e.clientX, y: e.clientY });
                        }
                    };
                    const handleOutputMouseUp = (e: React.MouseEvent) => {
                        // 先保存连接状态，因为 onPortMouseUp 会清除它
                        const wasConnecting = isConnecting;
                        onPortMouseUp(e, node.id, 'output');
                        // 如果是拖拽释放且有输出能力，也触发选框
                        if (hasOutputAction && onOutputPortAction && wasConnecting) {
                            onOutputPortAction(node.id, { x: e.clientX, y: e.clientY });
                        }
                    };
                    return (
                        <div
                            className={`absolute -right-3 top-1/2 -translate-y-1/2 rounded-full border bg-white dark:bg-slate-800 flex items-center justify-center transition-all duration-300 cursor-crosshair z-50 shadow-md
                                ${portColorClass}
                                ${isConnecting ? 'ring-2 ring-purple-400 animate-pulse' : ''}`}
                            style={{
                                right: `${-12 * inverseScale}px`,
                                transform: `translateY(-50%) scale(${inverseScale})`,
                                transformOrigin: 'center center'
                            }}
                            onMouseDown={(e) => onPortMouseDown(e, node.id, 'output')}
                            onMouseUp={handleOutputMouseUp}
                            onDoubleClick={handleOutputDoubleClick}
                            title={hasOutputAction ? "双击或拖拽创建下游节点" : "Output"}
                        >
                            <Plus size={hasOutputAction ? 12 : 10} strokeWidth={3} className={`transition-colors ${iconColorClass}`} />
                        </div>
                    );
                })()}
                <div className="w-full h-full flex flex-col relative rounded-[24px] overflow-hidden bg-white dark:bg-slate-800">
                    {/* 展开时显示网格，收起时显示单图 */}
                    {hasGrid && showImageGrid ? (
                        <div className="w-full h-full p-1 relative">
                            <button
                                className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                                onClick={() => setShowImageGrid(false)}
                            >
                                <X size={14} className="text-white" />
                            </button>
                            <div className="w-full h-full grid grid-cols-2" style={{ gap }}>
                                {node.data.images ? node.data.images.map((img, idx) => {
                                    const isItemSelected = img === node.data.image;
                                    const handleMouseDown = (e: React.MouseEvent) => {
                                        const isCopyDrag = e.ctrlKey || e.metaKey;
                                        if (!isCopyDrag) {
                                            e.stopPropagation();
                                            onUpdate(node.id, { image: img });
                                            setShowImageGrid(false);
                                            return;
                                        }
                                        e.stopPropagation();
                                        e.preventDefault();
                                        const startX = e.clientX, startY = e.clientY;
                                        let hasMoved = false;
                                        const onMove = (me: MouseEvent) => {
                                            if (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5) {
                                                if (!hasMoved) { hasMoved = true; setGridDragState({ isDragging: true, src: img, type: 'image' }); }
                                                onGridDragStateChange?.({ isDragging: true, type: 'image', src: img, screenX: me.clientX, screenY: me.clientY });
                                            }
                                        };
                                        const onUp = (ue: MouseEvent) => {
                                            window.removeEventListener('mousemove', onMove);
                                            window.removeEventListener('mouseup', onUp);
                                            document.body.style.cursor = '';
                                            onGridDragStateChange?.(null);
                                            if (hasMoved && onDragResultToCanvas) { onDragResultToCanvas(node.id, 'image', img, ue.clientX, ue.clientY); setShowImageGrid(false); }
                                            setGridDragState(null);
                                        };
                                        document.body.style.cursor = 'copy';
                                        window.addEventListener('mousemove', onMove);
                                        window.addEventListener('mouseup', onUp);
                                    };
                                    return (
                                        <div
                                            key={idx}
                                            className={`relative overflow-hidden cursor-pointer rounded-[20px] ${isItemSelected ? 'ring-4 ring-blue-500 ring-inset' : 'hover:brightness-95 hover:ring-2 hover:ring-cyan-400'} transition-all group/item`}
                                            onMouseDown={handleMouseDown}
                                        >
                                            <img src={img} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                                            {isItemSelected && (
                                                <div className="absolute top-2 left-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow">
                                                    <CheckCircle size={12} className="text-white" />
                                                </div>
                                            )}
                                            <div className="absolute bottom-2 right-2 opacity-0 group-hover/item:opacity-100 transition-opacity bg-black/50 px-2 py-1 rounded-lg flex items-center gap-1">
                                                <Copy size={10} className="text-white" />
                                                <span className="text-[9px] text-white font-medium">⌘+拖拽复制</span>
                                            </div>
                                        </div>
                                    );
                                }) : node.data.videoUris?.map((uri, idx) => {
                                    const isItemSelected = uri === node.data.videoUri;
                                    const handleMouseDown = (e: React.MouseEvent) => {
                                        const isCopyDrag = e.ctrlKey || e.metaKey;
                                        if (!isCopyDrag) {
                                            e.stopPropagation();
                                            onUpdate(node.id, { videoUri: uri });
                                            setShowImageGrid(false);
                                            return;
                                        }
                                        e.stopPropagation();
                                        e.preventDefault();
                                        const startX = e.clientX, startY = e.clientY;
                                        let hasMoved = false;
                                        const onMove = (me: MouseEvent) => {
                                            if (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5) {
                                                if (!hasMoved) { hasMoved = true; setGridDragState({ isDragging: true, src: uri, type: 'video' }); }
                                                onGridDragStateChange?.({ isDragging: true, type: 'video', src: uri, screenX: me.clientX, screenY: me.clientY });
                                            }
                                        };
                                        const onUp = (ue: MouseEvent) => {
                                            window.removeEventListener('mousemove', onMove);
                                            window.removeEventListener('mouseup', onUp);
                                            document.body.style.cursor = '';
                                            onGridDragStateChange?.(null);
                                            if (hasMoved && onDragResultToCanvas) { onDragResultToCanvas(node.id, 'video', uri, ue.clientX, ue.clientY); setShowImageGrid(false); }
                                            setGridDragState(null);
                                        };
                                        document.body.style.cursor = 'copy';
                                        window.addEventListener('mousemove', onMove);
                                        window.addEventListener('mouseup', onUp);
                                    };
                                    return (
                                        <div
                                            key={idx}
                                            className={`relative overflow-hidden cursor-pointer rounded-[20px] ${isItemSelected ? 'ring-4 ring-emerald-500 ring-inset' : 'hover:brightness-95 hover:ring-2 hover:ring-cyan-400'} transition-all group/item`}
                                            onMouseDown={handleMouseDown}
                                        >
                                            <video src={uri} className="w-full h-full object-cover pointer-events-none" muted />
                                            {isItemSelected && (
                                                <div className="absolute top-2 left-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow">
                                                    <CheckCircle size={12} className="text-white" />
                                                </div>
                                            )}
                                            <div className="absolute bottom-2 right-2 opacity-0 group-hover/item:opacity-100 transition-opacity bg-black/50 px-2 py-1 rounded-lg flex items-center gap-1">
                                                <Copy size={10} className="text-white" />
                                                <span className="text-[9px] text-white font-medium">⌘+拖拽复制</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 relative bg-white dark:bg-slate-800">{renderMediaContent()}</div>
                    )}
                </div>
                {!isGridAnimating && renderBottomPanel()}
                <div className="absolute -bottom-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize text-slate-500 hover:text-slate-900 transition-colors opacity-0 group-hover:opacity-100 z-50" onMouseDown={(e) => onResizeMouseDown(e, node.id, nodeWidth, nodeHeight)}><div className="w-1.5 h-1.5 rounded-full bg-current" /></div>
            </div>
        </>
    );
};

export const Node = memo(NodeComponent, arePropsEqual);
