/**
 * Veo (Google) 视频生成服务
 *
 * 支持模型:
 * - veo3.1: 支持视频自动配套音频生成
 * - veo3.1-pro: 超高质量版本
 * - veo3.1-components: 多图参考模式 (1-3张图)
 */

import { getApiConfig, handleApiError, wait, type VideoGenerationResult } from './shared';

// ==================== 类型定义 ====================

export interface VeoGenerateOptions {
  prompt: string;
  model?: 'veo3.1' | 'veo3.1-pro' | 'veo3.1-components';
  aspectRatio?: '16:9' | '9:16' | '1:1';
  duration?: number;       // 5-8 秒
  enhancePrompt?: boolean;
  enableUpsample?: boolean;
  images?: string[];       // 首尾帧或多图参考
}

export interface VeoTaskResult {
  task_id: string;
  status: 'NOT_START' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';
  progress?: string;
  fail_reason?: string;
  data?: {
    output?: string;  // Video URL
  };
}

// ==================== API 函数 ====================

/**
 * 创建 Veo 视频生成任务
 */
export const createTask = async (options: VeoGenerateOptions): Promise<string> => {
  const { baseUrl, apiKey } = getApiConfig();

  if (!apiKey) {
    throw new Error('API Key未配置，请在设置中配置');
  }

  const body: any = {
    prompt: options.prompt,
    model: options.model || 'veo3.1',
  };

  if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
  if (options.duration) body.duration = options.duration;
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
 * 查询 Veo 任务状态
 */
export const queryTask = async (taskId: string): Promise<VeoTaskResult> => {
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
 * 生成 Veo 视频 (包含轮询等待)
 */
export const generateVideo = async (
  options: VeoGenerateOptions,
  onProgress?: (progress: string) => void
): Promise<VideoGenerationResult> => {
  const taskId = await createTask(options);

  // 轮询等待结果
  const maxAttempts = 120;  // 最多等待10分钟 (120 * 5秒)
  let attempts = 0;

  while (attempts < maxAttempts) {
    await wait(5000);
    attempts++;

    const result = await queryTask(taskId);

    if (result.progress) {
      onProgress?.(result.progress);
    }

    if (result.status === 'SUCCESS') {
      if (result.data?.output) {
        return { url: result.data.output, taskId };
      }
      throw new Error('视频生成成功但未返回URL');
    }

    if (result.status === 'FAILURE') {
      throw new Error(`视频生成失败: ${result.fail_reason || '未知错误'}`);
    }
  }

  throw new Error('视频生成超时');
};

// ==================== 厂商信息 ====================

export const PROVIDER_INFO = {
  id: 'veo',
  name: 'Veo',
  category: 'video' as const,
  models: [
    { id: 'veo3.1', name: 'Veo 3.1', isDefault: true },
    { id: 'veo3.1-pro', name: 'Veo 3.1 Pro' },
    { id: 'veo3.1-components', name: 'Veo 多图参考' },
  ],
  capabilities: {
    aspectRatios: ['16:9', '9:16', '1:1'],
    durations: [5, 6, 7, 8],
    firstLastFrame: true,
    multiOutput: true,
    maxOutputCount: 4,
  },
};
