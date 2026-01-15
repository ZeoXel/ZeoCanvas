/**
 * Nano Banana 图像生成服务
 *
 * 支持模型:
 * - nano-banana: 基础版，支持比例设置
 * - nano-banana-pro: Pro版，更高质量
 */

import { getApiConfig, handleApiError, type ImageGenerationResult } from './shared';

// ==================== 类型定义 ====================

export interface NanoBananaGenerateOptions {
  prompt: string;
  model?: 'nano-banana' | 'nano-banana-pro';
  aspectRatio?: '4:3' | '3:4' | '16:9' | '9:16' | '2:3' | '3:2' | '1:1' | '4:5' | '5:4' | '21:9';
  responseFormat?: 'url' | 'b64_json';
  images?: string[];  // 参考图数组
  imageSize?: '1K' | '2K' | '4K';
}

interface NanoBananaApiResult {
  data: { url?: string; b64_json?: string }[];
  created: number;
}

// ==================== API 函数 ====================

/**
 * 使用 Nano Banana 生成图像
 */
export const generateImage = async (options: NanoBananaGenerateOptions): Promise<ImageGenerationResult> => {
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
  if (options.imageSize) body.image_size = options.imageSize;

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
    throw new Error(`Nano Banana API错误: ${response.status} - ${handleApiError(errorData)}`);
  }

  const result: NanoBananaApiResult = await response.json();
  const urls = result.data
    .map(d => d.url || (d.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
    .filter(Boolean) as string[];

  return { urls, created: result.created };
};

/**
 * 使用 Nano Banana 编辑图像
 */
export const editImage = async (
  imageFiles: File[] | Blob[],
  prompt: string,
  options?: {
    model?: 'nano-banana' | 'nano-banana-pro';
    aspectRatio?: string;
    imageSize?: '1K' | '2K' | '4K';
  }
): Promise<ImageGenerationResult> => {
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
    throw new Error(`Nano Banana Edit API错误: ${response.status} - ${handleApiError(errorData)}`);
  }

  const result: NanoBananaApiResult = await response.json();
  const urls = result.data
    .map(d => d.url || (d.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
    .filter(Boolean) as string[];

  return { urls, created: result.created };
};

// ==================== 厂商信息 ====================

export const PROVIDER_INFO = {
  id: 'nano-banana',
  name: 'Nano Banana',
  category: 'image' as const,
  models: [
    { id: 'nano-banana', name: 'Nano Banana', isDefault: true },
    { id: 'nano-banana-pro', name: 'Nano Banana Pro' },
  ],
  capabilities: {
    aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    multiImage: true,
    multiOutput: true,
    maxOutputCount: 4,
  },
};
