"use client";

import React, { memo } from 'react';
import type { SelectionRect as SelectionRectType } from '@/hooks/canvas';

interface SelectionRectProps {
    rect: SelectionRectType | null;
    pan: { x: number; y: number };
    scale: number;
}

/**
 * 框选矩形组件
 * 显示用户拖拽框选时的可视化矩形区域
 */
const SelectionRectComponent: React.FC<SelectionRectProps> = ({ rect, pan, scale }) => {
    if (!rect) return null;

    const left = (Math.min(rect.startX, rect.currentX) - pan.x) / scale;
    const top = (Math.min(rect.startY, rect.currentY) - pan.y) / scale;
    const width = Math.abs(rect.currentX - rect.startX) / scale;
    const height = Math.abs(rect.currentY - rect.startY) / scale;

    return (
        <div
            className="absolute border border-cyan-500/40 bg-cyan-500/10 rounded-lg pointer-events-none"
            style={{ left, top, width, height }}
        />
    );
};

export const SelectionRect = memo(SelectionRectComponent);
