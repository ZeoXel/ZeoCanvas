/**
 * Seedance (火山引擎) 视频生成服务
 *
 * 支持模型:
 * - doubao-seedance-1-5-pro-251215: Seedance 1.5 Pro
 */

import { handleApiError, wait, type VideoGenerationResult } from './shared';

// ==================== 配置 ====================

const getVolcengineConfig = () => {
  const baseUrl = 'https://ark.cn-beijing.volces.com/api/v3';
  const apiKey = process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY;
  return { baseUrl, apiKey };
};

// ==================== 类型定义 ====================

export interface SeedanceGenerateOptions {
  prompt: string;
  model?: string;
  duration?: number;      // 4-12 秒, -1 表示自动
  images?: string[];      // 参考图
  imageRoles?: ('first_frame' | 'last_frame')[];  // 首尾帧角色
  // 扩展配置
  return_last_frame?: boolean;  // 返回尾帧
  generate_audio?: boolean;     // 有声视频 (1.5 pro)
  camera_fixed?: boolean;       // 固定摄像头
  watermark?: boolean;          // 水印
  service_tier?: 'default' | 'flex';  // 服务等级
  seed?: number;                // 随机种子
}

export interface SeedanceTaskResult {
  id: string;
  status: 'running' | 'succeeded' | 'failed';
  error?: { message: string };
  content?: {
    video_url?: string;
    last_frame?: string;  // 尾帧图片 (return_last_frame=true 时返回)
  };
}

// ==================== API 函数 ====================

/**
 * 创建 Seedance 视频生成任务
 */
export const createTask = async (options: SeedanceGenerateOptions): Promise<string> => {
  const { baseUrl, apiKey } = getVolcengineConfig();

  if (!apiKey) {
    throw new Error('火山引擎 API Key 未配置');
  }

  // 将 duration 追加到提示词 (--dur X)
  let finalPrompt = options.prompt;
  if (options.duration && options.duration > 0) {
    finalPrompt = `${options.prompt} --dur ${options.duration}`;
  }

  // 构建请求内容
  const content: any[] = [{ type: 'text', text: finalPrompt }];

  // 添加图片内容 (支持首尾帧 role)
  if (options.images && options.images.length > 0) {
    options.images.forEach((img, index) => {
      const imageContent: any = {
        type: 'image_url',
        image_url: { url: img }
      };
      // 添加 role 字段（用于首尾帧）
      if (options.imageRoles && options.imageRoles[index]) {
        imageContent.role = options.imageRoles[index];
      }
      content.push(imageContent);
    });
  }

  const body: any = {
    model: options.model || 'doubao-seedance-1-5-pro-251215',
    content,
  };

  // 添加扩展配置参数
  if (options.return_last_frame !== undefined) {
    body.return_last_frame = options.return_last_frame;
  }
  if (options.generate_audio !== undefined) {
    body.generate_audio = options.generate_audio;
  }
  if (options.camera_fixed !== undefined) {
    body.camera_fixed = options.camera_fixed;
  }
  if (options.watermark !== undefined) {
    body.watermark = options.watermark;
  }
  if (options.service_tier) {
    body.service_tier = options.service_tier;
  }
  if (options.seed !== undefined) {
    body.seed = options.seed;
  }

  const response = await fetch(`${baseUrl}/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Seedance API错误: ${response.status} - ${handleApiError(errorData)}`);
  }

  const result = await response.json();
  if (!result.id) {
    throw new Error('Seedance 未返回任务ID');
  }

  return result.id;
};

/**
 * 查询 Seedance 任务状态
 */
export const queryTask = async (taskId: string): Promise<SeedanceTaskResult> => {
  const { baseUrl, apiKey } = getVolcengineConfig();

  if (!apiKey) {
    throw new Error('火山引擎 API Key 未配置');
  }

  const response = await fetch(`${baseUrl}/contents/generations/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Seedance查询错误: ${response.status} - ${handleApiError(errorData)}`);
  }

  return response.json();
};

/**
 * 生成 Seedance 视频 (包含轮询等待)
 */
export const generateVideo = async (
  options: SeedanceGenerateOptions,
  onProgress?: (status: string) => void
): Promise<VideoGenerationResult> => {
  const taskId = await createTask(options);

  // 轮询等待结果
  const maxAttempts = 120;  // 最多等待10分钟
  let attempts = 0;

  while (attempts < maxAttempts) {
    await wait(5000);
    attempts++;

    const result = await queryTask(taskId);
    onProgress?.(result.status);

    if (result.status === 'succeeded') {
      if (result.content?.video_url) {
        return { url: result.content.video_url, taskId };
      }
      throw new Error('视频生成成功但未返回URL');
    }

    if (result.status === 'failed') {
      throw new Error(`视频生成失败: ${result.error?.message || '未知错误'}`);
    }
  }

  throw new Error('视频生成超时');
};

// ==================== 厂商信息 ====================

export const PROVIDER_INFO = {
  id: 'seedance',
  name: 'Seedance',
  category: 'video' as const,
  models: [
    { id: 'doubao-seedance-1-5-pro-251215', name: 'Seedance 1.5', isDefault: true },
  ],
  capabilities: {
    aspectRatios: ['16:9', '9:16', '1:1'],
    durations: [-1, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    firstLastFrame: true,
    multiOutput: true,
    maxOutputCount: 4,
  },
};
