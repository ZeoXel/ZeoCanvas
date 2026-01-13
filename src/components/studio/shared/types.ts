// Shared types for node components

import { AppNode, NodeStatus, NodeType } from '@/types';

export interface InputAsset {
    id: string;
    type: 'image' | 'video';
    src: string;
}

export interface NodeProps {
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
    onOutputPortAction?: (nodeId: string, position: { x: number, y: number }) => void;
    onInputPortAction?: (nodeId: string, position: { x: number, y: number }) => void;
    onNodeContextMenu: (e: React.MouseEvent, id: string) => void;
    onMediaContextMenu?: (e: React.MouseEvent, nodeId: string, type: 'image' | 'video', src: string) => void;
    onResizeMouseDown: (e: React.MouseEvent, id: string, initialWidth: number, initialHeight: number) => void;
    onDragResultToCanvas?: (sourceNodeId: string, type: 'image' | 'video', src: string, canvasX: number, canvasY: number) => void;
    onGridDragStateChange?: (state: { isDragging: boolean; type?: 'image' | 'video'; src?: string; screenX?: number; screenY?: number } | null) => void;
    inputAssets?: InputAsset[];
    onInputReorder?: (nodeId: string, newOrder: string[]) => void;
    nodeRef?: (el: HTMLDivElement | null) => void;

    isDragging?: boolean;
    isGroupDragging?: boolean;
    isSelected?: boolean;
    isResizing?: boolean;
    isConnecting?: boolean;
    zoom?: number;
}

// Props for internal node content renderers
export interface NodeContentProps {
    node: AppNode;
    isWorking: boolean;
    isHovered: boolean;
    inputAssets?: InputAsset[];

    // Media refs and handlers
    mediaRef: React.RefObject<HTMLImageElement | HTMLVideoElement | HTMLAudioElement | null>;
    fileInputRef: React.RefObject<HTMLInputElement>;

    // Event handlers
    onUpdate: NodeProps['onUpdate'];
    onAction: NodeProps['onAction'];
    onCrop?: NodeProps['onCrop'];
    onMediaContextMenu?: NodeProps['onMediaContextMenu'];

    // Local state handlers
    handleMouseEnter: () => void;
    handleMouseLeave: () => void;
}

// Props for bottom panel renderers
export interface NodePanelProps extends NodeContentProps {
    isOpen: boolean;
    isInputFocused: boolean;
    inverseScale: number;
    setIsInputFocused: (focused: boolean) => void;
}

// Node config type
export interface NodeConfig {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    border: string;
}

// Re-export NodeType and NodeStatus for convenience
export { NodeType, NodeStatus };
