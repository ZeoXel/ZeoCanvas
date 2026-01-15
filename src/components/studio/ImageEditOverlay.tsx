"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Brush, Eraser, Undo, Trash2, Check, Minus, Plus } from 'lucide-react';

interface ImageEditOverlayProps {
    imageSrc: string;           // Original image (or current display image)
    originalImage?: string;     // Original image before any doodles (if exists)
    canvasData?: string;        // Previous canvas data (doodles only, transparent)
    nodeId: string;
    onClose: () => void;
    onSave: (nodeId: string, compositeImage: string, originalImage: string, canvasData: string) => void;
}

type Tool = 'brush' | 'eraser';

const PRESET_COLORS = ['#000000', '#ffffff', '#ff3b30', '#007aff', '#4cd964'];

const SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * 将外部图片 URL 转换为代理 URL（解决 CORS 问题）
 */
const getProxiedUrl = (url: string): string => {
    // 如果是 base64 或本地 URL，直接返回
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
        return url;
    }
    // 如果是需要代理的外部 URL
    if (url.includes('volces.com') || url.includes('tos-cn-')) {
        return `/api/proxy/image?url=${encodeURIComponent(url)}`;
    }
    return url;
};

export const ImageEditOverlay: React.FC<ImageEditOverlayProps> = ({
    imageSrc,
    originalImage,
    canvasData,
    nodeId,
    onClose,
    onSave
}) => {
    // Animation state
    const [visible, setVisible] = useState(false);

    // Canvas state
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState<Tool>('brush');
    const [brushColor, setBrushColor] = useState('#ff3b30');
    const [brushSize, setBrushSize] = useState(8);
    const [eraserSize, setEraserSize] = useState(30);
    const [canvasHistory, setCanvasHistory] = useState<ImageData[]>([]);

    // Background image state - use originalImage if available, otherwise use imageSrc
    const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [canvasInitialized, setCanvasInitialized] = useState(false);

    // The actual original image to use
    const actualOriginalImage = originalImage || imageSrc;

    // Enter animation
    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
    }, []);

    // Load background image and set canvas size
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            setBgImage(img);
            // Calculate canvas size to fit in viewport while maintaining aspect ratio
            const maxW = window.innerWidth * 0.85;
            const maxH = window.innerHeight * 0.75;
            const scale = Math.min(maxW / img.width, maxH / img.height, 1);
            setCanvasSize({
                width: img.width * scale,
                height: img.height * scale
            });
        };
        img.onerror = () => {
            console.error('[ImageEditOverlay] Failed to load image:', actualOriginalImage);
        };
        // 使用代理 URL 解决 CORS 问题
        img.src = getProxiedUrl(actualOriginalImage);
    }, [actualOriginalImage]);

    // Initialize canvas when size is set
    useEffect(() => {
        if (!canvasSize.width || !canvasSize.height || canvasInitialized) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvasSize.width * dpr;
        canvas.height = canvasSize.height * dpr;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Load existing canvas data if available
            if (canvasData) {
                const existingDoodle = new Image();
                existingDoodle.crossOrigin = 'anonymous';
                existingDoodle.onload = () => {
                    ctx.drawImage(existingDoodle, 0, 0, canvasSize.width, canvasSize.height);
                    setCanvasInitialized(true);
                    saveHistory();
                };
                existingDoodle.src = canvasData;
            } else {
                setCanvasInitialized(true);
                saveHistory();
            }
        }
    }, [canvasSize, canvasData, canvasInitialized]);

    const saveHistory = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setCanvasHistory(prev => [...prev.slice(-15), data]);
        }
    }, []);

    const handleUndo = () => {
        if (canvasHistory.length <= 1) return;
        const newHistory = [...canvasHistory];
        newHistory.pop();
        const prevState = newHistory[newHistory.length - 1];
        setCanvasHistory(newHistory);

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx && prevState) {
            ctx.putImageData(prevState, 0, 0);
        }
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            saveHistory();
        }
    };

    // Drawing handlers
    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        setIsDrawing(true);
        const { x, y } = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            if (tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = eraserSize;
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = brushColor;
                ctx.lineWidth = brushSize;
            }
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const { x, y } = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            const ctx = canvasRef.current?.getContext('2d');
            ctx?.closePath();
            if (ctx) ctx.globalCompositeOperation = 'source-over';
            saveHistory();
        }
    };

    // Get canvas data (doodles only, transparent background) at original resolution
    const getCanvasDataURL = (): string => {
        const canvas = canvasRef.current;
        if (!canvas || !bgImage) return '';

        const osc = document.createElement('canvas');
        osc.width = bgImage.width;
        osc.height = bgImage.height;
        const ctx = osc.getContext('2d');
        if (!ctx) return '';

        // Only draw the canvas content (doodles) scaled to original size
        ctx.drawImage(canvas, 0, 0, bgImage.width, bgImage.height);

        return osc.toDataURL('image/png');
    };

    // Composite logic - merge background + sketch
    const getCompositeDataURL = (): string => {
        const canvas = canvasRef.current;
        if (!canvas || !bgImage) return actualOriginalImage;

        const osc = document.createElement('canvas');
        osc.width = bgImage.width;
        osc.height = bgImage.height;
        const ctx = osc.getContext('2d');
        if (!ctx) return actualOriginalImage;

        // 1. Draw original background image
        ctx.drawImage(bgImage, 0, 0, bgImage.width, bgImage.height);

        // 2. Draw user sketch scaled to original size
        ctx.drawImage(canvas, 0, 0, bgImage.width, bgImage.height);

        return osc.toDataURL('image/png');
    };

    const handleClose = useCallback(() => {
        setVisible(false);
        setTimeout(onClose, 400);
    }, [onClose]);

    const handleSave = () => {
        const compositeImage = getCompositeDataURL();
        const canvasDataUrl = getCanvasDataURL();
        setVisible(false);
        setTimeout(() => onSave(nodeId, compositeImage, actualOriginalImage, canvasDataUrl), 300);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleClose]);

    return (
        <div
            className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-500 ease-[${SPRING}] ${visible ? 'bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl' : 'bg-transparent pointer-events-none opacity-0'}`}
            onClick={handleClose}
        >
            {/* Toolbar */}
            <div
                className={`mb-4 flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl transition-all duration-500 z-[200] ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Tool buttons */}
                <div className="flex items-center gap-1 px-2 border-r border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setTool('brush')}
                        className={`p-2.5 rounded-xl transition-all ${tool === 'brush' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        title="画笔"
                    >
                        <Brush size={18} />
                    </button>
                    <button
                        onClick={() => setTool('eraser')}
                        className={`p-2.5 rounded-xl transition-all ${tool === 'eraser' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        title="橡皮擦"
                    >
                        <Eraser size={18} />
                    </button>
                </div>

                {/* Color picker - horizontal strip */}
                <div className="flex items-center gap-1.5 px-2 border-r border-slate-200 dark:border-slate-700">
                    {PRESET_COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => { setBrushColor(c); setTool('brush'); }}
                            className={`w-5 h-5 rounded-full transition-all flex-shrink-0 ${brushColor === c ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-800 scale-110' : 'hover:scale-110 border border-slate-300 dark:border-slate-600'}`}
                            style={{ backgroundColor: c }}
                            title={c}
                        />
                    ))}
                </div>

                {/* Brush size */}
                <div className="flex items-center gap-2 px-2 border-r border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => tool === 'eraser' ? setEraserSize(Math.max(10, eraserSize - 5)) : setBrushSize(Math.max(2, brushSize - 2))}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <Minus size={14} />
                    </button>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-8 text-center">
                        {tool === 'eraser' ? eraserSize : brushSize}
                    </span>
                    <button
                        onClick={() => tool === 'eraser' ? setEraserSize(Math.min(80, eraserSize + 5)) : setBrushSize(Math.min(30, brushSize + 2))}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <Plus size={14} />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 px-2">
                    <button
                        onClick={handleUndo}
                        disabled={canvasHistory.length <= 1}
                        className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title="撤销 (Ctrl+Z)"
                    >
                        <Undo size={18} />
                    </button>
                    <button
                        onClick={handleClear}
                        className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all"
                        title="清除涂鸦"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>

                {/* Save button */}
                <button
                    onClick={handleSave}
                    className="ml-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-all flex items-center gap-2 shadow-md"
                >
                    <Check size={16} />
                    保存涂鸦
                </button>
            </div>

            {/* Canvas area */}
            <div
                ref={containerRef}
                className={`relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 transition-all duration-500 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
                style={{ width: canvasSize.width, height: canvasSize.height }}
                onClick={e => e.stopPropagation()}
            >
                {/* Background image */}
                {bgImage && (
                    <img
                        src={actualOriginalImage}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        alt="Background"
                        draggable={false}
                    />
                )}

                {/* Drawing canvas */}
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                    style={{ width: canvasSize.width, height: canvasSize.height }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            </div>

            {/* Hint */}
            <p className={`mt-4 text-xs text-slate-500 dark:text-slate-400 transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
                在图片上涂鸦标记，AI 将识别并据此生成新图像。按 ESC 取消，清除按钮可删除所有涂鸦。
            </p>

            {/* Close button */}
            <button
                onClick={handleClose}
                className="absolute top-6 right-6 p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-700 dark:text-slate-300 shadow-md transition-colors z-[110]"
            >
                <X size={24} />
            </button>
        </div>
    );
};
