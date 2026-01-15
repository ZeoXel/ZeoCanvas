/**
 * 厂商服务统一入口
 *
 * 架构说明：
 * - 图像生成: 使用 image.ts 统一处理
 * - 视频生成: 按厂商分离 (veo.ts, seedance.ts, vidu.ts)
 * - 音频服务: 按厂商分离 (minimax.ts, suno.ts)
 */

// ==================== 共享工具 ====================
export * from './shared';

// ==================== 图像服务 ====================
export * as image from './image';
export * as seedream from './seedream';
export { generateImage, editImage, IMAGE_MODELS } from './image';
export { SIZE_MAP as SEEDREAM_SIZE_MAP } from './seedream';

// ==================== 视频服务 ====================
export * as veo from './veo';
export * as seedance from './seedance';
export * as vidu from './vidu';

import * as veoService from './veo';
import * as seedanceService from './seedance';
import * as viduService from './vidu';

// ==================== 音频服务 ====================
export * as minimax from './minimax';
export * as suno from './suno';

// ==================== 视频路由 ====================

export type VideoProviderId = 'veo' | 'seedance' | 'vidu';

export const getVideoProviderId = (modelId: string): VideoProviderId | undefined => {
  if (modelId.startsWith('veo')) return 'veo';
  if (modelId.startsWith('vidu')) return 'vidu';
  if (modelId.includes('seedance') || modelId.includes('doubao-seedance')) return 'seedance';
  return undefined;
};

export interface GenerateVideoOptions {
  prompt: string;
  model: string;
  aspectRatio?: string;
  duration?: number;
  images?: string[];
  imageRoles?: ('first_frame' | 'last_frame')[];
  enhancePrompt?: boolean;
  videoConfig?: {
    // Seedance
    return_last_frame?: boolean;
    generate_audio?: boolean;
    camera_fixed?: boolean;
    watermark?: boolean;
    service_tier?: 'default' | 'flex';
    seed?: number;
    // Veo
    enhance_prompt?: boolean;
    // Vidu
    resolution?: '540p' | '720p' | '1080p';
    movement_amplitude?: 'auto' | 'small' | 'medium' | 'large';
    style?: 'general' | 'anime';
    bgm?: boolean;
  };
  // Vidu 主体参考
  viduSubjects?: { id: string; images: string[] }[];
}

/**
 * 统一视频生成接口
 */
export const generateVideo = async (
  options: GenerateVideoOptions,
  onProgress?: (progress: string) => void
): Promise<string> => {
  const providerId = getVideoProviderId(options.model);
  const config = options.videoConfig || {};

  switch (providerId) {
    case 'veo': {
      const result = await veoService.generateVideo({
        prompt: options.prompt,
        model: options.model as any,
        aspectRatio: options.aspectRatio as any,
        duration: options.duration,
        images: options.images,
        enhancePrompt: config.enhance_prompt ?? options.enhancePrompt,
      }, onProgress);
      return result.url;
    }

    case 'seedance': {
      const result = await seedanceService.generateVideo({
        prompt: options.prompt,
        model: options.model,
        duration: options.duration,
        images: options.images,
        imageRoles: options.imageRoles,
        return_last_frame: config.return_last_frame,
        generate_audio: config.generate_audio,
        camera_fixed: config.camera_fixed,
        watermark: config.watermark,
        service_tier: config.service_tier,
        seed: config.seed,
      }, onProgress);
      return result.url;
    }

    case 'vidu': {
      // 根据输入参数自动判断生成模式
      let mode: viduService.GenerationMode = 'text2video';
      const images = options.images;
      const imageRoles = options.imageRoles;
      const viduSubjects = options.viduSubjects;

      // 优先检查是否有主体参考
      if (viduSubjects && viduSubjects.length > 0) {
        // 主体参考模式 - 使用 reference2video
        mode = 'reference';
        console.log(`[Vidu] Using reference mode with ${viduSubjects.length} subjects`);

        const result = await viduService.generateVideo({
          mode,
          model: options.model as viduService.ViduModel,
          prompt: options.prompt,
          // 将 viduSubjects 转换为 Vidu API 所需的 images 格式
          // reference2video 接受多张参考图
          images: viduSubjects.flatMap(s => s.images),
          duration: options.duration,
          resolution: config.resolution as viduService.Resolution,
          aspect_ratio: options.aspectRatio as viduService.AspectRatio,
          movement_amplitude: config.movement_amplitude as viduService.MovementAmplitude,
          bgm: config.bgm,
          watermark: config.watermark,
        }, onProgress);
        return result.videoUrl;
      }

      // 其他模式判断
      if (images && images.length >= 2 && imageRoles?.includes('first_frame') && imageRoles?.includes('last_frame')) {
        // 首尾帧模式
        mode = 'start-end';
      } else if (images && images.length > 0) {
        // 图生视频模式
        mode = 'img2video';
      }

      console.log(`[Vidu] Auto-detected mode: ${mode}, images: ${images?.length || 0}`);

      const result = await viduService.generateVideo({
        mode,
        model: options.model as viduService.ViduModel,
        prompt: options.prompt,
        images: images,
        duration: options.duration,
        resolution: config.resolution as viduService.Resolution,
        aspect_ratio: options.aspectRatio as viduService.AspectRatio,
        movement_amplitude: config.movement_amplitude as viduService.MovementAmplitude,
        style: config.style as viduService.Style,
        bgm: config.bgm,
        watermark: config.watermark,
      }, onProgress);
      return result.videoUrl;
    }

    default:
      throw new Error(`不支持的视频模型: ${options.model}`);
  }
};

// ==================== Vidu 专用接口 ====================

export interface GenerateViduVideoOptions {
  mode: viduService.GenerationMode;
  model: viduService.ViduModel;
  prompt?: string;
  images?: string[];
  duration?: number;
  resolution?: viduService.Resolution;
  aspect_ratio?: viduService.AspectRatio;
  movement_amplitude?: viduService.MovementAmplitude;
  style?: viduService.Style;
  bgm?: boolean;
  audio?: boolean;
  voice_id?: string;
  watermark?: boolean;
  start_image?: string;
  image_settings?: viduService.MultiframeOptions['image_settings'];
  subjects?: viduService.Subject[];
}

export const generateViduVideo = async (
  options: GenerateViduVideoOptions,
  onProgress?: (state: string) => void
): Promise<viduService.VideoGenerationResult> => {
  return await viduService.generateVideo(options, onProgress);
};
