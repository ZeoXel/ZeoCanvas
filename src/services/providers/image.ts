/**
 * 统一图像生成服务 (OpenAI 兼容网关)
 *
 * 通过 model 参数区分厂商：
 * - nano-banana / nano-banana-pro: Nano Banana
 * - gemini-*: Gemini
 *
 * 注意: 所有模型统一走网关（由网关负责厂商路由）
 */

import { getApiConfig, handleApiError, isGatewayProxyBaseUrl, type ImageGenerationResult } from './shared';

// ==================== 类型定义 ====================

export interface ImageGenerateOptions {
  prompt: string;
  model: string;
  images?: string[];
  aspectRatio?: string;
  size?: string;
  count?: number;
  imageSize?: '1K' | '2K' | '4K';  // NanoBanana
  responseFormat?: 'url' | 'b64_json';
  apiKey?: string;
  baseUrl?: string;
}

// ==================== 内部工具 ====================

const getProviderFromModel = (model: string): 'nano-banana' | 'seedream' | 'gemini' => {
  if (model.includes('nano-banana')) return 'nano-banana';
  if (model.includes('seedream') || model.includes('doubao-seedream')) return 'seedream';
  return 'gemini';
};

// ==================== API 函数 ====================

/**
 * 统一图像生成
 */
export const generateImage = async (options: ImageGenerateOptions): Promise<ImageGenerationResult> => {
  const { baseUrl, apiKey } = getApiConfig();
  const resolvedBaseUrl = options.baseUrl || baseUrl;
  const resolvedApiKey = options.apiKey ?? apiKey;

  if (!resolvedApiKey && !isGatewayProxyBaseUrl(resolvedBaseUrl)) {
    throw new Error('API Key未配置');
  }

  const provider = getProviderFromModel(options.model);
  const count = options.count || 1;

  // nano-banana / seedream 通过批量请求实现组图生成
  if ((provider === 'nano-banana' || provider === 'seedream') && count > 1) {
    console.log(`[Image] Batch generating ${count} images with ${options.model}`);

    const requests = Array.from({ length: count }, () =>
      generateSingleImage(resolvedBaseUrl, resolvedApiKey || '', options, provider)
    );

    const results = await Promise.all(requests);
    const allUrls = results.flatMap(r => r.urls);

    return {
      urls: allUrls,
      created: results[0]?.created || Date.now(),
    };
  }

  // 单图生成或 Gemini 模型
  return generateSingleImage(resolvedBaseUrl, resolvedApiKey || '', options, provider);
};

/**
 * 生成单张图像（内部函数）
 */
const generateSingleImage = async (
  baseUrl: string,
  apiKey: string,
  options: ImageGenerateOptions,
  provider: 'nano-banana' | 'gemini'
): Promise<ImageGenerationResult> => {
  const body: Record<string, any> = {
    model: options.model,
    prompt: options.prompt,
    response_format: options.responseFormat || (provider === 'gemini' ? 'b64_json' : 'url'),
  };

  // 通用参数
  if (options.images && options.images.length > 0) {
    body.image = options.images;
  }
  if (options.aspectRatio) {
    body.aspect_ratio = options.aspectRatio;
  }
  if (options.size) {
    body.size = options.size;
  }

  // 厂商特定参数
  if (provider === 'nano-banana' && options.imageSize) {
    body.image_size = options.imageSize;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/v1/images/generations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`图像生成失败: ${response.status} - ${handleApiError(errorData)}`);
  }

  const result = await response.json();
  const urls = result.data
    .map((d: any) => d.url || (d.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
    .filter(Boolean) as string[];

  if (urls.length === 0) {
    throw new Error('未返回图像结果');
  }

  return { urls, created: result.created };
};

/**
 * 图像编辑（通过图生图实现）
 */
export const editImage = async (
  imageBase64: string,
  prompt: string,
  model?: string
): Promise<string> => {
  const result = await generateImage({
    prompt,
    model: model || 'gemini-2.5-flash-image',
    images: [imageBase64],
  });
  return result.urls[0];
};

// ==================== 模型配置 ====================

export const IMAGE_MODELS = [
  // Nano Banana
  { id: 'nano-banana', name: 'Nano Banana', provider: 'nano-banana' },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', provider: 'nano-banana' },
  // Gemini
  { id: 'gemini-2.5-flash-image', name: 'Gemini Flash Image', provider: 'gemini' },
  { id: 'gemini-2.5-flash-image-generation', name: 'Gemini Flash Image Gen', provider: 'gemini' },
];

export const DEFAULT_IMAGE_MODEL = 'nano-banana';
