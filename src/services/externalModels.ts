/**
 * External Model API Service
 *
 * 支持的模型:
 * - Veo (Google视频生成) - veo2, veo3, veo3.1 系列
 * - Seedream (即梦4绘图) - doubao-seedream-4-5-251128
 * - Nano-banana (Gemini绘图优化) - nano-banana, nano-banana-hd, nano-banana-2
 */

// API 配置
const getApiConfig = () => {
    const baseUrl = process.env.NEXT_PUBLIC_OPENAI_BASE_URL ||
                    process.env.OPENAI_BASE_URL ||
                    'https://api.bltcy.ai';
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
                   process.env.OPENAI_API_KEY ||
                   (typeof window !== 'undefined' ? localStorage.getItem('openai_api_key') : null);

    return { baseUrl, apiKey };
};

// 通用错误处理
const handleApiError = (error: any): string => {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error?.message) return error.error.message;
    return JSON.stringify(error);
};

// 等待函数
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== 模型定义 ====================

export const VIDEO_MODELS = {
    // Veo 3.1 系列 (最新)
    'veo3.1': { id: 'veo3.1', name: 'Veo 3.1', description: '支持视频自动配套音频生成，性价比最高', supportsImage: true },
    'veo3.1-pro': { id: 'veo3.1-pro', name: 'Veo 3.1 Pro', description: '质量超高，价格也超高', supportsImage: true },
    'veo3.1-components': { id: 'veo3.1-components', name: 'Veo 3.1 Components', description: '多图参考（1-3张图）', supportsImage: true },

    // Veo 3 系列
    'veo3': { id: 'veo3', name: 'Veo 3', description: '标准质量' },
    'veo3-fast': { id: 'veo3-fast', name: 'Veo 3 Fast', description: '快速生成' },
    'veo3-pro': { id: 'veo3-pro', name: 'Veo 3 Pro', description: '高质量' },
    'veo3-pro-frames': { id: 'veo3-pro-frames', name: 'Veo 3 Pro Frames', description: '支持图生视频', supportsImage: true },
    'veo3-fast-frames': { id: 'veo3-fast-frames', name: 'Veo 3 Fast Frames', description: '快速图生视频', supportsImage: true },

    // Veo 2 系列
    'veo2': { id: 'veo2', name: 'Veo 2', description: '标准质量' },
    'veo2-fast': { id: 'veo2-fast', name: 'Veo 2 Fast', description: '快速生成' },
    'veo2-pro': { id: 'veo2-pro', name: 'Veo 2 Pro', description: '高质量' },
    'veo2-fast-frames': { id: 'veo2-fast-frames', name: 'Veo 2 Fast Frames', description: '支持首尾帧', supportsImage: true },
    'veo2-fast-components': { id: 'veo2-fast-components', name: 'Veo 2 Components', description: '最多支持3个元素图', supportsImage: true },
} as const;

export const IMAGE_MODELS = {
    // Seedream (即梦4)
    'doubao-seedream-4-5-251128': {
        id: 'doubao-seedream-4-5-251128',
        name: '即梦4',
        description: '字节跳动最新绘图模型，支持多图参考',
        supportsMultiImage: true,
        supportsSequential: true
    },

    // Nano-banana 系列
    'nano-banana': {
        id: 'nano-banana',
        name: 'Nano Banana',
        description: '基于Gemini优化的绘图模型，支持设置比例',
        supportsAspectRatio: true
    },
    'nano-banana-hd': {
        id: 'nano-banana-hd',
        name: 'Nano Banana HD',
        description: '高清版4K画质',
        supportsAspectRatio: true
    },
    'nano-banana-2': {
        id: 'nano-banana-2',
        name: 'Nano Banana 2',
        description: '支持1K/2K/4K分辨率设置',
        supportsAspectRatio: true,
        supportsImageSize: true
    },
} as const;

// ==================== Veo API ====================

export interface VeoGenerateOptions {
    prompt: string;
    model: string;
    aspectRatio?: '16:9' | '9:16';
    enhancePrompt?: boolean;
    enableUpsample?: boolean;
    images?: string[]; // URL or base64 for image-to-video
}

export interface VeoTaskResult {
    task_id: string;
    status: 'NOT_START' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';
    progress?: string;
    fail_reason?: string;
    data?: {
        output?: string; // Video URL
    };
}

/**
 * 发起Veo视频生成任务
 */
export const createVeoTask = async (options: VeoGenerateOptions): Promise<string> => {
    const { baseUrl, apiKey } = getApiConfig();

    if (!apiKey) {
        throw new Error('API Key未配置，请在设置中配置');
    }

    const body: any = {
        prompt: options.prompt,
        model: options.model,
    };

    if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
    if (options.enhancePrompt !== undefined) body.enhance_prompt = options.enhancePrompt;
    if (options.enableUpsample !== undefined) body.enable_upsample = options.enableUpsample;
    if (options.images && options.images.length > 0) body.images = options.images;

    const response = await fetch(`${baseUrl}/v2/videos/generations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Veo API错误: ${response.status} - ${handleApiError(errorData)}`);
    }

    const result = await response.json();
    return result.task_id;
};

/**
 * 查询Veo任务状态
 */
export const queryVeoTask = async (taskId: string): Promise<VeoTaskResult> => {
    const { baseUrl, apiKey } = getApiConfig();

    if (!apiKey) {
        throw new Error('API Key未配置');
    }

    const response = await fetch(`${baseUrl}/v2/videos/generations/${taskId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Veo查询错误: ${response.status} - ${handleApiError(errorData)}`);
    }

    return response.json();
};

/**
 * 生成Veo视频 (包含轮询等待)
 */
export const generateVeoVideo = async (
    options: VeoGenerateOptions,
    onProgress?: (progress: string) => void
): Promise<string> => {
    const taskId = await createVeoTask(options);

    // 轮询等待结果
    const maxAttempts = 120; // 最多等待10分钟 (120 * 5秒)
    let attempts = 0;

    while (attempts < maxAttempts) {
        await wait(5000); // 每5秒查询一次
        attempts++;

        const result = await queryVeoTask(taskId);

        if (result.progress) {
            onProgress?.(result.progress);
        }

        if (result.status === 'SUCCESS') {
            if (result.data?.output) {
                return result.data.output;
            }
            throw new Error('视频生成成功但未返回URL');
        }

        if (result.status === 'FAILURE') {
            throw new Error(`视频生成失败: ${result.fail_reason || '未知错误'}`);
        }
    }

    throw new Error('视频生成超时');
};

// ==================== Seedream API ====================

export interface SeedreamGenerateOptions {
    prompt: string;
    model?: string;
    images?: string[]; // 参考图数组
    n?: number; // 生成数量 1-3
    size?: string; // 如 '2K', '1024x1024'
    responseFormat?: 'url' | 'b64_json';
    sequentialImageGeneration?: 'auto' | string;
    watermark?: boolean;
    stream?: boolean;
}

export interface SeedreamResult {
    data: { url: string }[];
    created: number;
    usage: {
        total_tokens: number;
    };
}

/**
 * 使用即梦4生成图像
 */
export const generateSeedreamImage = async (options: SeedreamGenerateOptions): Promise<string[]> => {
    const { baseUrl, apiKey } = getApiConfig();

    if (!apiKey) {
        throw new Error('API Key未配置');
    }

    const body: any = {
        model: options.model || 'doubao-seedream-4-5-251128',
        prompt: options.prompt,
    };

    if (options.images && options.images.length > 0) body.image = options.images;
    if (options.n) body.n = String(options.n);
    if (options.size) body.size = options.size;
    if (options.responseFormat) body.response_format = options.responseFormat;
    if (options.sequentialImageGeneration) body.sequential_image_generation = options.sequentialImageGeneration;
    if (options.watermark !== undefined) body.watermark = options.watermark;
    if (options.stream !== undefined) body.stream = options.stream;

    const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Seedream API错误: ${response.status} - ${handleApiError(errorData)}`);
    }

    const result: SeedreamResult = await response.json();
    return result.data.map(d => d.url);
};

/**
 * 使用即梦4编辑图像
 */
export const editSeedreamImage = async (
    imageFile: File | Blob,
    prompt: string,
    options?: {
        model?: string;
        mask?: File | Blob;
        n?: number;
        size?: string;
    }
): Promise<string[]> => {
    const { baseUrl, apiKey } = getApiConfig();

    if (!apiKey) {
        throw new Error('API Key未配置');
    }

    const formData = new FormData();
    formData.append('model', options?.model || 'doubao-seedream-4-5-251128');
    formData.append('image', imageFile);
    formData.append('prompt', prompt);

    if (options?.mask) formData.append('mask', options.mask);
    if (options?.n) formData.append('n', String(options.n));
    if (options?.size) formData.append('size', options.size);
    formData.append('response_format', 'url');

    const response = await fetch(`${baseUrl}/v1/images/edits`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Seedream Edit API错误: ${response.status} - ${handleApiError(errorData)}`);
    }

    const result: SeedreamResult = await response.json();
    return result.data.map(d => d.url);
};

// ==================== Nano-banana API ====================

export interface NanoBananaGenerateOptions {
    prompt: string;
    model?: string;
    aspectRatio?: '4:3' | '3:4' | '16:9' | '9:16' | '2:3' | '3:2' | '1:1' | '4:5' | '5:4' | '21:9';
    responseFormat?: 'url' | 'b64_json';
    images?: string[]; // 参考图数组
    imageSize?: '1K' | '2K' | '4K'; // 仅nano-banana-2支持
}

export interface NanoBananaResult {
    data: { url?: string; b64_json?: string }[];
    created: number;
}

/**
 * 使用Nano-banana生成图像
 */
export const generateNanoBananaImage = async (options: NanoBananaGenerateOptions): Promise<string[]> => {
    const { baseUrl, apiKey } = getApiConfig();

    if (!apiKey) {
        throw new Error('API Key未配置');
    }

    const body: any = {
        model: options.model || 'nano-banana',
        prompt: options.prompt,
        response_format: options.responseFormat || 'url',
    };

    if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
    if (options.images && options.images.length > 0) body.image = options.images;
    if (options.imageSize && options.model === 'nano-banana-2') body.image_size = options.imageSize;

    const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Nano-banana API错误: ${response.status} - ${handleApiError(errorData)}`);
    }

    const result: NanoBananaResult = await response.json();
    return result.data.map(d => d.url || `data:image/png;base64,${d.b64_json}`).filter(Boolean) as string[];
};

/**
 * 使用Nano-banana编辑图像 (Edits兼容)
 */
export const editNanoBananaImage = async (
    imageFiles: File[] | Blob[],
    prompt: string,
    options?: {
        model?: string;
        aspectRatio?: string;
        imageSize?: '1K' | '2K' | '4K';
    }
): Promise<string[]> => {
    const { baseUrl, apiKey } = getApiConfig();

    if (!apiKey) {
        throw new Error('API Key未配置');
    }

    const formData = new FormData();
    formData.append('model', options?.model || 'nano-banana');
    formData.append('prompt', prompt);
    formData.append('response_format', 'url');

    // 支持多图
    imageFiles.forEach(file => {
        formData.append('image', file);
    });

    if (options?.aspectRatio) formData.append('aspect_ratio', options.aspectRatio);
    if (options?.imageSize) formData.append('image_size', options.imageSize);

    const response = await fetch(`${baseUrl}/v1/images/edits`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Nano-banana Edit API错误: ${response.status} - ${handleApiError(errorData)}`);
    }

    const result: NanoBananaResult = await response.json();
    return result.data.map(d => d.url || `data:image/png;base64,${d.b64_json}`).filter(Boolean) as string[];
};

// ==================== 统一调用接口 ====================

export type ModelProvider = 'veo' | 'seedream' | 'nano-banana' | 'gemini';

/**
 * 判断模型提供商
 */
export const getModelProvider = (modelId: string): ModelProvider => {
    if (modelId.startsWith('veo')) return 'veo';
    if (modelId.includes('seedream') || modelId.includes('doubao')) return 'seedream';
    if (modelId.includes('nano-banana')) return 'nano-banana';
    return 'gemini';
};

/**
 * 统一图像生成接口
 */
export const generateImage = async (
    prompt: string,
    model: string,
    options?: {
        aspectRatio?: string;
        images?: string[];
        count?: number;
        imageSize?: string;
    }
): Promise<string[]> => {
    const provider = getModelProvider(model);

    switch (provider) {
        case 'seedream':
            return generateSeedreamImage({
                prompt,
                model,
                images: options?.images,
                n: options?.count,
                size: options?.imageSize,
            });

        case 'nano-banana':
            return generateNanoBananaImage({
                prompt,
                model,
                aspectRatio: options?.aspectRatio as any,
                images: options?.images,
                imageSize: options?.imageSize as any,
            });

        default:
            // Gemini模型由原有geminiService处理
            throw new Error(`模型 ${model} 需要使用原生Gemini服务`);
    }
};

/**
 * 统一视频生成接口
 */
export const generateVideo = async (
    prompt: string,
    model: string,
    options?: {
        aspectRatio?: string;
        images?: string[];
        enhancePrompt?: boolean;
        enableUpsample?: boolean;
    },
    onProgress?: (progress: string) => void
): Promise<string> => {
    const provider = getModelProvider(model);

    if (provider === 'veo') {
        return generateVeoVideo({
            prompt,
            model,
            aspectRatio: options?.aspectRatio as any,
            images: options?.images,
            enhancePrompt: options?.enhancePrompt,
            enableUpsample: options?.enableUpsample,
        }, onProgress);
    }

    // Gemini Veo模型由原有服务处理
    throw new Error(`模型 ${model} 需要使用原生Gemini服务`);
};

/**
 * 检查API配置是否有效
 */
export const checkApiConfig = (): { isValid: boolean; message: string } => {
    const { apiKey } = getApiConfig();

    if (!apiKey) {
        return { isValid: false, message: 'API Key未配置' };
    }

    return { isValid: true, message: 'API配置有效' };
};
