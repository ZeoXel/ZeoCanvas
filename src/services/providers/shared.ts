/**
 * 厂商服务共享工具
 */

// API 配置获取
export const getApiConfig = () => {
  const baseUrl = process.env.NEXT_PUBLIC_OPENAI_BASE_URL ||
                  process.env.OPENAI_BASE_URL ||
                  'https://api.bltcy.ai';
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
                 process.env.OPENAI_API_KEY ||
                 (typeof window !== 'undefined' ? localStorage.getItem('openai_api_key') : null);

  return { baseUrl, apiKey };
};

// 通用错误处理
export const handleApiError = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error?.message) return error.error.message;
  return JSON.stringify(error);
};

// 等待函数
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 通用轮询等待
export interface PollOptions<T> {
  queryFn: () => Promise<T>;
  isComplete: (result: T) => boolean;
  isFailed: (result: T) => boolean;
  getError: (result: T) => string;
  onProgress?: (result: T) => void;
  interval?: number;      // 轮询间隔 ms
  maxAttempts?: number;   // 最大尝试次数
}

export const pollUntilComplete = async <T>(options: PollOptions<T>): Promise<T> => {
  const {
    queryFn,
    isComplete,
    isFailed,
    getError,
    onProgress,
    interval = 5000,
    maxAttempts = 120
  } = options;

  let attempts = 0;

  while (attempts < maxAttempts) {
    await wait(interval);
    attempts++;

    const result = await queryFn();
    onProgress?.(result);

    if (isComplete(result)) {
      return result;
    }

    if (isFailed(result)) {
      throw new Error(getError(result));
    }
  }

  throw new Error('操作超时');
};

// 检查 API 配置
export const checkApiConfig = (): { isValid: boolean; message: string } => {
  const { apiKey } = getApiConfig();

  if (!apiKey) {
    return { isValid: false, message: 'API Key未配置' };
  }

  return { isValid: true, message: 'API配置有效' };
};

// 通用图片生成结果类型
export interface ImageGenerationResult {
  urls: string[];
  created?: number;
}

// 通用视频生成结果类型
export interface VideoGenerationResult {
  url: string;
  taskId?: string;
}
