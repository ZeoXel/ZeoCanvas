/**
 * Studio 服务 - Chat/Image/Video 生成
 *
 * 通过 USERAPI 网关调用
 */

import { chatCompletion, generateImage, gatewayPost, GatewayError, ChatMessage } from './gateway';

// ==================== Chat API ====================

export interface PromptEnhanceParams {
    prompt: string;
    mediaType?: 'image' | 'video';
    style?: string;
}

export interface StoryboardParams {
    prompt: string;
    scenes?: number;
}

export interface ChatParams {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
}

/**
 * AI 对话
 */
export const chat = async (params: ChatParams): Promise<string> => {
    try {
        const result = await chatCompletion({
            model: params.model || 'gpt-4o-mini',
            messages: params.messages,
            temperature: params.temperature ?? 0.7,
            max_tokens: params.max_tokens,
        });

        return result.choices[0]?.message?.content || '';
    } catch (error) {
        if (error instanceof GatewayError) {
            throw new Error(`Chat API 错误: ${error.message}`);
        }
        throw error;
    }
};

/**
 * 提示词增强
 */
export const enhancePrompt = async (params: PromptEnhanceParams): Promise<string> => {
    const systemPrompt = params.mediaType === 'video'
        ? `你是一个专业的视频提示词优化专家。将用户的简单描述扩展为详细的视频生成提示词。
           注意：
           - 添加动作描述和镜头运动
           - 描述光影和氛围
           - 保持场景连贯性
           - 使用英文输出`
        : `你是一个专业的图像提示词优化专家。将用户的简单描述扩展为详细的图像生成提示词。
           注意：
           - 添加艺术风格和画面构图
           - 描述光影和色调
           - 添加细节和质感描述
           - 使用英文输出`;

    return chat({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: params.prompt },
        ],
        model: 'gpt-4o-mini',
        temperature: 0.8,
    });
};

/**
 * 生成分镜脚本
 */
export const generateStoryboard = async (params: StoryboardParams): Promise<string> => {
    const systemPrompt = `你是一个专业的视频分镜师。根据用户描述生成分镜脚本。
        每个分镜包含：
        - 画面描述（英文）
        - 镜头类型
        - 预估时长
        输出 JSON 格式`;

    return chat({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `生成 ${params.scenes || 4} 个分镜: ${params.prompt}` },
        ],
        model: 'gpt-4o',
        temperature: 0.7,
    });
};

// ==================== Image API ====================

export interface ImageGenerateParams {
    prompt: string;
    model?: string;
    size?: string;
    n?: number;
}

export interface ImageResult {
    url?: string;
    b64_json?: string;
}

/**
 * 图像生成
 */
export const generateStudioImage = async (params: ImageGenerateParams): Promise<ImageResult[]> => {
    try {
        // Seedream 模型走火山引擎
        if (params.model?.startsWith('seedream')) {
            const result = await gatewayPost<{ data: ImageResult[] }>('volcengine', 'images/generations', {
                model: params.model,
                prompt: params.prompt,
                size: params.size || '1024x1024',
                n: params.n || 1,
            });
            return result.data;
        }

        // 其他模型走 OpenAI 兼容接口
        const result = await generateImage({
            model: params.model || 'dall-e-3',
            prompt: params.prompt,
            size: params.size || '1024x1024',
            n: params.n || 1,
        });

        return result.data;
    } catch (error) {
        if (error instanceof GatewayError) {
            throw new Error(`Image API 错误: ${error.message}`);
        }
        throw error;
    }
};

// ==================== Video API (Non-Vidu) ====================

export interface VideoGenerateParams {
    prompt: string;
    model?: string;
    image?: string;  // Base64 或 URL
    duration?: number;
}

export interface VideoResult {
    task_id?: string;
    video_url?: string;
    status?: string;
}

/**
 * 视频生成 (Veo 等非 Vidu 模型)
 */
export const generateStudioVideo = async (params: VideoGenerateParams): Promise<VideoResult> => {
    try {
        // Veo 模型
        if (params.model?.startsWith('veo')) {
            const result = await gatewayPost<VideoResult>('openai', 'v1/video/generations', {
                model: params.model,
                prompt: params.prompt,
                ...(params.image && { image: params.image }),
                ...(params.duration && { duration: params.duration }),
            });
            return result;
        }

        // 默认使用 OpenAI 兼容接口
        const result = await gatewayPost<VideoResult>('openai', 'v1/video/generations', {
            model: params.model || 'veo-2.0',
            prompt: params.prompt,
            ...(params.image && { image: params.image }),
        });

        return result;
    } catch (error) {
        if (error instanceof GatewayError) {
            throw new Error(`Video API 错误: ${error.message}`);
        }
        throw error;
    }
};
