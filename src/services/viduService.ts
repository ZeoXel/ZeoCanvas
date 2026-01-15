/**
 * Vidu 智能多帧视频生成服务
 *
 * 文档参考: docs/vidu智能多帧.md
 */

import { SmartSequenceItem } from '@/types';

// Vidu 模型选项
export const VIDU_MODELS = [
    { id: 'viduq2-turbo', name: 'ViduQ2 Turbo', description: '快速生成' },
    { id: 'viduq2-pro', name: 'ViduQ2 Pro', description: '高质量生成' },
] as const;

// Vidu 分辨率选项
export const VIDU_RESOLUTIONS = [
    { id: '540p', name: '540p', description: '标清' },
    { id: '720p', name: '720p', description: '高清 (默认)' },
    { id: '1080p', name: '1080p', description: '全高清' },
] as const;

// Vidu 水印位置选项
export const VIDU_WATERMARK_POSITIONS = [
    { id: 'top_left', name: '左上' },
    { id: 'top_right', name: '右上' },
    { id: 'bottom_left', name: '左下' },
    { id: 'bottom_right', name: '右下' },
] as const;

// 图片设置接口
export interface ViduImageSetting {
    key_image: string;    // 关键帧图像 (Base64 或 URL)
    prompt?: string;      // 转场提示词
    duration?: number;    // 时长 (2-7秒, 默认5秒)
}

// Vidu 多帧生成配置
export interface ViduMultiFrameConfig {
    model?: 'viduq2-turbo' | 'viduq2-pro';
    resolution?: '540p' | '720p' | '1080p';
    watermark?: boolean;
    wm_url?: string;
    wm_position?: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
}

// Vidu 任务响应
export interface ViduTaskResponse {
    success: boolean;
    taskId?: string;
    state?: string;
    videoUrl?: string;
    coverUrl?: string;
    watermarkedUrl?: string;
    creationId?: string;
    credits?: number;
    error?: string;
}

/**
 * 将 SmartSequenceItem 转换为 Vidu API 格式
 */
export function convertFramesToViduFormat(frames: SmartSequenceItem[]): {
    start_image: string;
    image_settings: ViduImageSetting[];
} {
    if (frames.length < 2) {
        throw new Error('Vidu 智能多帧至少需要2张图片');
    }

    // 第一帧作为 start_image
    const start_image = frames[0].src;

    // 后续帧作为 image_settings
    const image_settings: ViduImageSetting[] = frames.slice(1).map((frame, index) => ({
        key_image: frame.src,
        prompt: frames[index].transition?.prompt || undefined,
        duration: frames[index].transition?.duration || 5,
    }));

    return { start_image, image_settings };
}

/**
 * 使用 Vidu 智能多帧生成视频
 * 自动压缩图片以避免请求体过大
 */
export async function generateViduMultiFrame(
    frames: SmartSequenceItem[],
    config: ViduMultiFrameConfig = {}
): Promise<ViduTaskResponse> {
    try {
        console.log('[Vidu] Compressing images...');

        // 压缩所有图片
        const compressedFrames = await Promise.all(
            frames.map(async (frame) => ({
                ...frame,
                src: await compressImageForVidu(frame.src, 1.5), // 每张图片限制 1.5MB
            }))
        );

        const { start_image, image_settings } = convertFramesToViduFormat(compressedFrames);

        const requestBody = {
            mode: 'multiframe',  // 使用多帧模式
            model: config.model || 'viduq2-turbo',
            start_image,
            image_settings,
            resolution: config.resolution || '720p',
            watermark: config.watermark || false,
            ...(config.wm_url && { wm_url: config.wm_url }),
            ...(config.wm_position && { wm_position: config.wm_position }),
        };

        // 计算请求体大小
        const bodySize = JSON.stringify(requestBody).length;
        console.log(`[Vidu] Request body size: ${(bodySize / 1024 / 1024).toFixed(2)}MB`);

        const response = await fetch('/api/video/vidu', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.error || `API 错误: ${response.status}`,
            };
        }

        return {
            success: true,
            taskId: result.taskId,
            state: result.state,
            videoUrl: result.videoUrl,
            coverUrl: result.coverUrl,
            watermarkedUrl: result.watermarkedUrl,
            creationId: result.creationId,
            credits: result.credits,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || '网络请求失败',
        };
    }
}

/**
 * 查询 Vidu 任务状态和生成结果
 */
export async function queryViduTask(taskId: string): Promise<ViduTaskResponse> {
    try {
        const response = await fetch(`/api/video/vidu?task_id=${taskId}`, {
            method: 'GET',
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.error || `查询失败: ${response.status}`,
            };
        }

        return {
            success: true,
            taskId: result.taskId,
            state: result.state,
            videoUrl: result.videoUrl,
            coverUrl: result.coverUrl,
            watermarkedUrl: result.watermarkedUrl,
            creationId: result.creationId,
            credits: result.credits,
            error: result.error,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || '网络请求失败',
        };
    }
}

/**
 * 压缩图片以符合 Vidu API 要求
 * - 目标大小: < 2MB (为了确保请求体不超限)
 * - 最大分辨率: 1920x1080
 * - 输出格式: JPEG (更小的文件大小)
 */
export async function compressImageForVidu(imageDataUrl: string, maxSizeMB: number = 2): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // 计算目标尺寸 (保持宽高比，最大 1920x1080)
            let { width, height } = img;
            const maxWidth = 1920;
            const maxHeight = 1080;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // 尝试不同的质量级别，直到文件大小合适
            let quality = 0.9;
            let result = canvas.toDataURL('image/jpeg', quality);

            while (quality > 0.1) {
                const base64Data = result.split(',')[1];
                const sizeInMB = (base64Data.length * 3) / 4 / (1024 * 1024);

                if (sizeInMB <= maxSizeMB) {
                    console.log(`[Vidu] Image compressed: ${width}x${height}, ${sizeInMB.toFixed(2)}MB, quality=${quality}`);
                    resolve(result);
                    return;
                }

                quality -= 0.1;
                result = canvas.toDataURL('image/jpeg', quality);
            }

            // 如果还是太大，进一步缩小尺寸
            const smallerWidth = Math.round(width * 0.7);
            const smallerHeight = Math.round(height * 0.7);
            canvas.width = smallerWidth;
            canvas.height = smallerHeight;
            ctx.drawImage(img, 0, 0, smallerWidth, smallerHeight);
            result = canvas.toDataURL('image/jpeg', 0.8);

            console.log(`[Vidu] Image resized and compressed: ${smallerWidth}x${smallerHeight}`);
            resolve(result);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageDataUrl;
    });
}

/**
 * 验证图片格式是否符合 Vidu 要求
 * - 支持 png, jpeg, jpg, webp
 * - 比例需要小于 1:4 或 4:1
 * - 大小不超过 50MB
 */
export function validateViduImage(imageDataUrl: string): { valid: boolean; error?: string } {
    // 检查格式
    const formatMatch = imageDataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
    if (!formatMatch) {
        return { valid: false, error: '不支持的图片格式，请使用 PNG、JPEG 或 WebP' };
    }

    // 检查 base64 大小 (粗略估算)
    const base64Data = imageDataUrl.split(',')[1];
    const sizeInBytes = (base64Data.length * 3) / 4;
    const sizeInMB = sizeInBytes / (1024 * 1024);

    if (sizeInMB > 10) {
        return { valid: false, error: `图片过大 (${sizeInMB.toFixed(1)}MB)，Base64 解码后需小于 10MB` };
    }

    return { valid: true };
}
