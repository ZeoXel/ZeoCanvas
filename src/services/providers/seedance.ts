/**
 * Seedance (火山引擎) 视频生成服务
 *
 * 支持模型:
 * - doubao-seedance-1-5-pro-251215: Seedance 1.5 Pro
 */

import { handleApiError, wait, type VideoGenerationResult } from './shared';

// ==================== 配置 ====================

type GatewayConfig = { baseUrl?: string; apiKey?: string };

const getGatewayConfig = (gateway?: GatewayConfig) => {
  const baseUrl = gateway?.baseUrl || process.env.OPENAI_BASE_URL
    || process.env.GATEWAY_BASE_URL
    || 'https://api.lsaigc.com';
  const apiKey = gateway?.apiKey || process.env.OPENAI_API_KEY;
  return { baseUrl, apiKey };
};

// ==================== 类型定义 ====================

export interface SeedanceGenerateOptions {
  prompt: string;
  model?: string;
  duration?: number;      // 4-12 秒, -1 表示自动
  aspectRatio?: string;   // 画面比例: 16:9, 9:16, 1:1, 4:3, 3:4, 21:9
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

const normalizeTaskResult = (taskId: string, payload: any): SeedanceTaskResult => {
  const data = payload?.data ?? payload ?? {};
  const rawStatus = (data.status || data.state || data.task_status || '').toString();
  const errorMsg = data.fail_reason || data.error || data.message;

  let status: SeedanceTaskResult['status'] = 'running';
  if (['SUCCESS', 'SUCCEEDED', 'DONE'].includes(rawStatus.toUpperCase()))
    status = 'succeeded';
  else if (['FAILURE', 'FAILED', 'ERROR'].includes(rawStatus.toUpperCase()) || errorMsg)
    status = 'failed';

  const videoUrl = data.data?.creations?.[0]?.url
    || data.data?.output
    || data.output
    || (typeof data.fail_reason === 'string' && data.fail_reason.startsWith('http') ? data.fail_reason : undefined);

  return {
    id: data.task_id || taskId,
    status,
    error: errorMsg ? { message: errorMsg } : undefined,
    content: videoUrl ? { video_url: videoUrl, last_frame: data.last_frame } : undefined,
  };
};

// ==================== API 函数 ====================

/**
 * 创建 Seedance 视频生成任务
 */
export const createTask = async (
  options: SeedanceGenerateOptions,
  gateway?: GatewayConfig
): Promise<string> => {
  const { baseUrl, apiKey } = getGatewayConfig(gateway);

  if (!apiKey) {
    throw new Error('API Key 未配置');
  }

  // 验证并修正 duration（Seedance 1.5 Pro 支持 4-12 秒，或 -1 自动）
  let validDuration = options.duration;
  if (validDuration !== undefined && validDuration !== -1) {
    if (validDuration < 4) {
      console.warn(`[Seedance] Duration ${validDuration} is too short, using minimum 4s`);
      validDuration = 4;
    } else if (validDuration > 12) {
      console.warn(`[Seedance] Duration ${validDuration} is too long, using maximum 12s`);
      validDuration = 12;
    }
  }

  const body: any = {
    model: options.model || 'doubao-seedance-1-5-pro-251215',
    prompt: options.prompt,
  };

  if (validDuration && validDuration > 0) body.duration = validDuration;
  if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
  if (options.images && options.images.length > 0) body.images = options.images;
  if (options.imageRoles && options.imageRoles.length > 0) body.image_roles = options.imageRoles;

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

  const response = await fetch(`${baseUrl}/v1/video/generations`, {
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
  const taskId = result?.task_id || result?.data?.task_id;
  if (!taskId) {
    throw new Error('Seedance 未返回任务ID');
  }

  return taskId;
};

/**
 * 查询 Seedance 任务状态
 */
export const queryTask = async (taskId: string, gateway?: GatewayConfig): Promise<SeedanceTaskResult> => {
  const { baseUrl, apiKey } = getGatewayConfig(gateway);

  if (!apiKey) {
    throw new Error('API Key 未配置');
  }

  const response = await fetch(`${baseUrl}/v1/video/generations/${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Seedance查询错误: ${response.status} - ${handleApiError(errorData)}`);
  }

  const payload = await response.json();
  return normalizeTaskResult(taskId, payload);
};

/**
 * 生成 Seedance 视频 (包含轮询等待)
 */
export const generateVideo = async (
  options: SeedanceGenerateOptions,
  onProgress?: (status: string) => void,
  gateway?: GatewayConfig
): Promise<VideoGenerationResult> => {
  const taskId = await createTask(options, gateway);

  // 轮询等待结果
  const maxAttempts = 120;  // 最多等待10分钟
  let attempts = 0;

  while (attempts < maxAttempts) {
    await wait(5000);
    attempts++;

    const result = await queryTask(taskId, gateway);
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
