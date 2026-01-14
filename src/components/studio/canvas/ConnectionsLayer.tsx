"use client";

import React, { memo } from 'react';
import type { AppNode, Connection, Group } from '@/types';
import type { ConnectionStart } from '@/hooks/canvas';
import { generateBezierPath, getApproxNodeHeight, PORT_OFFSET } from './utils';

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    id: string;
}

interface ContextMenuTarget {
    type: 'connection';
    from: string;
    to: string;
}

interface ConnectionsLayerProps {
    connections: Connection[];
    nodes: AppNode[];
    groups: Group[];
    theme: 'light' | 'dark';
    scale: number;
    pan: { x: number; y: number };
    mousePos: { x: number; y: number };
    connectionStart: ConnectionStart | null;
    connectionPathsRef: React.MutableRefObject<Map<string, SVGPathElement>>;
    setContextMenu: (menu: ContextMenuState) => void;
    setContextMenuTarget: (target: ContextMenuTarget) => void;
}

/**
 * 连接线 SVG 层
 * 渲染节点间的连接线和连接预览线
 */
const ConnectionsLayerComponent: React.FC<ConnectionsLayerProps> = ({
    connections,
    nodes,
    groups,
    theme,
    scale,
    pan,
    mousePos,
    connectionStart,
    connectionPathsRef,
    setContextMenu,
    setContextMenuTarget,
}) => {
    return (
        <svg
            className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-0"
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}
        >
            {/* 连接线 */}
            {connections.map((conn) => {
                const f = nodes.find(n => n.id === conn.from);
                const t = nodes.find(n => n.id === conn.to);
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

                const tx = t.x - PORT_OFFSET;
                let ty = t.y + tH / 2;
                if (Math.abs(fy - ty) < 0.5) ty += 0.5;
                if (isNaN(fx) || isNaN(fy) || isNaN(tx) || isNaN(ty)) return null;

                const d = generateBezierPath(fx, fy, tx, ty);
                const isAutoConnection = conn.isAuto;
                const connKey = `${conn.from}-${conn.to}`;

                const handleClick = (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: connKey });
                    setContextMenuTarget({ type: 'connection', from: conn.from, to: conn.to });
                };

                return (
                    <g key={connKey} className="pointer-events-auto group/line">
                        <path
                            ref={(el) => {
                                if (el) connectionPathsRef.current.set(connKey, el);
                                else connectionPathsRef.current.delete(connKey);
                            }}
                            d={d}
                            stroke={isAutoConnection
                                ? `url(#${theme === 'dark' ? 'autoGradientDark' : 'autoGradient'})`
                                : `url(#${theme === 'dark' ? 'gradientDark' : 'gradient'})`
                            }
                            strokeWidth={(isAutoConnection ? 2 : 3) / scale}
                            fill="none"
                            strokeOpacity={isAutoConnection ? "0.4" : "0.5"}
                            strokeDasharray={isAutoConnection ? `${8 / scale} ${4 / scale}` : "none"}
                            className="transition-colors duration-300 group-hover/line:stroke-white group-hover/line:stroke-opacity-40"
                        />
                        <path
                            ref={(el) => {
                                if (el) connectionPathsRef.current.set(`${connKey}-hit`, el);
                                else connectionPathsRef.current.delete(`${connKey}-hit`);
                            }}
                            d={d}
                            stroke="transparent"
                            strokeWidth="15"
                            fill="none"
                            style={{ cursor: 'pointer' }}
                            onClick={handleClick}
                            onContextMenu={handleClick}
                        />
                    </g>
                );
            })}

            {/* 渐变定义 */}
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

            {/* 连接预览线 */}
            {connectionStart && (() => {
                let startX = 0, startY = 0;
                if (connectionStart.id === 'smart-sequence-dock') {
                    startX = (connectionStart.screenX - pan.x) / scale;
                    startY = (connectionStart.screenY - pan.y) / scale;
                } else if (connectionStart.id.startsWith('group:')) {
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
    );
};

export const ConnectionsLayer = memo(ConnectionsLayerComponent);
