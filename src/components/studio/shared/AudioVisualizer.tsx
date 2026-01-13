"use client";

import React from 'react';

interface AudioVisualizerProps {
    isPlaying: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isPlaying }) => (
    <div className="flex items-center justify-center gap-[2px] h-12 w-full opacity-60">
        {[...Array(20)].map((_, i) => (
            <div
                key={i}
                className="w-1 bg-cyan-400/80 rounded-full"
                style={{
                    height: isPlaying ? `${20 + Math.random() * 80}%` : '20%',
                    transition: 'height 0.1s ease',
                    animation: isPlaying ? `pulse 0.5s infinite ${i * 0.05}s` : 'none'
                }}
            />
        ))}
    </div>
);

export default AudioVisualizer;
