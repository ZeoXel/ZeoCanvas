"use client";

// ... existing imports
import { AppNode, NodeStatus, NodeType, AudioGenerationMode } from '@/types';
import { RefreshCw, Play, Image as ImageIcon, Video as VideoIcon, Type, AlertCircle, CheckCircle, Plus, Maximize2, Download, MoreHorizontal, Wand2, Scaling, FileSearch, Edit, Loader2, Layers, Trash2, X, Upload, Scissors, Film, MousePointerClick, Crop as CropIcon, ChevronDown, ChevronUp, GripHorizontal, Link, Copy, Monitor, Music, Pause, Volume2, Mic2, Grid3X3, Check } from 'lucide-react';
import { SceneDirectorOverlay } from './VideoNodeModules';
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
    onCrop?: (id: string, imageBase64: string) => void;
    onNodeMouseDown: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, id: string, type: 'input' | 'output') => void;
    onPortMouseUp: (e: React.MouseEvent, id: string, type: 'input' | 'output') => void;
    onOutputPortAction?: (nodeId: string, position: { x: number, y: number }) => void; // 双击/拖拽释放右连接点时触发
    onNodeContextMenu: (e: React.MouseEvent, id: string) => void;
    onMediaContextMenu?: (e: React.MouseEvent, nodeId: string, type: 'image' | 'video', src: string) => void;
    onResizeMouseDown: (e: React.MouseEvent, id: string, initialWidth: number, initialHeight: number) => void;
    onDragResultToCanvas?: (sourceNodeId: string, type: 'image' | 'video', src: string, canvasX: number, canvasY: number) => void; // 从组图宫格拖拽结果到画布
    onGridDragStateChange?: (state: { isDragging: boolean; type?: 'image' | 'video'; src?: string; screenX?: number; screenY?: number } | null) => void; // 通知父组件拖拽状态变化
    inputAssets?: InputAsset[];
    onInputReorder?: (nodeId: string, newOrder: string[]) => void;

    isDragging?: boolean;
    isGroupDragging?: boolean;
    isSelected?: boolean;
    isResizing?: boolean;
    isConnecting?: boolean;
    // 拖拽偏移量：用 transform 实现流畅拖拽
    dragOffset?: { x: number, y: number };
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
const GLASS_PANEL = "bg-[#ffffff]/95 backdrop-blur-2xl border border-slate-300 shadow-2xl";
const DEFAULT_NODE_WIDTH = 420;
const DEFAULT_FIXED_HEIGHT = 360;
const AUDIO_NODE_HEIGHT = 200;

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

const SecureVideo = ({ src, className, autoPlay, muted, loop, onMouseEnter, onMouseLeave, onClick, controls, videoRef, style }: any) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!src) return;
        if (src.startsWith('data:') || src.startsWith('blob:')) {
            setBlobUrl(src);
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
                    setBlobUrl(url);
                }
            })
            .catch(err => {
                console.error("SecureVideo load error:", err);
                if (active) setError(true);
            });

        return () => {
            active = false;
            if (blobUrl && !blobUrl.startsWith('data:')) {
                URL.revokeObjectURL(blobUrl);
            }
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
        prev.isConnecting !== next.isConnecting) {
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
                                <SecureVideo src={asset.src} className="w-full h-full object-cover pointer-events-none select-none opacity-80 group-hover:opacity-100 transition-opacity bg-white" muted loop autoPlay />
                            ) : (
                                <img src={asset.src} className="w-full h-full object-cover pointer-events-none select-none opacity-80 group-hover:opacity-100 transition-opacity bg-white" alt="" />
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
    node, onUpdate, onAction, onDelete, onExpand, onCrop, onNodeMouseDown, onPortMouseDown, onPortMouseUp, onOutputPortAction, onNodeContextMenu, onMediaContextMenu, onResizeMouseDown, onDragResultToCanvas, onGridDragStateChange, inputAssets, onInputReorder, isDragging, isGroupDragging, isSelected, isResizing, isConnecting
}) => {
    const isWorking = node.status === NodeStatus.WORKING;
    const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | HTMLAudioElement | null>(null);
    const playPromiseRef = useRef<Promise<void> | null>(null);
    const isHoveringRef = useRef(false);
    const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const [showImageGrid, setShowImageGrid] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(node.title);
    const [isHovered, setIsHovered] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isEditingResult, setIsEditingResult] = useState(false); // 编辑已有结果的模式
    const generationMode = node.data.generationMode || 'CONTINUE';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [localPrompt, setLocalPrompt] = useState(node.data.prompt || '');
    const [inputHeight, setInputHeight] = useState(48);
    const isResizingInput = useRef(false);
    const inputStartDragY = useRef(0);
    const inputStartHeight = useRef(0);

    // 组图宫格拖拽状态 - 使用 ref 实现流畅的实时更新
    const [gridDragState, setGridDragState] = useState<{
        isDragging: boolean;
        src: string;
        type: 'image' | 'video';
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);
    const gridDragPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const ghostElementRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setLocalPrompt(node.data.prompt || ''); }, [node.data.prompt]);
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
        if ((node.type === NodeType.VIDEO_GENERATOR || node.type === NodeType.VIDEO_FACTORY || node.type === NodeType.VIDEO_ANALYZER) && node.data.videoUri) {
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
            a.download = `ls-studio-${Date.now()}.${ext}`;
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
                    if (Math.abs(w/h - 16/9) < 0.1) aspectRatio = '16:9';
                    else if (Math.abs(w/h - 9/16) < 0.1) aspectRatio = '9:16';
                    else if (Math.abs(w/h - 1) < 0.1) aspectRatio = '1:1';
                    else if (Math.abs(w/h - 4/3) < 0.1) aspectRatio = '4:3';
                    else if (Math.abs(w/h - 3/4) < 0.1) aspectRatio = '3:4';

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
                    if (Math.abs(w/h - 16/9) < 0.1) aspectRatio = '16:9';
                    else if (Math.abs(w/h - 9/16) < 0.1) aspectRatio = '9:16';
                    else if (Math.abs(w/h - 1) < 0.1) aspectRatio = '1:1';
                    else if (Math.abs(w/h - 4/3) < 0.1) aspectRatio = '4:3';
                    else if (Math.abs(w/h - 3/4) < 0.1) aspectRatio = '3:4';

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
        let newSize: { width?: number, height?: number } = { height: undefined };
        if (w && h) {
            const currentWidth = node.width || DEFAULT_NODE_WIDTH;
            const projectedHeight = (currentWidth * h) / w;
            if (projectedHeight > 600) newSize.width = (600 * w) / h;
        }
        onUpdate(node.id, { aspectRatio: newRatio }, newSize);
    };
    const handleTitleSave = () => { setIsEditingTitle(false); if (tempTitle.trim() && tempTitle !== node.title) onUpdate(node.id, {}, undefined, tempTitle); else setTempTitle(node.title); };

    const getNodeConfig = () => {
        switch (node.type) {
            case NodeType.PROMPT_INPUT: return { icon: Type, color: 'text-amber-400', border: 'border-amber-500/30' };
            case NodeType.IMAGE_GENERATOR: return { icon: ImageIcon, color: 'text-blue-400', border: 'border-blue-500/30' };
            case NodeType.VIDEO_GENERATOR: return { icon: VideoIcon, color: 'text-purple-400', border: 'border-purple-500/30' };
            case NodeType.VIDEO_FACTORY: return { icon: Film, color: 'text-violet-400', border: 'border-violet-500/30' };
            case NodeType.AUDIO_GENERATOR: return { icon: Mic2, color: 'text-pink-400', border: 'border-pink-500/30' };
            case NodeType.VIDEO_ANALYZER: return { icon: FileSearch, color: 'text-emerald-400', border: 'border-emerald-500/30' };
            case NodeType.IMAGE_EDITOR: return { icon: Edit, color: 'text-rose-400', border: 'border-rose-500/30' };
            default: return { icon: Type, color: 'text-slate-600', border: 'border-slate-300' };
        }
    };
    const { icon: NodeIcon, color: iconColor } = getNodeConfig();

    const getNodeHeight = () => {
        if (node.height) return node.height;
        if (node.type === NodeType.VIDEO_ANALYZER || node.type === NodeType.IMAGE_EDITOR || node.type === NodeType.PROMPT_INPUT) return DEFAULT_FIXED_HEIGHT;
        if (node.type === NodeType.AUDIO_GENERATOR) return AUDIO_NODE_HEIGHT;
        const ratio = node.data.aspectRatio || '1:1';
        const [w, h] = ratio.split(':').map(Number);
        const extra = (node.type === NodeType.VIDEO_FACTORY && generationMode === 'CUT') ? 36 : 0;
        return ((node.width || DEFAULT_NODE_WIDTH) * h / w) + extra;
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
                            <button onClick={handleDownload} className="p-1.5 bg-white/70 border border-slate-300 backdrop-blur-md rounded-md text-slate-600 hover:text-slate-900 hover:border-white/30 transition-colors" title="下载"><Download size={14} /></button>
                            {node.type !== NodeType.AUDIO_GENERATOR && <button onClick={handleExpand} className="p-1.5 bg-white/70 border border-slate-300 backdrop-blur-md rounded-md text-slate-600 hover:text-slate-900 hover:border-white/30 transition-colors" title="全屏预览"><Maximize2 size={14} /></button>}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 pointer-events-auto">
                    {isWorking && <div className="bg-[#ffffff]/90 backdrop-blur-md p-1.5 rounded-full border border-slate-300"><Loader2 className="animate-spin w-3 h-3 text-blue-400" /></div>}
                    <div className={`px-2 py-1 flex items-center gap-2`}>
                        {isEditingTitle ? (
                            <input className="bg-transparent border-none outline-none text-slate-600 text-[10px] font-bold uppercase tracking-wider w-24 text-right" value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} onBlur={handleTitleSave} onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()} onMouseDown={e => e.stopPropagation()} autoFocus />
                        ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-700 cursor-text text-right" onClick={() => setIsEditingTitle(true)}>{node.title}</span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderMediaContent = () => {
        if (node.type === NodeType.PROMPT_INPUT) {
            // 简化的创意描述节点：单一文本输入框 + AI优化按钮
            const hasContent = localPrompt && localPrompt.trim().length > 0;
            return (
                <div className="w-full h-full p-3 flex flex-col gap-2 group/text">
                    {/* 统一的文本编辑区 */}
                    <div className="flex-1 bg-white rounded-[16px] border border-slate-200 relative overflow-hidden hover:border-cyan-300/50 focus-within:border-cyan-400 transition-colors">
                        <textarea
                            className="w-full h-full bg-transparent resize-none focus:outline-none text-xs text-slate-700 placeholder-slate-500/60 p-3 font-medium leading-relaxed custom-scrollbar"
                            placeholder="在此输入或编辑您的创意描述...&#10;&#10;可以直接手动编辑，也可以输入简短想法后点击下方「AI 优化」按钮让 AI 帮您扩写润色。"
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
                                className="absolute top-2 right-2 p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700 transition-all opacity-0 group-hover/text:opacity-100"
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(localPrompt); }}
                                title="复制内容"
                            >
                                <Copy size={12} />
                            </button>
                        )}
                    </div>
                    {/* 底部操作栏 */}
                    <div className="flex items-center justify-between px-2 py-1">
                        <span className="text-[10px] text-slate-500 font-bold">
                            {localPrompt.length > 0 ? `${localPrompt.length} 字` : ''}
                        </span>
                        <button
                            onClick={handleActionClick}
                            disabled={isWorking || !hasContent}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-[12px] font-bold text-[10px] tracking-wide transition-all duration-300 ${
                                isWorking
                                    ? 'bg-slate-50 text-slate-500 cursor-not-allowed'
                                    : hasContent
                                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-black hover:shadow-lg hover:shadow-cyan-500/20 hover:scale-105 active:scale-95'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {isWorking ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
                            <span>{isWorking ? '优化中...' : 'AI 优化'}</span>
                        </button>
                    </div>
                    {/* 加载遮罩 */}
                    {isWorking && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10 rounded-[24px]">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="animate-spin text-cyan-500" size={28} />
                                <span className="text-xs font-medium text-slate-600">AI 正在优化您的描述...</span>
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        if (node.type === NodeType.VIDEO_ANALYZER) {
            return (
                <div className="w-full h-full p-5 flex flex-col gap-3">
                    <div className="relative w-full h-32 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors group/upload" onClick={() => !node.data.videoUri && fileInputRef.current?.click()}>
                        {videoBlobUrl ? <video src={videoBlobUrl} className="w-full h-full object-cover opacity-80" muted onMouseEnter={safePlay} onMouseLeave={safePause} onClick={handleExpand} /> : <div className="flex flex-col items-center gap-2 text-slate-500 group-hover:upload:text-slate-600"><Upload size={20} /><span className="text-[10px] font-bold uppercase tracking-wider">上传视频</span></div>}
                        {node.data.videoUri && <button className="absolute top-2 right-2 p-1 bg-white/80 rounded-full text-slate-600 hover:text-slate-900 backdrop-blur-md" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}><Edit size={10} /></button>}
                        <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleUploadVideo} />
                    </div>
                    <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden relative group/analysis">
                        <textarea className="w-full h-full bg-transparent p-3 resize-none focus:outline-none text-xs text-slate-600 font-mono leading-relaxed custom-scrollbar select-text placeholder:italic placeholder:text-slate-600" value={node.data.analysis || ''} placeholder="等待分析结果，或在此粘贴文本..." onChange={(e) => onUpdate(node.id, { analysis: e.target.value })} onWheel={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} spellCheck={false} />
                        {node.data.analysis && <button className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white/90 border border-slate-300 rounded-md text-slate-600 hover:text-slate-900 transition-all opacity-0 group-hover/analysis:opacity-100 backdrop-blur-md z-10" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(node.data.analysis || ''); }} title="复制全部"><Copy size={12} /></button>}
                    </div>
                    {isWorking && <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10"><Loader2 className="animate-spin text-emerald-400" /></div>}
                </div>
            )
        }
        if (node.type === NodeType.AUDIO_GENERATOR) {
            const audioMode = node.data.audioMode || 'music';
            const isMusic = audioMode === 'music';
            const coverImage = node.data.musicConfig?.coverImage;

            return (
                <div className="w-full h-full p-4 flex flex-col justify-center items-center relative overflow-hidden group/audio">
                    {/* 背景渐变 - 根据模式变色 */}
                    <div className={`absolute inset-0 z-0 ${isMusic ? 'bg-gradient-to-br from-pink-500/10 to-purple-900/10' : 'bg-gradient-to-br from-cyan-500/10 to-blue-900/10'}`}></div>

                    {/* 封面图（音乐模式且有封面时显示） */}
                    {isMusic && coverImage && (
                        <div className="absolute inset-0 z-0">
                            <img src={coverImage} className="w-full h-full object-cover opacity-30 blur-sm" alt="" />
                        </div>
                    )}

                    {/* 模式指示器 */}
                    <div className={`absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${isMusic ? 'bg-pink-500/20 text-pink-600' : 'bg-blue-500/20 text-blue-600'}`}>
                        {isMusic ? <Music size={10} /> : <Mic2 size={10} />}
                        <span>{isMusic ? '音乐' : '语音'}</span>
                    </div>

                    {node.data.audioUri ? (
                        <div className="flex flex-col items-center gap-3 w-full z-10">
                            <audio ref={mediaRef as any} src={node.data.audioUri} onEnded={() => setIsPlayingAudio(false)} onPlay={() => setIsPlayingAudio(true)} onPause={() => setIsPlayingAudio(false)} className="hidden" />

                            {/* 歌曲标题（音乐模式） */}
                            {isMusic && node.data.musicConfig?.title && (
                                <div className="text-xs font-bold text-slate-700 text-center truncate max-w-full px-4">
                                    {node.data.musicConfig.title}
                                </div>
                            )}

                            {/* 音频可视化器 */}
                            <div className="w-full px-4"><AudioVisualizer isPlaying={isPlayingAudio} /></div>

                            {/* 播放控制 */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={toggleAudio}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${isMusic ? 'bg-pink-500/20 hover:bg-pink-500/40 border border-pink-500/50' : 'bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/50'}`}
                                >
                                    {isPlayingAudio ? <Pause size={18} className="text-slate-900" /> : <Play size={18} className="text-slate-900 ml-0.5" />}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 z-10 select-none">
                            {isWorking ? (
                                <Loader2 size={28} className={`animate-spin ${isMusic ? 'text-pink-500' : 'text-blue-500'}`} />
                            ) : (
                                <>
                                    {isMusic ? <Music size={28} className="text-slate-400" /> : <Mic2 size={28} className="text-slate-400" />}
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">准备生成</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* 错误显示 */}
                    {node.status === NodeStatus.ERROR && (
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center z-20">
                            <AlertCircle className="text-red-500 mb-2" size={24} />
                            <span className="text-[10px] text-red-500 leading-relaxed">{node.data.error}</span>
                        </div>
                    )}
                </div>
            )
        }

        const hasContent = node.data.image || node.data.videoUri;
        return (
            <div className="w-full h-full relative group/media overflow-hidden bg-white" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                {!hasContent ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600">
                        {node.type === NodeType.VIDEO_FACTORY && generationMode === 'CUT' ? (
                            // 局部分镜模式：提示在上游截取分镜帧
                            <>
                                <div className="w-20 h-20 rounded-[28px] bg-orange-50 border border-orange-200 flex items-center justify-center">
                                    {isWorking ? <Loader2 className="animate-spin text-orange-500" size={32} /> : <Scissors size={32} className="text-orange-400" />}
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-orange-500">{isWorking ? "处理中..." : "在上游视频截取分镜帧"}</span>
                            </>
                        ) : (
                            // 默认：上传或拖拽
                            <>
                                <div className="w-20 h-20 rounded-[28px] bg-slate-50 border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-100 hover:scale-105 transition-all duration-300 shadow-inner" onClick={() => fileInputRef.current?.click()}>
                                    {isWorking ? <Loader2 className="animate-spin text-blue-500" size={32} /> : (node.type === NodeType.VIDEO_GENERATOR ? <ImageIcon size={32} className="opacity-50" /> : <NodeIcon size={32} className="opacity-50" />)}
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">{isWorking ? "处理中..." : "拖拽或上传"}</span>
                                <input type="file" ref={fileInputRef} className="hidden" accept={node.type === NodeType.VIDEO_FACTORY ? "video/*" : "image/*"} onChange={node.type === NodeType.VIDEO_FACTORY ? handleUploadVideo : handleUploadImage} />
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        {node.data.image ?
                            <img ref={mediaRef as any} src={node.data.image} className="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-105 bg-white" draggable={false} style={{ filter: showImageGrid ? 'blur(10px)' : 'none' }} onContextMenu={(e) => onMediaContextMenu?.(e, node.id, 'image', node.data.image!)} />
                            :
                            <SecureVideo
                                videoRef={mediaRef} // Pass Ref to Video
                                src={node.data.videoUri}
                                className="w-full h-full object-cover bg-white"
                                loop
                                muted
                                // autoPlay removed to rely on hover logic
                                onContextMenu={(e: React.MouseEvent) => onMediaContextMenu?.(e, node.id, 'video', node.data.videoUri!)}
                                style={{ filter: showImageGrid ? 'blur(10px)' : 'none' }} // Pass Style
                            />
                        }
                        {/* 组图数量徽章 - 右上角显示 */}
                        {node.data.images && node.data.images.length > 1 && !showImageGrid && (
                            <button
                                className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-lg hover:bg-white hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer group/badge"
                                onClick={(e) => { e.stopPropagation(); setShowImageGrid(true); }}
                                title="点击查看全部结果"
                            >
                                <Grid3X3 size={12} className="text-slate-500 group-hover/badge:text-blue-500" />
                                <span className="text-xs font-bold text-slate-600 group-hover/badge:text-blue-600">{node.data.images.length}</span>
                            </button>
                        )}
                        {node.status === NodeStatus.ERROR && <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20"><AlertCircle className="text-red-500 mb-2" /><span className="text-xs text-red-200">{node.data.error}</span></div>}
                        {generationMode === 'CUT' && node.data.croppedFrame && <div className="absolute top-4 right-4 w-24 aspect-video bg-white/90 rounded-lg border border-purple-500/50 shadow-xl overflow-hidden z-20 hover:scale-150 transition-transform origin-top-right opacity-0 group-hover:opacity-100 transition-opacity duration-300"><img src={node.data.croppedFrame} className="w-full h-full object-cover" /></div>}
                        {generationMode === 'CUT' && !node.data.croppedFrame && hasInputs && inputAssets?.some(a => a.src) && (<div className="absolute top-4 right-4 w-24 aspect-video bg-white/90 rounded-lg border border-purple-500/30 border-dashed shadow-xl overflow-hidden z-20 hover:scale-150 transition-transform origin-top-right flex flex-col items-center justify-center group/preview opacity-0 group-hover:opacity-100 transition-opacity duration-300"><div className="absolute inset-0 bg-purple-500/10 z-10"></div>{(() => { const asset = inputAssets!.find(a => a.src); if (asset?.type === 'video') { return <SecureVideo src={asset.src} className="w-full h-full object-cover opacity-60 bg-white" muted autoPlay />; } else { return <img src={asset?.src} className="w-full h-full object-cover opacity-60 bg-white" />; } })()}<span className="absolute z-20 text-[8px] font-bold text-purple-500 bg-white/90 px-1 rounded">分镜参考</span></div>)}
                    </>
                )}
                {node.type === NodeType.VIDEO_FACTORY && generationMode === 'CUT' && (videoBlobUrl || node.data.videoUri) &&
                    <SceneDirectorOverlay
                        visible={true}
                        videoRef={mediaRef as React.RefObject<HTMLVideoElement>}
                        onCrop={() => {
                            const vid = mediaRef.current as HTMLVideoElement;
                            if (vid) { // Safety check to prevent null access
                                const canvas = document.createElement('canvas');
                                canvas.width = vid.videoWidth;
                                canvas.height = vid.videoHeight;
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                    ctx.drawImage(vid, 0, 0);
                                    onCrop?.(node.id, canvas.toDataURL('image/png'));
                                }
                            }
                        }}
                        onTimeHover={() => { }}
                    />
                }
            </div>
        );
    };

    // 复制状态 - 必须在组件顶层声明
    const [promptCopied, setPromptCopied] = useState(false);

    const renderBottomPanel = () => {
        // 创意描述节点不需要底部弹出框（已在节点内集成 AI 优化功能）
        if (node.type === NodeType.PROMPT_INPUT) return null;

        const isOpen = (isHovered || isInputFocused);

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
                    onUpdate={onUpdate}
                    onAction={handleActionClick}
                    onInputFocus={() => setIsInputFocused(true)}
                    onInputBlur={() => { setIsInputFocused(false); commitPrompt(); }}
                    onInputResizeStart={handleInputResizeStart}
                    onCmdEnter={handleCmdEnter}
                />
            );
        }

        // 结果节点：有生成结果的节点 → 显示提示词+模型信息+配置
        // 继续编辑功能已迁移到右连接点
        const hasMediaResult = !!(node.data.image || node.data.videoUri);

        if (hasMediaResult && !isEditingResult) {
            // 结果展示模式
            const promptText = node.data.prompt || '';
            const handleCopyPrompt = () => {
                navigator.clipboard.writeText(promptText);
                setPromptCopied(true);
                setTimeout(() => setPromptCopied(false), 1500);
            };

            // 进入编辑模式（不清除结果）
            const handleEnterEditMode = () => {
                setIsEditingResult(true);
            };

            // 模型名称映射
            const MODEL_LABELS: Record<string, string> = {
                'doubao-seedream-4-5-251128': 'Seedream 4.5',
                'nano-banana': 'Nano Banana',
                'nano-banana-pro': 'Nano Banana Pro',
                'veo3.1': 'Veo 3.1',
                'veo3.1-pro': 'Veo 3.1 Pro',
                'veo3.1-components': 'Veo 3.1 多图参考',
                'doubao-seedance-1-5-pro-251215': 'Seedance 1.5 Pro',
            };
            const modelName = node.data.model ? (MODEL_LABELS[node.data.model] || node.data.model) : '默认模型';

            // 收集配置标签
            const configTags: string[] = [];
            if (node.data.aspectRatio) configTags.push(node.data.aspectRatio);
            if (node.data.resolution) configTags.push(node.data.resolution);

            return (
                <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                    <div className={`w-full rounded-[20px] p-1 ${GLASS_PANEL}`} onMouseDown={e => e.stopPropagation()}>
                        <div className="relative bg-white rounded-[16px]">
                            {/* 模型与配置信息栏 */}
                            <div className="flex items-center gap-2 px-3 pt-2 pb-1 border-b border-slate-100">
                                <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md">
                                    {modelName}
                                </span>
                                {configTags.map((tag, idx) => (
                                    <span key={idx} className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            {/* 提示词内容 */}
                            <div className="p-3">
                                <p className="text-xs text-slate-700 font-medium leading-relaxed line-clamp-4 break-words">
                                    {promptText || <span className="text-slate-400 italic">无提示词</span>}
                                </p>
                            </div>
                            {/* 底部操作栏 */}
                            <div className="flex items-center justify-end gap-1 px-2 pb-2 pt-1 border-t border-slate-100">
                                {promptText && (
                                    <button
                                        onClick={handleCopyPrompt}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all duration-200 ${
                                            promptCopied
                                                ? 'bg-green-100 text-green-600'
                                                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
                                        }`}
                                        title={promptCopied ? '已复制' : '复制提示词'}
                                    >
                                        {promptCopied ? <Check size={12} /> : <Copy size={12} />}
                                        <span>{promptCopied ? '已复制' : '复制'}</span>
                                    </button>
                                )}
                                <button
                                    onClick={handleEnterEditMode}
                                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-bold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-200"
                                    title="重新生成：进入编辑模式，可修改配置后重新生成"
                                >
                                    <RefreshCw size={12} />
                                    <span>重新生成</span>
                                </button>
                            </div>
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
        } else if (node.type === NodeType.VIDEO_ANALYZER) {
            models = [{ l: 'Gemini 2.5 Flash', v: 'gemini-2.5-flash' }];
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

        return (
            <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? `opacity-100 translate-y-0 scale-100` : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                {/* InputThumbnails: Set strict Z-Index to lower layer */}
                {hasInputs && onInputReorder && (<div className="w-full flex justify-center mb-2 z-0 relative"><InputThumbnails assets={inputAssets!} onReorder={(newOrder) => onInputReorder(node.id, newOrder)} /></div>)}
                {/* Glass Panel: Set strict Z-Index to higher layer to overlap thumbnails */}
                <div className={`w-full rounded-[20px] p-1 flex flex-col gap-1 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
                    <div className="relative group/input bg-white rounded-[16px]">
                        <textarea className="w-full bg-transparent text-xs text-slate-700 placeholder-slate-500/60 p-3 focus:outline-none resize-none custom-scrollbar font-medium leading-relaxed" style={{ height: `${Math.min(inputHeight, 200)}px` }} placeholder="描述您的修改或生成需求..." value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)} onBlur={() => { setIsInputFocused(false); commitPrompt(); }} onKeyDown={handleCmdEnter} onFocus={() => setIsInputFocused(true)} onMouseDown={e => e.stopPropagation()} readOnly={isWorking} />
                        <div className="absolute bottom-0 left-0 w-full h-3 cursor-row-resize flex items-center justify-center opacity-0 group-hover/input:opacity-100 transition-opacity" onMouseDown={handleInputResizeStart}><div className="w-8 h-1 rounded-full bg-slate-100 group-hover/input:bg-slate-200" /></div>
                    </div>
                    <div className="flex items-center justify-between px-2 pb-1 pt-1 relative z-20">
                        <div className="flex items-center gap-2">
                            <div className="relative group/model">
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors text-[10px] font-bold text-slate-600 hover:text-blue-400"><span>{currentModelLabel}</span><ChevronDown size={10} /></div>
                                <div className="absolute bottom-full left-0 pb-2 w-40 opacity-0 translate-y-2 pointer-events-none group-hover/model:opacity-100 group-hover/model:translate-y-0 group-hover/model:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden">{models.map(m => (<div key={m.v} onClick={() => onUpdate(node.id, { model: m.v })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-slate-100 ${node.data.model === m.v ? 'text-blue-400 bg-slate-50' : 'text-slate-600'}`}>{m.l}</div>))}</div></div>
                            </div>
                            {/* 比例选择 - 有素材时只读，无素材时可选择 */}
                            {(() => {
                                const isImageNode = node.type.includes('IMAGE');
                                const modelConfig = isImageNode ? getImageModelConfig(node.data.model || '') : null;
                                const showAspectRatio = node.type !== NodeType.VIDEO_ANALYZER && (!isImageNode || modelConfig?.supportsAspectRatio);
                                const aspectRatios = isImageNode && modelConfig?.aspectRatios ? modelConfig.aspectRatios : (node.type.includes('VIDEO') ? VIDEO_ASPECT_RATIOS : IMAGE_ASPECT_RATIOS);
                                const defaultRatio = modelConfig?.defaultAspectRatio || '16:9';
                                // 有素材时比例只读
                                const hasMedia = !!(node.data.image || node.data.videoUri);

                                if (!showAspectRatio) return null;

                                // 有素材时显示只读比例
                                if (hasMedia) {
                                    return (
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-400">
                                            <Scaling size={12} /><span>{node.data.aspectRatio || defaultRatio}</span>
                                        </div>
                                    );
                                }

                                // 无素材时可选择比例
                                return (
                                    <div className="relative group/ratio">
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors text-[10px] font-bold text-slate-600 hover:text-blue-400">
                                            <Scaling size={12} /><span>{node.data.aspectRatio || defaultRatio}</span>
                                        </div>
                                        <div className="absolute bottom-full left-0 pb-2 w-20 opacity-0 translate-y-2 pointer-events-none group-hover/ratio:opacity-100 group-hover/ratio:translate-y-0 group-hover/ratio:pointer-events-auto transition-all duration-200 z-[200]">
                                            <div className="bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden">
                                                {aspectRatios.map(r => (
                                                    <div key={r} onClick={() => handleAspectRatioSelect(r)} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-slate-100 ${node.data.aspectRatio === r ? 'text-blue-400 bg-slate-50' : 'text-slate-600'}`}>{r}</div>
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
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors text-[10px] font-bold text-slate-600 hover:text-blue-400">
                                            <Monitor size={12} /><span>{node.data.resolution || defaultRes}</span>
                                        </div>
                                        <div className="absolute bottom-full left-0 pb-2 w-20 opacity-0 translate-y-2 pointer-events-none group-hover/resolution:opacity-100 group-hover/resolution:translate-y-0 group-hover/resolution:pointer-events-auto transition-all duration-200 z-[200]">
                                            <div className="bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden">
                                                {resolutions.map(r => (
                                                    <div key={r} onClick={() => onUpdate(node.id, { resolution: r })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-slate-100 ${node.data.resolution === r ? 'text-blue-400 bg-slate-50' : 'text-slate-600'}`}>{r}</div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            {/* 组图数量选择 - 仅图像生成节点显示 */}
                            {node.type === NodeType.IMAGE_GENERATOR && (
                                <div className="relative group/count">
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors text-[10px] font-bold text-slate-600 hover:text-blue-400">
                                        <Grid3X3 size={12} /><span>{node.data.imageCount || 1}张</span>
                                    </div>
                                    <div className="absolute bottom-full left-0 pb-2 w-20 opacity-0 translate-y-2 pointer-events-none group-hover/count:opacity-100 group-hover/count:translate-y-0 group-hover/count:pointer-events-auto transition-all duration-200 z-[200]">
                                        <div className="bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden">
                                            {IMAGE_COUNTS.map(c => (
                                                <div key={c} onClick={() => onUpdate(node.id, { imageCount: c })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-slate-100 ${(node.data.imageCount || 1) === c ? 'text-blue-400 bg-slate-50' : 'text-slate-600'}`}>{c}张</div>
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
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-[12px] font-bold text-[10px] text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
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

    // 组图宫格计算
    const gridItems = node.data.images || node.data.videoUris || [];
    const hasGrid = gridItems.length > 1;
    const gridCols = 2;
    const gridRows = Math.ceil(gridItems.length / gridCols);
    const gap = 4;
    const gridWidth = gridCols * nodeWidth + (gridCols - 1) * gap;
    const gridHeight = gridRows * nodeHeight + (gridRows - 1) * gap;

    return (
        <>
            <div
                className={`absolute rounded-[24px] group ${isSelected ? 'ring-2 ring-blue-300/60 shadow-[0_20px_60px_rgba(59,130,246,0.15)]' : 'ring-1 ring-slate-200/80 hover:ring-blue-200/60'}`}
                style={{
                    left: node.x, top: node.y, width: nodeWidth, height: nodeHeight,
                    zIndex: isSelected ? 50 : 10,
                    background: isSelected ? 'rgba(255, 255, 255, 0.96)' : 'rgba(250, 250, 255, 0.9)',
                    transition: isInteracting ? 'none' : 'all 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
                    backdropFilter: isInteracting ? 'none' : 'blur(18px)',
                    boxShadow: isInteracting ? 'none' : undefined,
                    willChange: isInteracting ? 'left, top, width, height' : 'auto'
                }}
                onMouseDown={(e) => onNodeMouseDown(e, node.id)} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onContextMenu={(e) => onNodeContextMenu(e, node.id)}
            >
                {renderTopBar()}
                <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-slate-300 bg-white flex items-center justify-center transition-all duration-300 hover:scale-125 cursor-crosshair z-50 shadow-md ${isConnecting ? 'ring-2 ring-cyan-400 animate-pulse' : ''}`} onMouseDown={(e) => onPortMouseDown(e, node.id, 'input')} onMouseUp={(e) => onPortMouseUp(e, node.id, 'input')} title="Input"><Plus size={10} strokeWidth={3} className="text-slate-400" /></div>
                {/* 右连接点 - 有媒体结果时增强交互 */}
                {(() => {
                    const hasMedia = !!(node.data.image || node.data.videoUri);
                    const handleOutputDoubleClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (hasMedia && onOutputPortAction) {
                            onOutputPortAction(node.id, { x: e.clientX, y: e.clientY });
                        }
                    };
                    const handleOutputMouseUp = (e: React.MouseEvent) => {
                        onPortMouseUp(e, node.id, 'output');
                        // 如果是拖拽释放且有媒体结果，也触发选框
                        if (hasMedia && onOutputPortAction && isConnecting) {
                            onOutputPortAction(node.id, { x: e.clientX, y: e.clientY });
                        }
                    };
                    return (
                        <div
                            className={`absolute -right-3 top-1/2 -translate-y-1/2 rounded-full border bg-white flex items-center justify-center transition-all duration-300 cursor-crosshair z-50 shadow-md
                                ${hasMedia
                                    ? 'w-5 h-5 border-blue-400 hover:scale-150 hover:bg-blue-500 hover:border-blue-500 group/output'
                                    : 'w-4 h-4 border-slate-300 hover:scale-125'}
                                ${isConnecting ? 'ring-2 ring-purple-400 animate-pulse' : ''}`}
                            onMouseDown={(e) => onPortMouseDown(e, node.id, 'output')}
                            onMouseUp={handleOutputMouseUp}
                            onDoubleClick={handleOutputDoubleClick}
                            title={hasMedia ? "双击创建下游节点" : "Output"}
                        >
                            <Plus size={hasMedia ? 12 : 10} strokeWidth={3} className={`transition-colors ${hasMedia ? 'text-blue-400 group-hover/output:text-white' : 'text-slate-400'}`} />
                        </div>
                    );
                })()}
                <div className="w-full h-full flex flex-col relative rounded-[24px] overflow-hidden bg-white"><div className="flex-1 min-h-0 relative bg-white">{renderMediaContent()}</div></div>
                {renderBottomPanel()}
                <div className="absolute -bottom-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize text-slate-500 hover:text-slate-900 transition-colors opacity-0 group-hover:opacity-100 z-50" onMouseDown={(e) => onResizeMouseDown(e, node.id, nodeWidth, nodeHeight)}><div className="w-1.5 h-1.5 rounded-full bg-current" /></div>
            </div>
            {/* 组图宫格 - 始终渲染，CSS控制显隐，支持拖拽到画布 */}
            {hasGrid && (
                <div
                    className="absolute bg-white rounded-[24px] shadow-2xl transition-all duration-200"
                    style={{
                        left: node.x,
                        top: node.y,
                        width: gridWidth,
                        height: gridHeight,
                        zIndex: showImageGrid ? 200 : -1,
                        opacity: showImageGrid ? 1 : 0,
                        pointerEvents: showImageGrid ? 'auto' : 'none',
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <button
                        className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                        onClick={() => setShowImageGrid(false)}
                    >
                        <X size={14} className="text-white" />
                    </button>
                    {/* 拖拽提示 */}
                    <div className="absolute top-3 left-3 z-10 px-2 py-1 bg-black/50 rounded-lg text-[10px] text-white/80 font-medium">
                        点击选择 · 拖拽创建副本
                    </div>
                    <div className="w-full h-full grid grid-cols-2" style={{ gap }}>
                        {node.data.images ? node.data.images.map((img, idx) => {
                            const isSelected = img === node.data.image;
                            const handleGridItemMouseDown = (e: React.MouseEvent) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const startX = e.clientX;
                                const startY = e.clientY;
                                let hasMoved = false;
                                let rafId: number | null = null;

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const dx = Math.abs(moveEvent.clientX - startX);
                                    const dy = Math.abs(moveEvent.clientY - startY);

                                    // 使用 RAF 更新 ghost 位置，确保流畅
                                    gridDragPosRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
                                    if (ghostElementRef.current) {
                                        ghostElementRef.current.style.left = `${moveEvent.clientX - 100}px`;
                                        ghostElementRef.current.style.top = `${moveEvent.clientY - 60}px`;
                                    }

                                    if (dx > 5 || dy > 5) {
                                        if (!hasMoved) {
                                            hasMoved = true;
                                            setGridDragState({
                                                isDragging: true,
                                                src: img,
                                                type: 'image',
                                                startX,
                                                startY,
                                                currentX: moveEvent.clientX,
                                                currentY: moveEvent.clientY,
                                            });
                                        }
                                        // 通知父组件拖拽位置变化（用于显示放置预览）
                                        onGridDragStateChange?.({
                                            isDragging: true,
                                            type: 'image',
                                            src: img,
                                            screenX: moveEvent.clientX,
                                            screenY: moveEvent.clientY,
                                        });
                                    }
                                };

                                const handleMouseUp = (upEvent: MouseEvent) => {
                                    window.removeEventListener('mousemove', handleMouseMove);
                                    window.removeEventListener('mouseup', handleMouseUp);
                                    document.body.style.cursor = '';
                                    if (rafId) cancelAnimationFrame(rafId);

                                    // 通知父组件拖拽结束
                                    onGridDragStateChange?.(null);

                                    if (hasMoved && onDragResultToCanvas) {
                                        // 拖拽到画布创建新节点
                                        onDragResultToCanvas(node.id, 'image', img, upEvent.clientX, upEvent.clientY);
                                        setShowImageGrid(false);
                                    } else if (!hasMoved) {
                                        // 点击选择
                                        onUpdate(node.id, { image: img });
                                        setShowImageGrid(false);
                                    }
                                    setGridDragState(null);
                                };

                                document.body.style.cursor = 'grabbing';
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                            };

                            return (
                                <div
                                    key={idx}
                                    className={`relative overflow-hidden cursor-grab active:cursor-grabbing rounded-[20px] ${isSelected ? 'ring-4 ring-blue-500 ring-inset' : 'hover:brightness-95 hover:ring-2 hover:ring-cyan-400'} transition-all group/item`}
                                    style={{ width: nodeWidth, height: nodeHeight }}
                                    onMouseDown={handleGridItemMouseDown}
                                >
                                    <img src={img} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                                    {isSelected && (
                                        <div className="absolute top-2 left-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow">
                                            <CheckCircle size={12} className="text-white" />
                                        </div>
                                    )}
                                    {/* 拖拽指示器 */}
                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover/item:opacity-100 transition-opacity bg-black/50 px-2 py-1 rounded-lg flex items-center gap-1">
                                        <GripHorizontal size={12} className="text-white" />
                                        <span className="text-[9px] text-white font-medium">拖拽</span>
                                    </div>
                                </div>
                            );
                        }) : node.data.videoUris?.map((uri, idx) => {
                            const isSelected = uri === node.data.videoUri;
                            const handleGridItemMouseDown = (e: React.MouseEvent) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const startX = e.clientX;
                                const startY = e.clientY;
                                let hasMoved = false;
                                let rafId: number | null = null;

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const dx = Math.abs(moveEvent.clientX - startX);
                                    const dy = Math.abs(moveEvent.clientY - startY);

                                    // 使用 RAF 更新 ghost 位置，确保流畅
                                    gridDragPosRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
                                    if (ghostElementRef.current) {
                                        ghostElementRef.current.style.left = `${moveEvent.clientX - 100}px`;
                                        ghostElementRef.current.style.top = `${moveEvent.clientY - 60}px`;
                                    }

                                    if (dx > 5 || dy > 5) {
                                        if (!hasMoved) {
                                            hasMoved = true;
                                            setGridDragState({
                                                isDragging: true,
                                                src: uri,
                                                type: 'video',
                                                startX,
                                                startY,
                                                currentX: moveEvent.clientX,
                                                currentY: moveEvent.clientY,
                                            });
                                        }
                                        // 通知父组件拖拽位置变化（用于显示放置预览）
                                        onGridDragStateChange?.({
                                            isDragging: true,
                                            type: 'video',
                                            src: uri,
                                            screenX: moveEvent.clientX,
                                            screenY: moveEvent.clientY,
                                        });
                                    }
                                };

                                const handleMouseUp = (upEvent: MouseEvent) => {
                                    window.removeEventListener('mousemove', handleMouseMove);
                                    window.removeEventListener('mouseup', handleMouseUp);
                                    document.body.style.cursor = '';
                                    if (rafId) cancelAnimationFrame(rafId);

                                    // 通知父组件拖拽结束
                                    onGridDragStateChange?.(null);

                                    if (hasMoved && onDragResultToCanvas) {
                                        // 拖拽到画布创建新节点
                                        onDragResultToCanvas(node.id, 'video', uri, upEvent.clientX, upEvent.clientY);
                                        setShowImageGrid(false);
                                    } else if (!hasMoved) {
                                        // 点击选择
                                        onUpdate(node.id, { videoUri: uri });
                                        setShowImageGrid(false);
                                    }
                                    setGridDragState(null);
                                };

                                document.body.style.cursor = 'grabbing';
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                            };

                            return (
                                <div
                                    key={idx}
                                    className={`relative overflow-hidden cursor-grab active:cursor-grabbing rounded-[20px] ${isSelected ? 'ring-4 ring-blue-500 ring-inset' : 'hover:brightness-95 hover:ring-2 hover:ring-cyan-400'} transition-all group/item`}
                                    style={{ width: nodeWidth, height: nodeHeight }}
                                    onMouseDown={handleGridItemMouseDown}
                                >
                                    {uri && <SecureVideo src={uri} className="w-full h-full object-cover bg-white pointer-events-none" muted loop autoPlay />}
                                    {isSelected && (
                                        <div className="absolute top-2 left-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow">
                                            <CheckCircle size={12} className="text-white" />
                                        </div>
                                    )}
                                    {/* 拖拽指示器 */}
                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover/item:opacity-100 transition-opacity bg-black/50 px-2 py-1 rounded-lg flex items-center gap-1">
                                        <GripHorizontal size={12} className="text-white" />
                                        <span className="text-[9px] text-white font-medium">拖拽</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {/* 拖拽预览层 - 跟随鼠标的ghost元素 */}
            {gridDragState?.isDragging && (
                <div
                    ref={ghostElementRef}
                    className="fixed pointer-events-none z-[9999] rounded-[20px] shadow-2xl overflow-hidden ring-2 ring-cyan-400 animate-pulse"
                    style={{
                        left: gridDragState.currentX - 100,
                        top: gridDragState.currentY - 60,
                        width: 200,
                        height: 120,
                        transform: 'scale(1.05)',
                        transition: 'transform 0.15s ease-out',
                    }}
                >
                    {gridDragState.type === 'image' ? (
                        <img src={gridDragState.src} className="w-full h-full object-cover" draggable={false} />
                    ) : (
                        <SecureVideo src={gridDragState.src} className="w-full h-full object-cover bg-white" muted />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/30 via-transparent to-transparent" />
                    <div className="absolute inset-0 ring-2 ring-inset ring-white/30 rounded-[20px]" />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg py-1.5 px-2">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                        <span className="text-[10px] text-white font-bold tracking-wide">松开放置</span>
                    </div>
                </div>
            )}
        </>
    );
};

export const Node = memo(NodeComponent, arePropsEqual);
