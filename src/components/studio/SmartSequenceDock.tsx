"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Plus, Play, Pause, X, Clock, Trash2, Link, ArrowRight,
    GripVertical, RefreshCw, Download, Maximize2, Minimize2,
    MonitorPlay, Loader2, Settings, Zap, Film
} from 'lucide-react';
import { SmartSequenceItem } from '@/types';
import { ViduMultiFrameConfig, VIDU_MODELS, VIDU_RESOLUTIONS } from '@/services/viduService';

interface SmartSequenceDockProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (frames: SmartSequenceItem[], config: ViduMultiFrameConfig) => Promise<string>;
    onConnectStart?: (e: React.MouseEvent, type: 'input' | 'output') => void;
}

// Apple Physics Curve
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";

export const SmartSequenceDock: React.FC<SmartSequenceDockProps> = ({ isOpen, onClose, onGenerate, onConnectStart }) => {
    const [frames, setFrames] = useState<SmartSequenceItem[]>([]);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    // Playback & View State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const expandedVideoRef = useRef<HTMLVideoElement>(null);

    // Generation State
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);

    // Vidu Config State
    const [viduConfig, setViduConfig] = useState<ViduMultiFrameConfig>({
        model: 'viduq2-turbo',
        resolution: '720p',
    });
    const [showSettings, setShowSettings] = useState(false);

    // Transition Editor State
    const [editingTransitionId, setEditingTransitionId] = useState<string | null>(null);
    const [tempPrompt, setTempPrompt] = useState('');
    const [tempDuration, setTempDuration] = useState(5); // Vidu 默认 5s

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dockRef = useRef<HTMLDivElement>(null);
    const transitionModalRef = useRef<HTMLDivElement>(null);

    // --- Helpers ---
    const totalDuration = frames.reduce((acc, f, i) => i < frames.length - 1 ? acc + f.transition.duration : acc, 0);

    // Global Click Listener for Closing Popups
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (editingTransitionId && transitionModalRef.current && !transitionModalRef.current.contains(event.target as Node)) {
                // Clicked outside transition modal
                // Check if clicked on the link button (to prevent immediate reopen toggling issues if handled there)
                const target = event.target as HTMLElement;
                if (!target.closest('button[data-link-btn]')) {
                    saveTransition();
                }
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [editingTransitionId, tempPrompt, tempDuration]);

    const handleGenerateClick = async () => {
        if (frames.length < 2 || isGenerating) return;
        setIsGenerating(true);
        setResultVideoUrl(null);
        setIsPlaying(false);
        setShowSettings(false); // 关闭设置面板

        try {
            const url = await onGenerate(frames, viduConfig);
            setResultVideoUrl(url);
            // Auto play after generation
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => { });
                }
            }, 100);
        } catch (error) {
            console.error("Generation failed", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const togglePlay = () => {
        const video = isExpanded ? expandedVideoRef.current : videoRef.current;
        if (!video || !resultVideoUrl) return;
        if (isPlaying) {
            video.pause();
            setIsPlaying(false);
        } else {
            video.play();
            setIsPlaying(true);
        }
    };

    // 切换展开模式时重置播放状态
    useEffect(() => {
        setIsPlaying(false);
        // 暂停所有视频
        videoRef.current?.pause();
        expandedVideoRef.current?.pause();
    }, [isExpanded]);

    // --- Mouse-based Drag & Drop (更可靠的实现) ---
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);

    const handleMouseDown = (e: React.MouseEvent, index: number) => {
        if (e.button !== 0) return; // 只响应左键
        e.preventDefault();
        e.stopPropagation();
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        setDraggingIndex(index);
        console.log('[Drag] MouseDown:', index);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (draggingIndex === null || !dragStartPos.current) return;

        // 检测是否真的在拖动（移动超过5px）
        const dx = Math.abs(e.clientX - dragStartPos.current.x);
        const dy = Math.abs(e.clientY - dragStartPos.current.y);
        if (dx < 5 && dy < 5) return;

        // 找到鼠标下方的帧
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        for (const el of elements) {
            const frameEl = el.closest('[data-frame-index]') as HTMLElement;
            if (frameEl) {
                const targetIndex = parseInt(frameEl.dataset.frameIndex || '-1');
                if (targetIndex >= 0 && targetIndex !== draggingIndex) {
                    console.log('[Drag] Move to:', targetIndex);
                    setDragOverIndex(targetIndex);
                    // Live Reorder
                    setFrames(prev => {
                        const newFrames = [...prev];
                        const [moved] = newFrames.splice(draggingIndex, 1);
                        newFrames.splice(targetIndex, 0, moved);
                        return newFrames;
                    });
                    setDraggingIndex(targetIndex);
                }
                break;
            }
        }
    }, [draggingIndex]);

    const handleMouseUp = useCallback(() => {
        if (draggingIndex !== null) {
            console.log('[Drag] MouseUp');
        }
        setDraggingIndex(null);
        setDragOverIndex(null);
        dragStartPos.current = null;
    }, [draggingIndex]);

    // 全局鼠标事件监听
    useEffect(() => {
        if (draggingIndex !== null) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [draggingIndex, handleMouseMove, handleMouseUp]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDraggingIndex(null);
        setDragOverIndex(null);

        // Handle external files if any
        if (e.dataTransfer.files?.length > 0) {
            const files = Array.from(e.dataTransfer.files).filter((f: any) => f.type.startsWith('image/'));
            if (files.length > 0) {
                const readers = files.map((file: any) => new Promise<SmartSequenceItem>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve({
                        id: `seq-${Date.now()}-${Math.random()}`,
                        src: ev.target?.result as string,
                        transition: { duration: 5, prompt: '' } // Vidu 默认 5s
                    });
                    reader.readAsDataURL(file);
                }));
                Promise.all(readers).then(newItems => {
                    // Append to end if dropping on container, or insert if tracking index
                    setFrames(p => [...p, ...newItems].slice(0, 10));
                });
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const readers = files.map((file: any) => new Promise<SmartSequenceItem>((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve({
                    id: `seq-${Date.now()}-${Math.random()}`,
                    src: ev.target?.result as string,
                    transition: { duration: 5, prompt: '' } // Vidu 默认 5s
                });
                reader.readAsDataURL(file);
            }));
            Promise.all(readers).then(newItems => setFrames(p => [...p, ...newItems].slice(0, 10)));
        }
        e.target.value = '';
    };

    // --- Transition Editor ---
    const openTransitionEditor = (id: string, transition: { duration: number, prompt: string }) => {
        if (editingTransitionId === id) {
            saveTransition();
        } else {
            saveTransition(); // Close others
            setEditingTransitionId(id);
            setTempPrompt(transition.prompt);
            setTempDuration(transition.duration);
        }
    };

    const saveTransition = () => {
        if (editingTransitionId) {
            setFrames(prev => prev.map(f => f.id === editingTransitionId ? { ...f, transition: { prompt: tempPrompt, duration: tempDuration } } : f));
            setEditingTransitionId(null);
        }
    };

    if (!isOpen) return null;

    // --- Render ---

    // 小型播放器 (非展开模式)
    const renderPlayer = () => (
        <div
            className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-[0_25px_65px_rgba(15,23,42,0.12)] overflow-hidden flex items-center justify-center w-[360px] h-[202px] rounded-2xl"
        >
            {/* Top Left Controls (Expand / Download) */}
            <div className={`absolute top-3 left-3 flex gap-2 z-20 transition-opacity duration-200 ${isGenerating ? 'opacity-0' : 'opacity-0 hover:opacity-100 group-hover/player:opacity-100'}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                    className="p-2 bg-white/90 backdrop-blur-md rounded-lg text-slate-700 hover:text-slate-900 border border-slate-300 hover:scale-105 transition-all"
                    title="放大预览"
                >
                    <Maximize2 size={16} />
                </button>
                {resultVideoUrl && (
                    <a
                        href={resultVideoUrl}
                        download={`studio_seq_${Date.now()}.mp4`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 bg-white/90 backdrop-blur-md rounded-lg text-slate-700 hover:text-slate-900 border border-slate-300 hover:scale-105 transition-all"
                        title="下载视频"
                    >
                        <Download size={16} />
                    </a>
                )}
            </div>

            {/* Playback Content */}
            {isGenerating ? (
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="animate-spin text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 tracking-widest uppercase animate-pulse">正在生成智能补帧...</span>
                </div>
            ) : resultVideoUrl ? (
                <div className="relative w-full h-full group/video cursor-pointer" onClick={togglePlay}>
                    <video
                        ref={videoRef}
                        src={resultVideoUrl}
                        className="w-full h-full object-contain bg-black"
                        loop
                        playsInline
                        onEnded={() => setIsPlaying(false)}
                    />
                    {!isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                <Play size={24} className="text-slate-700 ml-1" fill="currentColor" />
                            </div>
                        </div>
                    )}
                </div>
            ) : frames.length > 0 ? (
                <div className="relative w-full h-full">
                    {/* Show hovered frame or first frame */}
                    <img
                        src={hoverIndex !== null && frames[hoverIndex] ? frames[hoverIndex].src : frames[0].src}
                        className="w-full h-full object-contain opacity-80"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        {/* Central Play Button (Only toggles playback if generated, or shows placeholder) */}
                        <button
                            onClick={togglePlay}
                            disabled={!resultVideoUrl}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all backdrop-blur-md group/play
                                ${resultVideoUrl
                                    ? 'bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                                    : 'bg-slate-50 border border-slate-300 cursor-default opacity-50'}
                             `}
                        >
                            {isPlaying ? <Pause size={24} className="text-slate-900" /> : <Play size={24} className="text-slate-900 ml-1" fill={resultVideoUrl ? "currentColor" : "none"} />}
                        </button>
                    </div>
                    {/* Info Overlay */}
                    <div className="absolute top-2 right-2 px-2 py-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded text-[9px] text-slate-600 dark:text-slate-300 font-mono border border-slate-200 dark:border-slate-600 pointer-events-none">
                        {totalDuration}s • {frames.length} Frames
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center text-slate-600 dark:text-slate-400 gap-2 select-none">
                    <MonitorPlay size={32} strokeWidth={1} />
                    <span className="text-[10px] font-medium tracking-wider">智能多帧预览</span>
                </div>
            )}
        </div>
    );

    return (
        <>
            {/* Expanded Mode: Backdrop + Player (独立渲染，不受 dock 容器限制) */}
            {isExpanded && (
                <>
                    {/* 背景遮罩 - 点击关闭 */}
                    <div
                        className="fixed inset-0 z-[90] bg-black/50 animate-in fade-in duration-300"
                        onClick={() => setIsExpanded(false)}
                    />
                    {/* 展开的播放器 - 在遮罩之上 */}
                    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                        <div
                            className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_50px_120px_rgba(15,23,42,0.25)] overflow-hidden w-[80vw] h-[45vw] max-w-[1280px] max-h-[720px] pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 控制按钮 */}
                            <div className="absolute top-4 left-4 flex gap-2 z-20">
                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className="p-2.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-300 dark:border-slate-600 hover:scale-105 transition-all"
                                    title="退出全屏"
                                >
                                    <Minimize2 size={18} />
                                </button>
                                {resultVideoUrl && (
                                    <a
                                        href={resultVideoUrl}
                                        download={`studio_seq_${Date.now()}.mp4`}
                                        className="p-2.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-300 dark:border-slate-600 hover:scale-105 transition-all"
                                        title="下载视频"
                                    >
                                        <Download size={18} />
                                    </a>
                                )}
                            </div>
                            {/* 视频内容 */}
                            {resultVideoUrl ? (
                                <div className="w-full h-full cursor-pointer" onClick={togglePlay}>
                                    <video
                                        ref={expandedVideoRef}
                                        src={resultVideoUrl}
                                        className="w-full h-full object-contain bg-black"
                                        loop
                                        playsInline
                                        onEnded={() => setIsPlaying(false)}
                                    />
                                    {!isPlaying && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                            <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                                <Play size={36} className="text-slate-700 ml-1" fill="currentColor" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                                    <span className="text-slate-400 dark:text-slate-500">无视频内容</span>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            <div
                ref={dockRef}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 transition-all duration-500 animate-in slide-in-from-bottom-20 fade-in"
                style={{ transitionTimingFunction: SPRING }}
            >
                {/* --- Layer 1: Player (Top) - 仅在非展开模式显示 --- */}
                {!isExpanded && (
                    <div className="relative group/player mb-2">
                        {/* Connectors */}
                        <div
                            onMouseDown={(e) => onConnectStart?.(e, 'input')}
                            className="absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover/player:opacity-100 hover:scale-125 transition-all cursor-crosshair z-30"
                            title="Connect Input"
                        >
                            <Plus size={12} className="text-slate-500 dark:text-slate-400" />
                        </div>
                        <div
                            onMouseDown={(e) => onConnectStart?.(e, 'output')}
                            className="absolute -right-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover/player:opacity-100 hover:scale-125 transition-all cursor-crosshair z-30"
                            title="Connect Output"
                        >
                            <Plus size={12} className="text-slate-500 dark:text-slate-400" />
                        </div>

                        {renderPlayer()}
                    </div>
                )}

                {/* --- Layer 2: Preview Strip (Middle) --- */}
                <div
                    className="w-full h-10 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-t-lg border-t border-x border-slate-200 dark:border-slate-700 relative overflow-hidden flex cursor-crosshair group/strip"
                    style={{ width: 'min(90vw, 820px)' }}
                    onMouseMove={(e) => {
                        if (frames.length === 0) { setHoverIndex(null); return; }
                        const rect = e.currentTarget.getBoundingClientRect();
                        const index = Math.min(frames.length - 1, Math.floor(((e.clientX - rect.left) / rect.width) * frames.length));
                        setHoverIndex(index);
                    }}
                    onMouseLeave={() => setHoverIndex(null)}
                >
                    {frames.map((f, i) => (
                        <div key={f.id} className="flex-1 h-full relative border-r border-slate-200/50 dark:border-slate-700/50 last:border-0 overflow-hidden flex items-center justify-center bg-slate-50/50 dark:bg-slate-800/50">
                            <img src={f.src} className="h-full object-contain opacity-60 group-hover/strip:opacity-80 transition-opacity" />
                        </div>
                    ))}

                    {/* Hover Highlight */}
                    {hoverIndex !== null && frames.length > 0 && (
                        <div
                            className="absolute top-0 bottom-0 bg-blue-500/20 border-x border-blue-500/50 pointer-events-none transition-all duration-75 ease-out"
                            style={{
                                left: `${(hoverIndex / frames.length) * 100}%`,
                                width: `${100 / frames.length}%`
                            }}
                        />
                    )}
                </div>

                {/* --- Layer 3: Asset Dock (Bottom) --- */}
                <div
                    className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200 dark:border-slate-700 rounded-b-2xl rounded-t-sm shadow-[0_20px_65px_rgba(15,23,42,0.12)] p-4 flex items-center gap-4 relative z-10"
                    style={{ width: 'min(90vw, 820px)' }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {/* Apple Style Close Button on Left */}
                    <button onClick={onClose} className="absolute -top-3 left-0 -translate-y-full p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-full border border-slate-300 dark:border-slate-600 transition-colors">
                        <X size={14} />
                    </button>

                    {/* Scrollable List */}
                    <div className="flex-1 flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 min-h-[80px]">
                        {frames.map((frame, index) => (
                            <React.Fragment key={frame.id}>
                                {/* Draggable Thumbnail - 鼠标拖拽排序 */}
                                <div
                                    data-frame-index={index}
                                    className={`
                                        relative w-[72px] h-[72px] shrink-0 rounded-lg overflow-hidden border transition-all duration-200 ease-out group select-none cursor-grab active:cursor-grabbing
                                        ${draggingIndex === index ? 'opacity-50 scale-95 ring-2 ring-blue-400 z-50' : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 bg-slate-50 dark:bg-slate-800'}
                                    `}
                                    onMouseDown={(e) => handleMouseDown(e, index)}
                                >
                                    <img src={frame.src} className="w-full h-full object-cover pointer-events-none" draggable="false" />

                                    {/* Index Badge */}
                                    <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-white/90 dark:bg-slate-700/90 rounded-full flex items-center justify-center text-[8px] font-bold text-slate-800 dark:text-slate-200 pointer-events-none">
                                        {index + 1}
                                    </div>

                                    {/* Delete Button (Top Left) */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setFrames(p => p.filter(f => f.id !== frame.id)); }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-white/90 dark:bg-slate-700/90 hover:bg-red-500 text-slate-700 dark:text-slate-300 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-20"
                                    >
                                        <X size={10} strokeWidth={3} />
                                    </button>

                                </div>

                                {/* Link / Transition Button */}
                                {index < frames.length - 1 && (
                                    <div className="relative flex flex-col items-center justify-center w-6 shrink-0 z-10">
                                        <div className="h-[2px] w-full bg-slate-100 dark:bg-slate-700 absolute top-1/2 -translate-y-1/2 -z-10" />
                                        <button
                                            data-link-btn
                                            onClick={() => openTransitionEditor(frame.id, frame.transition)}
                                            className={`
                                                w-5 h-5 rounded-full flex items-center justify-center transition-all hover:scale-110 border
                                                ${frame.transition.prompt
                                                    ? 'bg-blue-500 border-blue-400 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                                                    : 'bg-white dark:bg-slate-800 border-slate-400 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-white dark:hover:border-slate-400'}
                                            `}
                                        >
                                            <Link size={10} strokeWidth={2.5} />
                                        </button>
                                        <span className="text-[8px] text-slate-500 dark:text-slate-400 mt-1 font-mono tracking-tighter">{frame.transition.duration}s</span>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}

                        {/* Add Button */}
                        {frames.length < 10 && (
                            <div
                                className="w-[72px] h-[72px] shrink-0 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all group active:scale-95"
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                            >
                                <Plus size={18} className="text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors" />
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Add</span>
                            </div>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                    </div>

                    {/* Right Action Column */}
                    <div className="pl-4 border-l border-slate-300 dark:border-slate-600 flex flex-col gap-2 shrink-0 relative">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                            title="Vidu 参数设置"
                        >
                            <Settings size={14} />
                        </button>
                        <button
                            onClick={() => setFrames([])}
                            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-red-500/20 text-slate-600 dark:text-slate-400 hover:text-red-400 transition-colors"
                            title="全部清空"
                        >
                            <Trash2 size={14} />
                        </button>
                        <button
                            onClick={handleGenerateClick}
                            disabled={frames.length < 2 || isGenerating}
                            className={`
                                w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg
                                ${frames.length >= 2 && !isGenerating ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:scale-110 hover:shadow-cyan-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-not-allowed'}
                            `}
                            title="生成视频"
                        >
                            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} strokeWidth={3} />}
                        </button>

                        {/* Settings Panel */}
                        {showSettings && (
                            <div
                                className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Vidu 参数</span>
                                    <button onClick={() => setShowSettings(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                                        <X size={12} />
                                    </button>
                                </div>

                                {/* Model Selection */}
                                <div className="mb-3">
                                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1.5 flex items-center gap-1">
                                        <Zap size={10} /> 模型
                                    </label>
                                    <div className="flex gap-1">
                                        {VIDU_MODELS.map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => setViduConfig(c => ({ ...c, model: m.id }))}
                                                className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all ${viduConfig.model === m.id
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {m.id === 'viduq2-turbo' ? 'Turbo' : 'Pro'}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">
                                        {viduConfig.model === 'viduq2-turbo' ? '快速生成' : '高质量生成'}
                                    </p>
                                </div>

                                {/* Resolution Selection */}
                                <div>
                                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1.5 flex items-center gap-1">
                                        <Film size={10} /> 分辨率
                                    </label>
                                    <div className="flex gap-1">
                                        {VIDU_RESOLUTIONS.map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => setViduConfig(c => ({ ...c, resolution: r.id }))}
                                                className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all ${viduConfig.resolution === r.id
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {r.id}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                    <p className="text-[9px] text-slate-400 dark:text-slate-500">
                                        帧间时长: 2-7秒 · 最多10帧
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- Transition Editor Popup (9:16 Vertical) --- */}
                {editingTransitionId && (
                    <div
                        ref={transitionModalRef}
                        className="absolute bottom-[130px] z-[100] w-[240px] aspect-[9/16] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col animate-in slide-in-from-bottom-4 zoom-in-95 duration-300 overflow-hidden"
                        style={{ left: '50%', transform: 'translateX(-50%)' }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">运镜描述</span>
                            <button onClick={() => saveTransition()} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"><X size={12} /></button>
                        </div>

                        {/* Textarea */}
                        <div className="flex-1 p-4">
                            <textarea
                                className="w-full h-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:border-blue-500/50 dark:focus:border-blue-400/50 resize-none leading-relaxed custom-scrollbar shadow-inner"
                                placeholder="描述镜头之间的转换..."
                                value={tempPrompt}
                                onChange={(e) => setTempPrompt(e.target.value)}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                            />
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 pt-0 flex flex-col gap-3">
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2">
                                <Clock size={12} className="text-slate-500 dark:text-slate-400 shrink-0" />
                                <input
                                    type="range" min="2" max="7" step="1"
                                    value={tempDuration}
                                    onChange={(e) => setTempDuration(parseInt(e.target.value))}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                                />
                                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 min-w-[24px] text-right">{tempDuration}s</span>
                            </div>
                            <button
                                onClick={saveTransition}
                                className="w-full py-2.5 bg-blue-500 text-white hover:bg-blue-400 rounded-xl text-xs font-bold transition-colors shadow-lg"
                            >
                                确认
                            </button>
                        </div>

                        {/* Pointer Arrow */}
                        <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-50 dark:bg-slate-900 border-r border-b border-slate-300 dark:border-slate-700 rotate-45 pointer-events-none" />
                    </div>
                )}
            </div>
        </>
    );
};
