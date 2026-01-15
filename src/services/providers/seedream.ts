/**
 * Seedream (即梦) 图像生成服务
 *
 * 支持模型:
 * - doubao-seedream-4-5-251128: 即梦4.5，支持多图参考和组图生成
 */

import { getApiConfig, handleApiError, type ImageGenerationResult } from './shared';

// ==================== 类型定义 ====================

export interface SeedreamGenerateOptions {
  prompt: string;
  model?: string;
  images?: string[];  // 参考图数组
  n?: number;         // 生成数量 1-15
  size?: string;      // 如 '2048x2048', '2560x1440'
  responseFormat?: 'url' | 'b64_json';
  sequentialImageGeneration?: 'auto' | 'disabled';
}

interface SeedreamApiResult {
  data: { url: string }[];
  created: number;
  usage: {
    total_tokens: number;
  };
}

// Seedream 比例到尺寸映射
export const SIZE_MAP: Record<string, string> = {
  '1:1': '2048x2048',
  '4:3': '2304x1728',
  '3:4': '1728x2304',
  '16:9': '2560x1440',
  '9:16': '1440x2560',
};

// ==================== API 函数 ====================

/**
 * 使用 Seedream 生成图像
 */
export const generateImage = async (options: SeedreamGenerateOptions): Promise<ImageGenerationResult> => {
  const { baseUrl, apiKey } = getApiConfig();

  if (!apiKey) {
    throw new Error('API Key未配置');
  }

  const body: any = {
    model: options.model || 'doubao-seedream-4-5-251128',
    prompt: options.prompt,
    watermark: false,  // Seedream 4.5: 始终不添加水印
  };

  if (options.images && options.images.length > 0) body.image = options.images;
  if (options.size) body.size = options.size;
  if (options.responseFormat) body.response_format = options.responseFormat;

  // Seedream 4.5 组图功能：通过提示词控制数量
  if (options.n && options.n > 1) {
    body.sequential_image_generation = 'auto';
    body.sequential_image_generation_options = {
      max_images: Math.min(options.n, 15)
    };
    body.prompt = `${options.prompt} ${options.n}张`;
  } else {
    body.sequential_image_generation = 'disabled';
  }

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

  const result: SeedreamApiResult = await response.json();
  return {
    urls: result.data.map(d => d.url),
    created: result.created,
  };
};

/**
 * 使用 Seedream 编辑图像
 */
export const editImage = async (
  imageFile: File | Blob,
  prompt: string,
  options?: {
    model?: string;
    mask?: File | Blob;
    n?: number;
    size?: string;
  }
): Promise<ImageGenerationResult> => {
  const { baseUrl, apiKey } = getApiConfig();

  if (!apiKey) {
    throw new Error('API Key未配置');
  }

  const formData = new FormData();
  formData.append('model', options?.model || 'doubao-seedream-4-5-251128');
  formData.append('image', imageFile);
  formData.append('prompt', prompt);
  formData.append('response_format', 'url');
  formData.append('watermark', 'false');

  if (options?.mask) formData.append('mask', options.mask);
  if (options?.n) formData.append('n', String(options.n));
  if (options?.size) formData.append('size', options.size);

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

  const result: SeedreamApiResult = await response.json();
  return {
    urls: result.data.map(d => d.url),
    created: result.created,
  };
};

// ==================== 厂商信息 ====================

export const PROVIDER_INFO = {
  id: 'seedream',
  name: 'Seedream',
  category: 'image' as const,
  models: [
    { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5', isDefault: true },
  ],
  capabilities: {
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    multiImage: true,
    multiOutput: true,
    maxOutputCount: 4,
  },
};
