/**
 * Vidu 视频生成服务 (Q2 系列)
 *
 * 支持功能:
 * - 文生视频 (text2video)
 * - 图生视频 (img2video)
 * - 首尾帧 (start-end2video)
 * - 智能多帧 (multiframe)
 * - 参考生视频 (reference2video)
 *
 * 模型 (Q2 系列):
 * - viduq2-pro: 效果好，细节丰富
 * - viduq2-turbo: 效果好，生成快
 * - viduq2-pro-fast: 价格低，速度快
 * - viduq2: 文生视频/参考生视频专用
 *
 * 分辨率: 540p / 720p / 1080p
 * 时长: 1-10秒 (首尾帧 1-8秒)
 */

import { wait } from './shared';

// ==================== 配置 ====================

const getViduConfig = () => {
  const baseUrl = process.env.VIDU_API_BASE || 'https://api.vidu.cn';
  const apiKey = process.env.VIDU_API_KEY || process.env.OPENAI_API_KEY;
  return { baseUrl, apiKey };
};

// ==================== 类型定义 ====================

export type ViduModel =
  | 'viduq2-pro' | 'viduq2-turbo' | 'viduq2-pro-fast' | 'viduq2';

export type AspectRatio = '16:9' | '9:16' | '4:3' | '3:4' | '1:1';
export type Resolution = '540p' | '720p' | '1080p';
export type MovementAmplitude = 'auto' | 'small' | 'medium' | 'large';
export type Style = 'general' | 'anime';

// 通用选项
interface BaseOptions {
  model: ViduModel;
  prompt?: string;
  duration?: number;
  resolution?: Resolution;
  movement_amplitude?: MovementAmplitude;
  watermark?: boolean;
  bgm?: boolean;
  callback_url?: string;
}

// 文生视频
export interface Text2VideoOptions extends BaseOptions {
  style?: Style;
  aspect_ratio?: AspectRatio;
}

// 图生视频
export interface Img2VideoOptions extends BaseOptions {
  images: string[];          // 首帧图片 (1张)
  audio?: boolean;           // 音视频直出
  voice_id?: string;         // 音色
  is_rec?: boolean;          // 使用推荐提示词
}

// 首尾帧
export interface StartEnd2VideoOptions extends BaseOptions {
  images: string[];          // 首帧 + 尾帧 (2张)
  is_rec?: boolean;
}

// 智能多帧
export interface MultiframeOptions extends BaseOptions {
  start_image: string;       // 首帧
  image_settings: {
    key_image: string;       // 关键帧图片
    prompt?: string;         // 关键帧提示词
    duration?: number;       // 该段时长
  }[];
}

// 参考生视频 - 主体定义
export interface Subject {
  id: string;                // 主体ID，用于在 prompt 中引用 @id
  images: string[];          // 主体图片 (1-3张)
  voice_id?: string;         // 该主体的音色
}

// 参考生视频 - 音视频直出
export interface Reference2VideoAudioOptions extends BaseOptions {
  subjects: Subject[];       // 主体列表 (1-7个)
  audio: true;               // 音视频直出
  aspect_ratio?: AspectRatio;
}

// 参考生视频 - 视频直出
export interface Reference2VideoOptions extends BaseOptions {
  images: string[];          // 参考图片 (1-7张)
  audio?: false;
  aspect_ratio?: AspectRatio;
}

// 任务状态
export type TaskState = 'created' | 'queueing' | 'processing' | 'success' | 'failed';

// 任务结果
export interface TaskResult {
  task_id: string;
  state: TaskState;
  credits?: number;
  err_code?: string;
  creations?: {
    id: string;
    url: string;
    cover_url?: string;
    watermarked_url?: string;
  }[];
}

// 生成结果
export interface VideoGenerationResult {
  taskId: string;
  videoUrl: string;
  coverUrl?: string;
}

// ==================== API 函数 ====================

/**
 * 查询任务状态
 */
export const queryTask = async (taskId: string): Promise<TaskResult> => {
  const { baseUrl, apiKey } = getViduConfig();

  if (!apiKey) {
    throw new Error('Vidu API Key 未配置');
  }

  const response = await fetch(`${baseUrl}/ent/v2/tasks/${taskId}/creations`, {
    headers: {
      'Authorization': `Token ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vidu 查询错误: ${response.status} - ${errorText}`);
  }

  return response.json();
};

/**
 * 文生视频
 */
export const text2video = async (options: Text2VideoOptions): Promise<string> => {
  const { baseUrl, apiKey } = getViduConfig();

  if (!apiKey) {
    throw new Error('Vidu API Key 未配置');
  }

  const body: any = {
    model: options.model,
    prompt: options.prompt,
  };

  if (options.style) body.style = options.style;
  if (options.duration) body.duration = options.duration;
  if (options.aspect_ratio) body.aspect_ratio = options.aspect_ratio;
  if (options.resolution) body.resolution = options.resolution;
  if (options.movement_amplitude) body.movement_amplitude = options.movement_amplitude;
  if (options.bgm !== undefined) body.bgm = options.bgm;
  if (options.watermark !== undefined) body.watermark = options.watermark;
  if (options.callback_url) body.callback_url = options.callback_url;

  const response = await fetch(`${baseUrl}/ent/v2/text2video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vidu text2video 错误: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.task_id;
};

/**
 * 图生视频
 */
export const img2video = async (options: Img2VideoOptions): Promise<string> => {
  const { baseUrl, apiKey } = getViduConfig();

  if (!apiKey) {
    throw new Error('Vidu API Key 未配置');
  }

  const body: any = {
    model: options.model,
    images: options.images,
  };

  if (options.prompt) body.prompt = options.prompt;
  if (options.duration) body.duration = options.duration;
  if (options.resolution) body.resolution = options.resolution;
  if (options.movement_amplitude) body.movement_amplitude = options.movement_amplitude;
  if (options.audio !== undefined) body.audio = options.audio;
  if (options.voice_id) body.voice_id = options.voice_id;
  if (options.is_rec !== undefined) body.is_rec = options.is_rec;
  if (options.watermark !== undefined) body.watermark = options.watermark;
  if (options.callback_url) body.callback_url = options.callback_url;

  const response = await fetch(`${baseUrl}/ent/v2/img2video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vidu img2video 错误: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.task_id;
};

/**
 * 首尾帧生成视频
 */
export const startEnd2video = async (options: StartEnd2VideoOptions): Promise<string> => {
  const { baseUrl, apiKey } = getViduConfig();

  if (!apiKey) {
    throw new Error('Vidu API Key 未配置');
  }

  if (!options.images || options.images.length !== 2) {
    throw new Error('首尾帧需要提供2张图片');
  }

  const body: any = {
    model: options.model,
    images: options.images,
  };

  if (options.prompt) body.prompt = options.prompt;
  if (options.duration) body.duration = options.duration;
  if (options.resolution) body.resolution = options.resolution;
  if (options.movement_amplitude) body.movement_amplitude = options.movement_amplitude;
  if (options.is_rec !== undefined) body.is_rec = options.is_rec;
  if (options.bgm !== undefined) body.bgm = options.bgm;
  if (options.watermark !== undefined) body.watermark = options.watermark;
  if (options.callback_url) body.callback_url = options.callback_url;

  const response = await fetch(`${baseUrl}/ent/v2/start-end2video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vidu start-end2video 错误: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.task_id;
};

/**
 * 智能多帧生成视频
 */
export const multiframe = async (options: MultiframeOptions): Promise<string> => {
  const { baseUrl, apiKey } = getViduConfig();

  if (!apiKey) {
    throw new Error('Vidu API Key 未配置');
  }

  if (!options.image_settings || options.image_settings.length < 1) {
    throw new Error('智能多帧至少需要1个关键帧');
  }

  if (options.image_settings.length > 9) {
    throw new Error('智能多帧最多支持9个关键帧');
  }

  const body: any = {
    model: options.model,
    start_image: options.start_image,
    image_settings: options.image_settings,
  };

  if (options.resolution) body.resolution = options.resolution;
  if (options.watermark !== undefined) body.watermark = options.watermark;
  if (options.callback_url) body.callback_url = options.callback_url;

  const response = await fetch(`${baseUrl}/ent/v2/multiframe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vidu multiframe 错误: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.task_id;
};

/**
 * 参考生视频 - 音视频直出 (带主体和台词)
 */
export const reference2videoAudio = async (options: Reference2VideoAudioOptions): Promise<string> => {
  const { baseUrl, apiKey } = getViduConfig();

  if (!apiKey) {
    throw new Error('Vidu API Key 未配置');
  }

  if (!options.subjects || options.subjects.length < 1) {
    throw new Error('参考生视频至少需要1个主体');
  }

  if (options.subjects.length > 7) {
    throw new Error('参考生视频最多支持7个主体');
  }

  const body: any = {
    model: options.model,
    subjects: options.subjects,
    prompt: options.prompt,
    audio: true,
  };

  if (options.duration) body.duration = options.duration;
  if (options.aspect_ratio) body.aspect_ratio = options.aspect_ratio;
  if (options.resolution) body.resolution = options.resolution;
  if (options.movement_amplitude) body.movement_amplitude = options.movement_amplitude;
  if (options.watermark !== undefined) body.watermark = options.watermark;
  if (options.callback_url) body.callback_url = options.callback_url;

  const response = await fetch(`${baseUrl}/ent/v2/reference2video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vidu reference2video 错误: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.task_id;
};

/**
 * 参考生视频 - 视频直出 (主体一致性，可选BGM)
 */
export const reference2video = async (options: Reference2VideoOptions): Promise<string> => {
  const { baseUrl, apiKey } = getViduConfig();

  if (!apiKey) {
    throw new Error('Vidu API Key 未配置');
  }

  if (!options.images || options.images.length < 1) {
    throw new Error('参考生视频至少需要1张参考图');
  }

  if (options.images.length > 7) {
    throw new Error('参考生视频最多支持7张参考图');
  }

  const body: any = {
    model: options.model,
    images: options.images,
    prompt: options.prompt,
  };

  if (options.duration) body.duration = options.duration;
  if (options.aspect_ratio) body.aspect_ratio = options.aspect_ratio;
  if (options.resolution) body.resolution = options.resolution;
  if (options.movement_amplitude) body.movement_amplitude = options.movement_amplitude;
  if (options.bgm !== undefined) body.bgm = options.bgm;
  if (options.watermark !== undefined) body.watermark = options.watermark;
  if (options.callback_url) body.callback_url = options.callback_url;

  const response = await fetch(`${baseUrl}/ent/v2/reference2video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vidu reference2video 错误: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.task_id;
};

// ==================== 统一生成接口 ====================

export type GenerationMode = 'text2video' | 'img2video' | 'start-end' | 'multiframe' | 'reference' | 'reference-audio';

export interface GenerateVideoOptions {
  mode: GenerationMode;
  model: ViduModel;
  prompt?: string;
  images?: string[];
  duration?: number;
  resolution?: Resolution;
  aspect_ratio?: AspectRatio;
  movement_amplitude?: MovementAmplitude;
  style?: Style;
  bgm?: boolean;
  audio?: boolean;
  voice_id?: string;
  watermark?: boolean;
  // 多帧专用
  start_image?: string;
  image_settings?: MultiframeOptions['image_settings'];
  // 参考生视频专用
  subjects?: Subject[];
}

/**
 * 统一视频生成接口
 */
export const generateVideo = async (
  options: GenerateVideoOptions,
  onProgress?: (state: string) => void
): Promise<VideoGenerationResult> => {
  let taskId: string;

  // 根据模式创建任务
  switch (options.mode) {
    case 'text2video':
      taskId = await text2video({
        model: options.model,
        prompt: options.prompt,
        duration: options.duration,
        aspect_ratio: options.aspect_ratio,
        resolution: options.resolution,
        movement_amplitude: options.movement_amplitude,
        style: options.style,
        bgm: options.bgm,
        watermark: options.watermark,
      });
      break;

    case 'img2video':
      if (!options.images || options.images.length === 0) {
        throw new Error('图生视频需要提供图片');
      }
      taskId = await img2video({
        model: options.model,
        images: options.images,
        prompt: options.prompt,
        duration: options.duration,
        resolution: options.resolution,
        movement_amplitude: options.movement_amplitude,
        audio: options.audio,
        voice_id: options.voice_id,
        watermark: options.watermark,
      });
      break;

    case 'start-end':
      if (!options.images || options.images.length !== 2) {
        throw new Error('首尾帧需要提供2张图片');
      }
      taskId = await startEnd2video({
        model: options.model,
        images: options.images,
        prompt: options.prompt,
        duration: options.duration,
        resolution: options.resolution,
        movement_amplitude: options.movement_amplitude,
        bgm: options.bgm,
        watermark: options.watermark,
      });
      break;

    case 'multiframe':
      if (!options.start_image || !options.image_settings) {
        throw new Error('多帧需要提供首帧和关键帧设置');
      }
      taskId = await multiframe({
        model: options.model,
        start_image: options.start_image,
        image_settings: options.image_settings,
        resolution: options.resolution,
        watermark: options.watermark,
      });
      break;

    case 'reference':
      if (!options.images || options.images.length === 0) {
        throw new Error('参考生视频需要提供参考图');
      }
      taskId = await reference2video({
        model: options.model,
        images: options.images,
        prompt: options.prompt,
        duration: options.duration,
        aspect_ratio: options.aspect_ratio,
        resolution: options.resolution,
        movement_amplitude: options.movement_amplitude,
        bgm: options.bgm,
        watermark: options.watermark,
      });
      break;

    case 'reference-audio':
      if (!options.subjects || options.subjects.length === 0) {
        throw new Error('音视频直出需要提供主体');
      }
      taskId = await reference2videoAudio({
        model: options.model,
        subjects: options.subjects,
        prompt: options.prompt,
        audio: true,
        duration: options.duration,
        aspect_ratio: options.aspect_ratio,
        resolution: options.resolution,
        movement_amplitude: options.movement_amplitude,
        watermark: options.watermark,
      });
      break;

    default:
      throw new Error(`不支持的生成模式: ${options.mode}`);
  }

  // 轮询等待结果 (最多15分钟)
  const maxAttempts = 180;
  let attempts = 0;

  while (attempts < maxAttempts) {
    await wait(5000);
    attempts++;

    try {
      const result = await queryTask(taskId);
      onProgress?.(result.state);

      if (result.state === 'success') {
        const creation = result.creations?.[0];
        if (creation?.url) {
          return {
            taskId,
            videoUrl: creation.url,
            coverUrl: creation.cover_url,
          };
        }
        throw new Error('视频生成成功但未返回URL');
      }

      if (result.state === 'failed') {
        throw new Error(`视频生成失败: ${result.err_code || '未知错误'}`);
      }
    } catch (error: any) {
      if (error.message.includes('视频生成失败')) {
        throw error;
      }
      // 查询错误，继续重试
      console.error('[Vidu] Query error:', error.message);
    }
  }

  throw new Error('视频生成超时');
};

// ==================== 厂商信息 ====================

export const PROVIDER_INFO = {
  id: 'vidu',
  name: 'Vidu',
  category: 'video' as const,
  models: [
    { id: 'viduq2-pro', name: 'Q2 Pro', isDefault: true, desc: '效果好，细节丰富' },
    { id: 'viduq2-turbo', name: 'Q2 Turbo', desc: '效果好，生成快' },
    { id: 'viduq2-pro-fast', name: 'Q2 Pro Fast', desc: '价格低，速度快' },
    { id: 'viduq2', name: 'Q2', desc: '文生视频/参考生视频' },
  ],
  capabilities: {
    modes: ['text2video', 'img2video', 'start-end', 'multiframe', 'reference', 'reference-audio'],
    aspectRatios: ['16:9', '9:16', '4:3', '3:4', '1:1'],
    durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],  // 首尾帧最多8秒
    resolutions: ['540p', '720p', '1080p'],
    audio: true,           // 音视频直出
    bgm: true,             // 背景音乐
    multiSubject: true,    // 多主体支持
    maxSubjects: 7,
    maxKeyframes: 9,
  },
};
