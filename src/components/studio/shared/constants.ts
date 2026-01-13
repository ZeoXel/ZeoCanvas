// Node constants and model configurations

export const IMAGE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
export const VIDEO_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
export const IMAGE_RESOLUTIONS = ['1k', '2k', '4k'];
export const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'];
export const IMAGE_COUNTS = [1, 2, 3, 4];
export const VIDEO_COUNTS = [1, 2, 3, 4];

// Seedream 比例到尺寸映射
export const SEEDREAM_SIZE_MAP: Record<string, string> = {
    '1:1': '2048x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '16:9': '2560x1440',
    '9:16': '1440x2560',
};

// 图像模型参数配置映射
export interface ImageModelConfig {
    supportsAspectRatio: boolean;
    supportsResolution: boolean;
    supportsMultiImage: boolean;
    aspectRatios?: string[];
    resolutions?: string[];
    defaultAspectRatio?: string;
    defaultResolution?: string;
    sizeMap?: Record<string, string>;  // 比例到尺寸映射
}

export const IMAGE_MODEL_CONFIG: Record<string, ImageModelConfig> = {
    'doubao-seedream-4-5-251128': {
        supportsAspectRatio: true,
        supportsResolution: false,
        supportsMultiImage: true,
        aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
        defaultAspectRatio: '1:1',
        sizeMap: SEEDREAM_SIZE_MAP,
    },
    'nano-banana': {
        supportsAspectRatio: true,
        supportsResolution: false,
        supportsMultiImage: true,
        aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
        defaultAspectRatio: '1:1',
    },
    'nano-banana-pro': {
        supportsAspectRatio: true,
        supportsResolution: false,
        supportsMultiImage: true,
        aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
        defaultAspectRatio: '1:1',
    },
};

// 获取模型配置
export const getImageModelConfig = (model: string): ImageModelConfig => {
    return IMAGE_MODEL_CONFIG[model] || {
        supportsAspectRatio: true,
        supportsResolution: false,
        supportsMultiImage: false,
        aspectRatios: IMAGE_ASPECT_RATIOS,
        defaultAspectRatio: '1:1',
    };
};

// Glass panel style
export const GLASS_PANEL = "bg-[#ffffff]/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-300 dark:border-slate-700 shadow-2xl";

// Node dimensions
export const DEFAULT_NODE_WIDTH = 420;
export const DEFAULT_FIXED_HEIGHT = 360;
export const AUDIO_NODE_HEIGHT = Math.round(DEFAULT_NODE_WIDTH * 9 / 16); // 16:9 比例 = 236

// 视频模型时长配置
export interface VideoDurationConfig {
    options: number[];  // 可选时长列表（-1 表示自动）
    default: number;    // 默认时长
    supportsFirstLastFrame?: boolean;  // 是否支持首尾帧
}

export const VIDEO_DURATION_CONFIG: Record<string, VideoDurationConfig> = {
    'doubao-seedance-1-5-pro-251215': {
        options: [-1, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        default: 5,
        supportsFirstLastFrame: true,
    },
    'veo3.1': {
        options: [5, 6, 7, 8],
        default: 8,
        supportsFirstLastFrame: true,  // 支持首尾帧
    },
    'veo3.1-pro': {
        options: [5, 6, 7, 8],
        default: 8,
        supportsFirstLastFrame: true,  // 支持首尾帧
    },
    'veo3.1-components': {
        options: [5, 6, 7, 8],
        default: 8,
        supportsFirstLastFrame: false,  // 多图参考模式，非首尾帧
    },
};

// 获取模型时长选项
export const getDurationOptions = (model?: string): number[] => {
    return VIDEO_DURATION_CONFIG[model || '']?.options || [5, 8];
};

// 获取模型默认时长
export const getDefaultDuration = (model?: string): number => {
    return VIDEO_DURATION_CONFIG[model || '']?.default || 5;
};

// 检查模型是否支持首尾帧
export const supportsFirstLastFrame = (model?: string): boolean => {
    return VIDEO_DURATION_CONFIG[model || '']?.supportsFirstLastFrame || false;
};
