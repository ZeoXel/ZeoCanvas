/**
 * Seedream (即梦) 图像生成服务 - 火山引擎官方接口
 *
 * 支持模型:
 * - doubao-seedream-4-5-251128: 即梦4.5，支持多图参考和组图生成
 *
 * API 文档: https://ark.cn-beijing.volces.com/api/v3/images/generations
 */

import { handleApiError, type ImageGenerationResult } from './shared';

// ==================== 配置 ====================

const getVolcengineConfig = () => {
  const baseUrl = 'https://ark.cn-beijing.volces.com/api/v3';
  const apiKey = process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY;
  return { baseUrl, apiKey };
};

// ==================== 类型定义 ====================

export interface SeedreamGenerateOptions {
  prompt: string;
  model?: string;
  images?: string[];  // 参考图数组 (最多14张)
  n?: number;         // 组图数量 1-15
  size?: string;      // 如 '2048x2048', '2560x1440'
  aspectRatio?: string; // 用于映射到 size
  responseFormat?: 'url' | 'b64_json';
  watermark?: boolean;
  stream?: boolean;
}

interface SeedreamApiResult {
  data: { url: string }[];
  created: number;
  usage: {
    total_tokens: number;
  };
}

// 比例到尺寸映射
export const SIZE_MAP: Record<string, string> = {
  '1:1': '2048x2048',
  '4:3': '2304x1728',
  '3:4': '1728x2304',
  '16:9': '2560x1440',
  '9:16': '1440x2560',
  '3:2': '2496x1664',
  '2:3': '1664x2496',
  '21:9': '3024x1296',
};

// ==================== API 函数 ====================

/**
 * 使用 Seedream 生成图像 (火山引擎官方接口)
 */
export const generateImage = async (options: SeedreamGenerateOptions): Promise<ImageGenerationResult> => {
  const { baseUrl, apiKey } = getVolcengineConfig();

  if (!apiKey) {
    throw new Error('火山引擎 API Key 未配置 (VOLCENGINE_API_KEY)');
  }

  // 确定 size
  let size = options.size;
  if (!size && options.aspectRatio) {
    size = SIZE_MAP[options.aspectRatio] || '2048x2048';
  }

  const body: Record<string, any> = {
    model: options.model || 'doubao-seedream-4-5-251128',
    prompt: options.prompt,
    watermark: options.watermark ?? false,
  };

  if (options.images && options.images.length > 0) {
    body.image = options.images;
  }
  if (size) {
    body.size = size;
  }
  if (options.responseFormat) {
    body.response_format = options.responseFormat;
  }

  // 组图功能
  if (options.n && options.n > 1) {
    body.sequential_image_generation = 'auto';
    body.sequential_image_generation_options = {
      max_images: Math.min(options.n, 15)
    };
    body.prompt = `${options.prompt} ${options.n}张`;
  } else {
    body.sequential_image_generation = 'disabled';
  }

  console.log(`[Seedream] Generating with model: ${body.model}, size: ${size || 'default'}`);

  const response = await fetch(`${baseUrl}/images/generations`, {
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

// ==================== 厂商信息 ====================

export const PROVIDER_INFO = {
  id: 'seedream',
  name: 'Seedream',
  category: 'image' as const,
  models: [
    { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5', isDefault: true },
  ],
  capabilities: {
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
    multiImage: true,
    multiOutput: true,
    maxOutputCount: 15,
  },
};
