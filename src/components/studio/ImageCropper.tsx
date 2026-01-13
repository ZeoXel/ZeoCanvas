"use client";

import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Crop, Move, Film, Loader2 } from 'lucide-react';
import { globalVideoBlobCache, getProxiedUrl } from './shared';

interface ImageCropperProps {
  imageSrc?: string;
  videoSrc?: string; // 可选：传入视频源时，显示帧选择滑块
  onConfirm: (croppedBase64: string) => void;
  onCancel: () => void;
}

const RATIOS = [
    { label: '自由', value: null },
    { label: '16:9', value: 16/9 },
    { label: '9:16', value: 9/16 },
    { label: '4:3', value: 4/3 },
    { label: '3:4', value: 3/4 },
    { label: '1:1', value: 1 },
];

type InteractionType = 'create' | 'move' | 'resize';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface CropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, videoSrc, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null); // null means free

  // 视频帧选择状态
  const [frameImage, setFrameImage] = useState<string | null>(imageSrc || null);
  const [isSelectingFrame, setIsSelectingFrame] = useState(!!videoSrc && !imageSrc);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isVideoLoading, setIsVideoLoading] = useState(!!videoSrc);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载视频（优先使用全局缓存，即 SecureVideo 已加载的视频）
  useEffect(() => {
    if (!videoSrc || !isSelectingFrame) return;

    // 如果已经是 blob 或 data URL，直接使用
    if (videoSrc.startsWith('data:') || videoSrc.startsWith('blob:')) {
      setVideoBlobUrl(videoSrc);
      setIsVideoLoading(false);
      return;
    }

    // 检查全局缓存 - SecureVideo 加载的视频会存入这里
    const cached = globalVideoBlobCache.get(videoSrc);
    if (cached) {
      console.log('[ImageCropper] 使用缓存的视频 blob:', videoSrc);
      setVideoBlobUrl(cached);
      setIsVideoLoading(false);
      return;
    }

    // 缓存未命中，需要加载
    console.log('[ImageCropper] 缓存未命中，开始加载视频:', videoSrc);
    let active = true;
    setIsVideoLoading(true);

    const fetchUrl = getProxiedUrl(videoSrc);
    fetch(fetchUrl)
      .then(response => {
        if (!response.ok) throw new Error("Video fetch failed");
        return response.blob();
      })
      .then(blob => {
        if (active) {
          const mp4Blob = new Blob([blob], { type: 'video/mp4' });
          const url = URL.createObjectURL(mp4Blob);
          // 存入全局缓存
          globalVideoBlobCache.set(videoSrc, url);
          setVideoBlobUrl(url);
          setIsVideoLoading(false);
        }
      })
      .catch(err => {
        console.error("Video load error:", err);
        if (active) setIsVideoLoading(false);
      });

    return () => {
      active = false;
    };
  }, [videoSrc, isSelectingFrame]);

  // 视频 ref callback - 在视频元素挂载时设置事件监听
  const setVideoRef = (video: HTMLVideoElement | null) => {
    if (video) {
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = video;

      const updateDuration = () => {
        if (video.duration && Number.isFinite(video.duration)) {
          setVideoDuration(video.duration);
        }
      };

      video.addEventListener('loadedmetadata', updateDuration);
      video.addEventListener('durationchange', updateDuration);
      video.addEventListener('canplay', updateDuration);
      video.addEventListener('loadeddata', updateDuration);

      // 如果已经有 duration，直接设置
      updateDuration();
    }
  };

  // 滑块变化时更新视频时间
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  // 从视频截取当前帧
  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const frameBase64 = canvas.toDataURL('image/png');
      setFrameImage(frameBase64);
      setIsSelectingFrame(false);
    }
  };

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  
  // Interaction State
  const [interaction, setInteraction] = useState<{
      type: InteractionType;
      handle?: ResizeHandle;
      startPos: { x: number; y: number };
      startCrop: CropRect | null;
  }>({ type: 'create', startPos: { x: 0, y: 0 }, startCrop: null });

  const getRelativePos = (e: React.MouseEvent | MouseEvent) => {
    if (!imgRef.current) return { x: 0, y: 0 };
    const rect = imgRef.current.getBoundingClientRect();
    return { 
        x: e.clientX - rect.left, 
        y: e.clientY - rect.top,
        rawX: e.clientX,
        rawY: e.clientY
    };
  };

  // Helper: Constrain a rectangle within image bounds (maxW, maxH)
  // Ensures x, y >= 0 and x+w <= maxW, y+h <= maxH
  const clampRect = (rect: CropRect, maxW: number, maxH: number): CropRect => {
      let { x, y, width, height } = rect;
      
      // Basic clamping
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (width > maxW) width = maxW;
      if (height > maxH) height = maxH;
      
      if (x + width > maxW) x = maxW - width;
      if (y + height > maxH) y = maxH - height;

      return { x, y, width, height };
  };

  const handleMouseDown = (e: React.MouseEvent, type: InteractionType, handle?: ResizeHandle) => {
    e.preventDefault(); 
    e.stopPropagation();
    
    const pos = getRelativePos(e);
    
    // If starting a NEW creation, clear the old crop unless we clicked on handles or existing crop
    let startCrop = crop;
    if (type === 'create') {
        startCrop = { x: pos.x, y: pos.y, width: 0, height: 0 };
        setCrop(startCrop);
    }

    setInteraction({
        type,
        handle,
        startPos: { x: pos.x, y: pos.y },
        startCrop: startCrop ? { ...startCrop } : null
    });
  };

  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (!imgRef.current || !interaction.startCrop) return;
    
    // Only process if mouse button is down (safety check)
    if (e.buttons === 0) {
        setInteraction(prev => ({ ...prev, type: 'create' })); // Reset to default
        return;
    }

    const pos = getRelativePos(e);
    const maxW = imgRef.current.width;
    const maxH = imgRef.current.height;
    const { startPos, startCrop } = interaction;

    if (interaction.type === 'move') {
        const dx = pos.x - startPos.x;
        const dy = pos.y - startPos.y;
        
        const newRect = {
            ...startCrop,
            x: startCrop.x + dx,
            y: startCrop.y + dy
        };
        
        setCrop(clampRect(newRect, maxW, maxH));
    } 
    else if (interaction.type === 'create') {
        let currentX = Math.max(0, Math.min(pos.x, maxW));
        let currentY = Math.max(0, Math.min(pos.y, maxH));
        
        // Use startCrop.x/y as anchor (which was set to mouseDown pos)
        const anchorX = startCrop.x;
        const anchorY = startCrop.y;

        let width = Math.abs(currentX - anchorX);
        let height = Math.abs(currentY - anchorY);
        
        // Apply Aspect Ratio
        if (aspectRatio) {
            if (width / height > aspectRatio) {
                height = width / aspectRatio;
            } else {
                width = height * aspectRatio;
            }
        }

        const dirX = currentX >= anchorX ? 1 : -1;
        const dirY = currentY >= anchorY ? 1 : -1;

        let x = anchorX + (dirX === -1 ? -width : 0);
        let y = anchorY + (dirY === -1 ? -height : 0);

        // Boundary Check for Create
        if (x < 0) { x = 0; if (aspectRatio) height = width/aspectRatio; } 
        if (y < 0) { y = 0; if (aspectRatio) width = height*aspectRatio; }
        if (x + width > maxW) { 
             // Simple clamp by shifting x if possible, or reducing size
             if (dirX === 1) width = maxW - x; 
             else x = maxW - width;
             if (aspectRatio) height = width / aspectRatio;
        }
        if (y + height > maxH) {
             if (dirY === 1) height = maxH - y;
             else y = maxH - height;
             if (aspectRatio) width = height * aspectRatio;
        }

        setCrop({ x, y, width, height });
    }
    else if (interaction.type === 'resize' && interaction.handle) {
        // Resizing logic
        // 1. Determine Anchor Point (Opposite to handle)
        let anchorX = 0, anchorY = 0;
        switch (interaction.handle) {
            case 'nw': anchorX = startCrop.x + startCrop.width; anchorY = startCrop.y + startCrop.height; break;
            case 'ne': anchorX = startCrop.x; anchorY = startCrop.y + startCrop.height; break;
            case 'sw': anchorX = startCrop.x + startCrop.width; anchorY = startCrop.y; break;
            case 'se': anchorX = startCrop.x; anchorY = startCrop.y; break;
        }

        // 2. Calculate raw new dimensions based on mouse pos relative to anchor
        // We do NOT clamp mouse pos here strictly yet, we calculate desired rect then fit.
        const currentX = Math.max(0, Math.min(pos.x, maxW));
        const currentY = Math.max(0, Math.min(pos.y, maxH));
        
        let newW = Math.abs(currentX - anchorX);
        let newH = Math.abs(currentY - anchorY);

        // 3. Apply Aspect Ratio
        if (aspectRatio) {
            // Standard projection: take the larger dimension change or just prefer width?
            // Let's rely on the handle direction.
            // For corners, usually we pick the dimension that results in a larger box? 
            // Or typically width drives height for stability.
            // Let's use width to drive height for consistent feel.
            newH = newW / aspectRatio;
            
            // Check if this height causes Y to go out of bounds?
            // If dragging SE, Y must be <= maxH.
            // If dragging NE, Y must be >= 0.
            const isNorth = interaction.handle.includes('n');
            const projectedY = isNorth ? anchorY - newH : anchorY + newH;
            
            if (projectedY < 0 || projectedY > maxH) {
                // Width-based height failed bounds, try Height-based width
                newH = Math.abs(currentY - anchorY); // Revert to raw Y
                newW = newH * aspectRatio;
            }
        }

        // 4. Reconstruct Rect
        let newX = interaction.handle.includes('w') ? anchorX - newW : anchorX;
        let newY = interaction.handle.includes('n') ? anchorY - newH : anchorY;

        // 5. Final Clamp (Double safety)
        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX + newW > maxW) newW = maxW - newX;
        if (newY + newH > maxH) newH = maxH - newY;
        
        // If clamp broke aspect ratio, strict re-calc? 
        // For cropping tool, slight drift is annoying, but hard clamp is better than broken UI.
        // We'll leave it as is, usually user corrects mouse.

        setCrop({ x: newX, y: newY, width: newW, height: newH });
    }
  };

  const handleGlobalMouseUp = () => {
      // Just reset to create/none state
      setInteraction(prev => ({ ...prev, type: 'create', startCrop: null }));
  };

  useEffect(() => {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleGlobalMouseMove);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
  }, [interaction]);

  // Adjust existing crop when ratio changes
  useEffect(() => {
      if (crop && aspectRatio && crop.width > 0 && crop.height > 0) {
          // Keep center, adjust size
          const centerX = crop.x + crop.width / 2;
          const centerY = crop.y + crop.height / 2;
          
          let newW = crop.width;
          let newH = newW / aspectRatio;
          
          if (newH > (imgRef.current?.height || 0)) {
              newH = imgRef.current?.height || 0;
              newW = newH * aspectRatio;
          }

          let newX = centerX - newW / 2;
          let newY = centerY - newH / 2;
          
          if (imgRef.current) {
             const rect = clampRect({ x: newX, y: newY, width: newW, height: newH }, imgRef.current.width, imgRef.current.height);
             setCrop(rect);
          }
      }
  }, [aspectRatio]);

  const handleConfirm = () => {
    const currentImage = frameImage;
    if (!currentImage) { onCancel(); return; }
    if (!imgRef.current || !crop || crop.width === 0) { onConfirm(currentImage); return; }
    const canvas = document.createElement('canvas');
    const sx = imgRef.current.naturalWidth / imgRef.current.width;
    const sy = imgRef.current.naturalHeight / imgRef.current.height;

    canvas.width = crop.width * sx;
    canvas.height = crop.height * sy;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(imgRef.current, crop.x * sx, crop.y * sy, crop.width * sx, crop.height * sy, 0, 0, crop.width * sx, crop.height * sy);
      onConfirm(canvas.toDataURL('image/png'));
    }
  };

  // 视频帧选择界面
  if (isSelectingFrame && videoSrc) {
    return (
      <div className="fixed inset-0 z-[200] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
        {/* Top Bar: Title */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="bg-[#ffffff]/90 backdrop-blur-md px-6 py-2.5 rounded-full border border-slate-300 text-slate-600 text-xs font-medium flex items-center gap-2 shadow-2xl">
            <Film size={14} className="text-green-500" />
            <span>选择关键帧</span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">拖动滑块选择视频帧</span>
        </div>

        {/* Video Player */}
        <div className="relative max-w-[85vw] max-h-[55vh] border border-slate-300 shadow-2xl rounded-lg overflow-hidden bg-black">
          {(isVideoLoading || !videoBlobUrl) && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
              <Loader2 className="animate-spin text-white" size={32} />
            </div>
          )}
          {videoBlobUrl && (
            <video
              ref={setVideoRef}
              src={videoBlobUrl}
              className="max-w-full max-h-[55vh] object-contain block"
              muted
              playsInline
              preload="auto"
            />
          )}
        </div>

        {/* Frame Selector */}
        <div className="flex flex-col items-center gap-4 mt-6 w-full max-w-2xl px-4">
          {/* Time Display */}
          <div className="flex items-center gap-4 text-sm font-mono">
            <span className="text-green-500 font-bold">{formatTime(currentTime)}</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-500">{formatTime(videoDuration)}</span>
          </div>

          {/* Slider */}
          <div className="w-full px-4" onMouseDown={(e) => e.stopPropagation()}>
            <input
              type="range"
              min={0}
              max={videoDuration || 1}
              step={0.01}
              value={currentTime}
              onChange={handleSliderChange}
              onInput={(e) => {
                const time = parseFloat((e.target as HTMLInputElement).value);
                setCurrentTime(time);
                if (videoRef.current) {
                  videoRef.current.currentTime = time;
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={!videoBlobUrl || videoDuration === 0}
              className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ touchAction: 'none' }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-4">
            <button onClick={onCancel} className="px-6 py-2.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs font-medium transition-colors border border-slate-200">
              取消
            </button>
            <button
              onClick={captureFrame}
              disabled={isVideoLoading}
              className={`px-8 py-2.5 rounded-full text-xs font-bold shadow-lg transition-all flex items-center gap-2 ${
                isVideoLoading
                  ? 'bg-slate-50 text-slate-500 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-400 text-black hover:scale-105 shadow-green-500/20'
              }`}
            >
              <Check size={14} /> 选择此帧
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 没有图片时显示错误
  if (!frameImage) {
    return (
      <div className="fixed inset-0 z-[200] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center">
        <span className="text-slate-500">无可用图片</span>
        <button onClick={onCancel} className="mt-4 px-6 py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
          关闭
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">

      {/* Top Bar: Title */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="bg-[#ffffff]/90 backdrop-blur-md px-6 py-2.5 rounded-full border border-slate-300 text-slate-600 text-xs font-medium flex items-center gap-2 shadow-2xl">
            <Crop size={14} className="text-blue-400" />
            <span>局部分镜截取</span>
        </div>
        <span className="text-[10px] text-slate-500 font-medium">拖拽四角调整 • 按住中间移动</span>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className="relative max-w-[85vw] max-h-[65vh] border border-slate-300 shadow-2xl rounded-lg overflow-hidden select-none bg-white/80 group"
        style={{ cursor: 'crosshair' }}
        onMouseDown={(e) => handleMouseDown(e, 'create')}
      >
        <img ref={imgRef} src={frameImage} className="max-w-full max-h-[65vh] object-contain block opacity-50" draggable={false} />

        {/* Active Crop Area */}
        {crop && crop.width > 0 && (
            <div className="absolute" style={{ left: crop.x, top: crop.y, width: crop.width, height: crop.height }}>
                 {/* 1. Clear Image View Inside */}
                 <div className="absolute inset-0 overflow-hidden">
                    <img
                        src={frameImage}
                        className="absolute max-w-none"
                        style={{
                            width: imgRef.current?.width,
                            height: imgRef.current?.height,
                            left: -crop.x,
                            top: -crop.y,
                            opacity: 1
                        }}
                    />
                 </div>
                 
                 {/* 2. Dark Overlay Outline (Outside shadow trick) */}
                 <div className="absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] pointer-events-none" />

                 {/* 3. Grid & Border */}
                 <div className="absolute inset-0 border-2 border-blue-400 z-10 pointer-events-none">
                     <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
                        <div className="border-r border-slate-2000"/><div className="border-r border-slate-2000"/><div className="col-span-3 border-b border-slate-2000 -mt-[33%]"/><div className="col-span-3 border-b border-slate-2000 mt-[33%]"/>
                     </div>
                 </div>

                 {/* 4. Move Handler (Invisible Center) */}
                 <div 
                    className="absolute inset-0 z-20 cursor-move group/move"
                    onMouseDown={(e) => handleMouseDown(e, 'move')}
                 >
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/move:opacity-100 transition-opacity duration-200">
                        <div className="bg-white/80 p-2 rounded-full backdrop-blur-sm">
                            <Move size={16} className="text-slate-900" />
                        </div>
                    </div>
                 </div>

                 {/* 5. Resize Handles (Corners) */}
                 {['nw', 'ne', 'sw', 'se'].map((h) => (
                     <div 
                        key={h}
                        className={`
                            absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full z-30 shadow-sm
                            hover:scale-125 transition-transform
                        `}
                        style={{
                            cursor: `${h}-resize`,
                            left: h.includes('w') ? -8 : 'auto',
                            right: h.includes('e') ? -8 : 'auto',
                            top: h.includes('n') ? -8 : 'auto',
                            bottom: h.includes('s') ? -8 : 'auto',
                        }}
                        onMouseDown={(e) => handleMouseDown(e, 'resize', h as ResizeHandle)}
                     />
                 ))}

                 {/* Size Label */}
                 <div className="absolute -top-7 left-0 flex gap-2 z-20 pointer-events-none">
                    <div className="bg-blue-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-md">
                        {Math.round(crop.width)} × {Math.round(crop.height)}
                    </div>
                    {aspectRatio && (
                        <div className="bg-white/90 text-blue-400 border border-blue-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-md">
                           {RATIOS.find(r => r.value === aspectRatio)?.label}
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* Bottom Bar: Aspect Ratios & Actions */}
      <div className="flex flex-col items-center gap-6 mt-8 w-full max-w-2xl px-4">
        
        {/* Aspect Ratio Selector */}
        <div className="flex items-center gap-2 p-1 bg-white border border-slate-300 rounded-xl shadow-lg overflow-x-auto custom-scrollbar max-w-full">
            {RATIOS.map(ratio => (
                <button
                    key={ratio.label}
                    onClick={() => setAspectRatio(ratio.value)}
                    className={`
                        relative px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap
                        ${aspectRatio === ratio.value 
                            ? 'bg-blue-500 text-black shadow-md scale-105 z-10' 
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }
                    `}
                >
                    {ratio.label}
                </button>
            ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
            <button onClick={onCancel} className="px-6 py-2.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs font-medium transition-colors border border-slate-200">
                取消
            </button>
            <button 
                onClick={handleConfirm} 
                disabled={!crop || crop.width === 0}
                className={`
                    px-8 py-2.5 rounded-full text-xs font-bold shadow-lg transition-all flex items-center gap-2
                    ${(!crop || crop.width === 0) 
                        ? 'bg-slate-50 text-slate-500 cursor-not-allowed' 
                        : 'bg-blue-500 hover:bg-cyan-400 text-black hover:scale-105 shadow-cyan-500/20'
                    }
                `}
            >
                <Check size={14}/> 确认裁剪
            </button>
        </div>
      </div>
    </div>
  );
};