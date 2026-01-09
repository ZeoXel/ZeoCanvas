"use client";

import React from 'react';

// --- Scene Director Overlay (Timeline & Crop) ---
interface SceneDirectorOverlayProps {
    visible: boolean;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    onCrop: () => void;
    onTimeHover: (time: number) => void;
}

export const SceneDirectorOverlay: React.FC<SceneDirectorOverlayProps> = ({ visible, videoRef, onCrop, onTimeHover }) => {
    const timelineRef = React.useRef<HTMLDivElement>(null);
    const [hoverTime, setHoverTime] = React.useState<number | null>(null);
    const [duration, setDuration] = React.useState(0);

    React.useEffect(() => {
        const vid = videoRef.current;
        if (vid) {
            setDuration(vid.duration || 0);
            const updateDur = () => setDuration(vid.duration);
            vid.addEventListener('loadedmetadata', updateDur);
            return () => vid.removeEventListener('loadedmetadata', updateDur);
        }
    }, [videoRef]);

    if (!visible) return null;

    return (
        <div
            ref={timelineRef}
            className="absolute bottom-0 left-0 w-full h-9 bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-slate-300 flex items-center cursor-crosshair z-30 opacity-0 group-hover/media:opacity-100 transition-opacity duration-300"
            onMouseMove={(e) => {
                if (!timelineRef.current || !videoRef.current) return;
                const rect = timelineRef.current.getBoundingClientRect();
                const per = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
                const vid = videoRef.current;
                if (vid && Number.isFinite(vid.duration)) {
                    vid.currentTime = vid.duration * per;
                    setHoverTime(vid.duration * per);
                    onTimeHover(vid.duration * per);
                }
            }}
            onClick={(e) => {
                e.stopPropagation();
                onCrop();
            }}
        >
            {hoverTime !== null && duration > 0 && <div className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-10 shadow-[0_0_8px_rgba(34,211,238,0.8)]" style={{ left: `${(hoverTime / duration) * 100}%` }} />}
            <div className="w-full text-center text-[9px] text-slate-500 font-bold tracking-widest pointer-events-none">Scene Director Timeline</div>
        </div>
    );
};
