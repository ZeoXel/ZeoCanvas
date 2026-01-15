/**
 * 厂商服务统一入口
 *
 * 按厂商组织的服务架构：
 * - 每个厂商一个独立文件
 * - 共享工具层抽取公共逻辑
 * - 统一路由自动分发请求
 */

// 导出共享工具
export * from './shared';

// 导出各厂商服务
export * as nanoBanana from './nanoBanana';
export * as seedream from './seedream';
export * as veo from './veo';
export * as seedance from './seedance';
export * as minimax from './minimax';
export * as suno from './suno';
export * as vidu from './vidu';

// 导入厂商信息
import { PROVIDER_INFO as NANO_BANANA_INFO } from './nanoBanana';
import { PROVIDER_INFO as SEEDREAM_INFO } from './seedream';
import { PROVIDER_INFO as VEO_INFO } from './veo';
import { PROVIDER_INFO as SEEDANCE_INFO } from './seedance';
import { PROVIDER_INFO as MINIMAX_INFO } from './minimax';
import { PROVIDER_INFO as SUNO_INFO } from './suno';
import { PROVIDER_INFO as VIDU_INFO } from './vidu';

// 导入服务函数
import * as nanoBananaService from './nanoBanana';
import * as seedreamService from './seedream';
import * as veoService from './veo';
import * as seedanceService from './seedance';
import * as minimaxService from './minimax';
import * as sunoService from './suno';
import * as viduService from './vidu';

// ==================== 厂商注册表 ====================

export type ProviderId = 'nano-banana' | 'seedream' | 'veo' | 'seedance' | 'minimax' | 'suno' | 'vidu';

export const PROVIDERS = {
  'nano-banana': NANO_BANANA_INFO,
  'seedream': SEEDREAM_INFO,
  'veo': VEO_INFO,
  'seedance': SEEDANCE_INFO,
  'minimax': MINIMAX_INFO,
  'suno': SUNO_INFO,
  'vidu': VIDU_INFO,
} as const;

// 模型ID到厂商ID的映射
const MODEL_TO_PROVIDER: Record<string, ProviderId> = {};

// 初始化映射
Object.values(PROVIDERS).forEach(provider => {
  provider.models.forEach(model => {
    MODEL_TO_PROVIDER[model.id] = provider.id as ProviderId;
  });
});

// ==================== 路由函数 ====================

/**
 * 根据模型ID获取厂商ID
 */
export const getProviderId = (modelId: string): ProviderId | undefined => {
  // 精确匹配
  if (MODEL_TO_PROVIDER[modelId]) {
    return MODEL_TO_PROVIDER[modelId];
  }
  // 前缀匹配
  if (modelId.startsWith('veo')) return 'veo';
  if (modelId.startsWith('vidu')) return 'vidu';
  if (modelId.includes('seedream') || modelId.includes('doubao-seedream')) return 'seedream';
  if (modelId.includes('seedance') || modelId.includes('doubao-seedance')) return 'seedance';
  if (modelId.includes('nano-banana')) return 'nano-banana';
  if (modelId.includes('speech') || modelId.includes('minimax')) return 'minimax';
  if (modelId.includes('chirp') || modelId.includes('suno')) return 'suno';
  return undefined;
};

/**
 * 获取厂商信息
 */
export const getProviderInfo = (providerId: ProviderId) => {
  return PROVIDERS[providerId];
};

// ==================== 统一生成接口 ====================

export interface GenerateImageOptions {
  prompt: string;
  model: string;
  aspectRatio?: string;
  images?: string[];
  count?: number;
  size?: string;
}

export interface GenerateVideoOptions {
  prompt: string;
  model: string;
  aspectRatio?: string;
  duration?: number;
  images?: string[];
  imageRoles?: ('first_frame' | 'last_frame')[];
  enhancePrompt?: boolean;
  // 厂商扩展配置
  videoConfig?: {
    // Vidu
    movement_amplitude?: 'auto' | 'small' | 'medium' | 'large';
    bgm?: boolean;
    audio?: boolean;
    style?: 'general' | 'anime';
    voice_id?: string;
    // Seedance
    return_last_frame?: boolean;
    generate_audio?: boolean;
    camera_fixed?: boolean;
    watermark?: boolean;
    service_tier?: 'default' | 'flex';
    seed?: number;
    // Veo
    enhance_prompt?: boolean;
  };
}

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

export interface GenerateTTSOptions {
  text: string;
  model?: string;
  voice_id?: string;
  speed?: number;
  format?: 'mp3' | 'wav' | 'pcm' | 'flac';
  async?: boolean;
}

export interface GenerateMusicOptions {
  prompt: string;
  model?: string;
  mode?: 'inspiration' | 'custom';
  title?: string;
  tags?: string;
  make_instrumental?: boolean;
}

/**
 * 统一图像生成接口
 */
export const generateImage = async (options: GenerateImageOptions): Promise<string[]> => {
  const providerId = getProviderId(options.model);

  switch (providerId) {
    case 'nano-banana': {
      const result = await nanoBananaService.generateImage({
        prompt: options.prompt,
        model: options.model as any,
        aspectRatio: options.aspectRatio as any,
        images: options.images,
        imageSize: options.size as any,
      });
      return result.urls;
    }

    case 'seedream': {
      const result = await seedreamService.generateImage({
        prompt: options.prompt,
        model: options.model,
        images: options.images,
        n: options.count,
        size: options.size,
      });
      return result.urls;
    }

    default:
      throw new Error(`不支持的图像模型: ${options.model}`);
  }
};

/**
 * 统一视频生成接口
 */
export const generateVideo = async (
  options: GenerateVideoOptions,
  onProgress?: (progress: string) => void
): Promise<string> => {
  const providerId = getProviderId(options.model);
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
        // Seedance 扩展配置
        return_last_frame: config.return_last_frame,
        generate_audio: config.generate_audio,
        camera_fixed: config.camera_fixed,
        watermark: config.watermark,
        service_tier: config.service_tier,
        seed: config.seed,
      }, onProgress);
      return result.url;
    }

    default:
      throw new Error(`不支持的视频模型: ${options.model}`);
  }
};

/**
 * Vidu 视频生成接口 (支持多种模式)
 */
export const generateViduVideo = async (
  options: GenerateViduVideoOptions,
  onProgress?: (state: string) => void
): Promise<viduService.VideoGenerationResult> => {
  return await viduService.generateVideo(options, onProgress);
};

/**
 * 统一语音合成接口
 */
export const generateTTS = async (
  options: GenerateTTSOptions,
  onProgress?: (status: string) => void
): Promise<{ audio_url?: string }> => {
  const providerId = getProviderId(options.model || 'speech-2.6-hd');

  switch (providerId) {
    case 'minimax': {
      if (options.async) {
        return await minimaxService.synthesizeAsync({
          text: options.text,
          model: options.model,
          voice_setting: { voice_id: options.voice_id, speed: options.speed },
          audio_setting: { format: options.format },
        }, onProgress);
      }
      return await minimaxService.synthesize({
        text: options.text,
        model: options.model,
        voice_setting: { voice_id: options.voice_id, speed: options.speed },
        audio_setting: { format: options.format },
      });
    }

    default:
      throw new Error(`不支持的语音模型: ${options.model}`);
  }
};

/**
 * 统一音乐生成接口
 */
export const generateMusic = async (
  options: GenerateMusicOptions,
  onProgress?: (status: string, progress?: string) => void
): Promise<sunoService.SongInfo[]> => {
  const providerId = getProviderId(options.model || 'chirp-v4');

  switch (providerId) {
    case 'suno': {
      if (options.mode === 'custom') {
        return await sunoService.generateAndWait({
          prompt: options.prompt,
          title: options.title,
          tags: options.tags,
          mv: options.model,
          make_instrumental: options.make_instrumental,
        }, 'custom', onProgress);
      }
      return await sunoService.generateAndWait({
        prompt: options.prompt,
        mv: options.model,
        make_instrumental: options.make_instrumental,
      }, 'inspiration', onProgress);
    }

    default:
      throw new Error(`不支持的音乐模型: ${options.model}`);
  }
};
