import type { AppNode } from '@/types';
import { NodeType } from '@/types';
import { AUDIO_NODE_HEIGHT, DEFAULT_FIXED_HEIGHT } from '../shared';

// 连接点配置 - 与 Node.tsx 中的连接点位置保持一致
export const PORT_OFFSET = 12;

// 吸附阈值
export const SNAP_THRESHOLD = 8;

// 碰撞间距
export const COLLISION_PADDING = 24;

/**
 * 生成平滑贝塞尔曲线路径
 */
export const generateBezierPath = (fx: number, fy: number, tx: number, ty: number): string => {
    const dx = tx - fx;
    // 控制点偏移：水平距离越大，曲线越平缓；垂直落差越大，曲线越陡
    const controlX = Math.max(Math.abs(dx) * 0.5, 60);
    // 当终点在起点左边时（反向连接），调整控制点
    if (dx < 0) {
        const midX = (fx + tx) / 2;
        const midY = (fy + ty) / 2;
        return `M ${fx} ${fy} Q ${fx + 80} ${fy}, ${midX} ${midY} Q ${tx - 80} ${ty}, ${tx} ${ty}`;
    }
    return `M ${fx} ${fy} C ${fx + controlX} ${fy}, ${tx - controlX} ${ty}, ${tx} ${ty}`;
};

/**
 * 获取节点近似高度
 */
export const getApproxNodeHeight = (node: AppNode): number => {
    if (node.type === NodeType.AUDIO_GENERATOR) return AUDIO_NODE_HEIGHT;
    return DEFAULT_FIXED_HEIGHT;
};

/**
 * 获取节点边界
 */
export const getNodeBounds = (node: AppNode) => {
    const width = node.width || 420;
    const height = node.height || getApproxNodeHeight(node);
    return {
        x: node.x,
        y: node.y,
        width,
        height,
        r: node.x + width,
        b: node.y + height,
    };
};

/**
 * 获取图片尺寸
 */
export const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = src;
    });
};
