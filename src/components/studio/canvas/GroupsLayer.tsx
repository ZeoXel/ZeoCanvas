"use client";

import React, { memo } from 'react';
import { Plus } from 'lucide-react';
import type { AppNode, Group, NodeType as NodeTypeEnum } from '@/types';
import type { ConnectionStart } from '@/hooks/canvas';
import { getNodeBounds } from './utils';

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    id: string;
}

interface DraggingGroup {
    id: string;
}

interface DragGroupRef {
    id: string;
    startX: number;
    startY: number;
    mouseStartX: number;
    mouseStartY: number;
    childNodes: Array<{ id: string; startX: number; startY: number }>;
}

interface ResizeGroupRef {
    id: string;
    initialWidth: number;
    initialHeight: number;
    startX: number;
    startY: number;
}

interface GroupsLayerProps {
    groups: Group[];
    nodes: AppNode[];
    scale: number;
    pan: { x: number; y: number };
    connectionStart: ConnectionStart | null;
    draggingGroup: DraggingGroup | null;
    draggingNodeParentGroupId: string | null;
    resizingGroupId: string | null;
    selectedGroupIds: string[];
    groupRefsMap: React.MutableRefObject<Map<string, HTMLDivElement>>;
    dragGroupRef: React.MutableRefObject<DragGroupRef | null>;
    resizeGroupRef: React.MutableRefObject<ResizeGroupRef | null>;
    NodeType: typeof NodeTypeEnum;
    setSelection: (sel: { nodeIds: string[]; groupIds: string[] }) => void;
    setActiveGroupNodeIds: (ids: string[]) => void;
    setDraggingGroup: (g: DraggingGroup | null) => void;
    setContextMenu: (menu: ContextMenuState) => void;
    setContextMenuTarget: (target: { type: string; id?: string; groupId?: string; canvasX?: number; canvasY?: number }) => void;
    startConnecting: (start: ConnectionStart) => void;
    finishInteraction: () => void;
    setResizingGroupId: (id: string | null) => void;
}

/**
 * 分组渲染层
 * 渲染画布上的分组容器
 */
const GroupsLayerComponent: React.FC<GroupsLayerProps> = ({
    groups,
    nodes,
    scale,
    pan,
    connectionStart,
    draggingGroup,
    draggingNodeParentGroupId,
    resizingGroupId,
    selectedGroupIds,
    groupRefsMap,
    dragGroupRef,
    resizeGroupRef,
    NodeType,
    setSelection,
    setActiveGroupNodeIds,
    setDraggingGroup,
    setContextMenu,
    setContextMenuTarget,
    startConnecting,
    finishInteraction,
    setResizingGroupId,
}) => {
    return (
        <>
            {groups.map(g => (
                <div
                    key={g.id}
                    ref={(el) => {
                        if (el) groupRefsMap.current.set(g.id, el);
                        else groupRefsMap.current.delete(g.id);
                    }}
                    className={`absolute rounded-[32px] border transition-all ${
                        (draggingGroup?.id === g.id || draggingNodeParentGroupId === g.id || resizingGroupId === g.id)
                            ? 'duration-0'
                            : 'duration-300'
                    } ${
                        selectedGroupIds.includes(g.id)
                            ? 'border-blue-500/50 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    }`}
                    style={{ left: g.x, top: g.y, width: g.width, height: g.height }}
                    onMouseDown={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('[data-group-port]')) return;
                        if (target.closest('[data-resize-handle]')) return;
                        e.stopPropagation();
                        e.preventDefault();
                        setSelection({ nodeIds: [], groupIds: [g.id] });
                        const childNodes = nodes.filter(n => {
                            const b = getNodeBounds(n);
                            const cx = b.x + b.width / 2;
                            const cy = b.y + b.height / 2;
                            return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height;
                        }).map(n => ({ id: n.id, startX: n.x, startY: n.y }));
                        dragGroupRef.current = {
                            id: g.id,
                            startX: g.x,
                            startY: g.y,
                            mouseStartX: e.clientX,
                            mouseStartY: e.clientY,
                            childNodes
                        };
                        setActiveGroupNodeIds(childNodes.map(c => c.id));
                        setDraggingGroup({ id: g.id });
                    }}
                    onContextMenu={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: g.id });
                        setContextMenuTarget({ type: 'group', id: g.id });
                    }}
                >
                    <div className="absolute -top-8 left-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {g.title}
                    </div>

                    {/* 分组右侧连接点 - 仅当内容全部为图片素材时显示 */}
                    {(() => {
                        const groupNodes = nodes.filter(n => {
                            const b = getNodeBounds(n);
                            const cx = b.x + b.width / 2;
                            const cy = b.y + b.height / 2;
                            return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height;
                        });
                        const shouldShowPort = groupNodes.length > 0 && groupNodes.every(n => n.type === NodeType.IMAGE_ASSET);
                        if (!shouldShowPort) return null;

                        const inverseScale = 1 / Math.max(0.1, scale);
                        return (
                            <div
                                data-group-port="output"
                                className={`absolute rounded-full border bg-white dark:bg-slate-800 cursor-crosshair flex items-center justify-center transition-all duration-300 shadow-md z-50
                                    w-5 h-5 border-blue-400 hover:scale-150 hover:bg-blue-500 hover:border-blue-500 group/output
                                    ${connectionStart ? 'ring-2 ring-purple-400 animate-pulse' : ''}`}
                                style={{
                                    right: `${-12 * inverseScale}px`,
                                    top: '50%',
                                    transform: `translateY(-50%) scale(${inverseScale})`,
                                    transformOrigin: 'center center'
                                }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    const centerX = rect.left + rect.width / 2;
                                    const centerY = rect.top + rect.height / 2;
                                    startConnecting({
                                        id: `group:${g.id}`,
                                        portType: 'output',
                                        screenX: centerX,
                                        screenY: centerY
                                    });
                                }}
                                onMouseUp={(e) => {
                                    e.stopPropagation();
                                    if (connectionStart && connectionStart.id !== `group:${g.id}`) {
                                        // 分组只能作为输出端，不能接收连接
                                    }
                                    finishInteraction();
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    const canvasX = (e.clientX - pan.x) / scale;
                                    const canvasY = (e.clientY - pan.y) / scale;
                                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: g.id });
                                    setContextMenuTarget({ type: 'group-output-action', groupId: g.id, canvasX, canvasY });
                                }}
                                title="双击或拖拽创建下游节点"
                            >
                                <Plus size={12} strokeWidth={3} className="text-blue-400 group-hover/output:text-white transition-colors" />
                            </div>
                        );
                    })()}

                    {/* 分组右下角调整尺寸手柄 */}
                    <div
                        data-resize-handle
                        className="absolute w-5 h-5 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
                        style={{ right: 4, bottom: 4, zIndex: 100 }}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setResizingGroupId(g.id);
                            resizeGroupRef.current = {
                                id: g.id,
                                initialWidth: g.width,
                                initialHeight: g.height,
                                startX: e.clientX,
                                startY: e.clientY
                            };
                        }}
                    >
                        <svg viewBox="0 0 20 20" className="w-full h-full text-slate-400 dark:text-slate-500">
                            <path d="M17 17L7 17M17 17L17 7M17 17L10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                </div>
            ))}
        </>
    );
};

export const GroupsLayer = memo(GroupsLayerComponent);
