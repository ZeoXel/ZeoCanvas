/**
 * MiniMax 语音合成 (TTS) 服务
 *
 * 支持模型:
 * - speech-2.6-hd: 高清语音合成
 *
 * 功能:
 * - 同步模式: 直接返回音频
 * - 异步模式: 返回任务ID，轮询获取结果
 */

import { wait } from './shared';

// ==================== 配置 ====================

const getMinimaxConfig = () => {
  const baseUrl = process.env.MINIMAX_API_BASE || process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.bltcy.ai';
  const apiKey = process.env.MINIMAX_API_KEY || process.env.OPENAI_API_KEY;
  return { baseUrl, apiKey };
};

// ==================== 类型定义 ====================

export interface VoiceSetting {
  voice_id?: string;       // 音色ID
  speed?: number;          // 语速 0.5-2
  vol?: number;            // 音量 0-10
  pitch?: number;          // 音调 -12 到 12
  emotion?: string;        // 情绪
}

export interface AudioSetting {
  sample_rate?: number;    // 采样率
  bitrate?: number;        // 比特率
  format?: 'mp3' | 'wav' | 'pcm' | 'flac';
  channel?: number;        // 声道
}

export interface TTSOptions {
  text: string;
  model?: string;
  voice_setting?: VoiceSetting;
  audio_setting?: AudioSetting;
  stream?: boolean;
}

export interface TTSResult {
  audio_url?: string;
  audio_data?: string;      // base64
  duration?: number;
}

export interface AsyncTaskResult {
  task_id: string;
  status: 'processing' | 'success' | 'failed';
  file_id?: string;
  audio_url?: string;
  error?: string;
}

// ==================== API 函数 ====================

/**
 * 同步语音合成 - 直接返回音频
 */
export const synthesize = async (options: TTSOptions): Promise<TTSResult> => {
  const { baseUrl, apiKey } = getMinimaxConfig();

  if (!apiKey) {
    throw new Error('MiniMax API Key 未配置');
  }

  const body = {
    model: options.model || 'speech-2.6-hd',
    text: options.text,
    stream: options.stream ?? false,
    voice_setting: {
      voice_id: options.voice_setting?.voice_id || 'male-qn-qingse',
      speed: options.voice_setting?.speed ?? 1,
      vol: options.voice_setting?.vol ?? 1,
      pitch: options.voice_setting?.pitch ?? 0,
      ...(options.voice_setting?.emotion && { emotion: options.voice_setting.emotion }),
    },
    audio_setting: {
      sample_rate: options.audio_setting?.sample_rate ?? 32000,
      bitrate: options.audio_setting?.bitrate ?? 128000,
      format: options.audio_setting?.format || 'mp3',
      channel: options.audio_setting?.channel ?? 1,
    },
  };

  const response = await fetch(`${baseUrl}/minimax/v1/t2a_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`MiniMax API 错误: ${response.status} - ${errorData.base_resp?.status_msg || '未知错误'}`);
  }

  const result = await response.json();

  if (result.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax 错误: ${result.base_resp?.status_msg || '未知错误'}`);
  }

  return {
    audio_url: result.audio_file,
    audio_data: result.data?.audio,
    duration: result.data?.duration,
  };
};

/**
 * 异步语音合成 - 创建任务
 */
export const createAsyncTask = async (options: TTSOptions): Promise<string> => {
  const { baseUrl, apiKey } = getMinimaxConfig();

  if (!apiKey) {
    throw new Error('MiniMax API Key 未配置');
  }

  const body = {
    model: options.model || 'speech-2.6-hd',
    text: options.text,
    voice_setting: {
      voice_id: options.voice_setting?.voice_id || 'male-qn-qingse',
      speed: options.voice_setting?.speed ?? 1,
      vol: options.voice_setting?.vol ?? 1,
      pitch: options.voice_setting?.pitch ?? 0,
      ...(options.voice_setting?.emotion && { emotion: options.voice_setting.emotion }),
    },
    audio_setting: {
      audio_sample_rate: options.audio_setting?.sample_rate ?? 32000,
      bitrate: options.audio_setting?.bitrate ?? 128000,
      format: options.audio_setting?.format || 'mp3',
      channel: options.audio_setting?.channel ?? 1,
    },
  };

  const response = await fetch(`${baseUrl}/minimax/v1/t2a_async_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`MiniMax API 错误: ${response.status} - ${errorData.base_resp?.status_msg || '未知错误'}`);
  }

  const result = await response.json();

  if (result.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax 错误: ${result.base_resp?.status_msg || '未知错误'}`);
  }

  return result.task_id;
};

/**
 * 查询异步任务状态
 */
export const queryTask = async (taskId: string): Promise<AsyncTaskResult> => {
  const { baseUrl, apiKey } = getMinimaxConfig();

  if (!apiKey) {
    throw new Error('MiniMax API Key 未配置');
  }

  const response = await fetch(`${baseUrl}/minimax/v1/query/t2a_async_query_v2?task_id=${taskId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`查询失败: ${response.status}`);
  }

  const result = await response.json();

  return {
    task_id: taskId,
    status: result.status === 2 ? 'success' : result.status === 3 ? 'failed' : 'processing',
    file_id: result.file_id,
    audio_url: result.audio_file,
    error: result.base_resp?.status_msg,
  };
};

/**
 * 获取文件下载信息
 */
export const getFileInfo = async (fileId: string): Promise<{ url: string }> => {
  const { baseUrl, apiKey } = getMinimaxConfig();

  if (!apiKey) {
    throw new Error('MiniMax API Key 未配置');
  }

  const response = await fetch(`${baseUrl}/minimax/v1/files/retrieve?file_id=${fileId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`文件检索失败: ${response.status}`);
  }

  const result = await response.json();
  return { url: result.file?.download_url || '' };
};

/**
 * 异步合成并等待结果
 */
export const synthesizeAsync = async (
  options: TTSOptions,
  onProgress?: (status: string) => void
): Promise<TTSResult> => {
  const taskId = await createAsyncTask(options);

  // 轮询等待结果 (最多5分钟)
  const maxAttempts = 60;
  let attempts = 0;

  while (attempts < maxAttempts) {
    await wait(5000);
    attempts++;

    const result = await queryTask(taskId);
    onProgress?.(result.status);

    if (result.status === 'success') {
      return {
        audio_url: result.audio_url,
      };
    }

    if (result.status === 'failed') {
      throw new Error(`语音合成失败: ${result.error || '未知错误'}`);
    }
  }

  throw new Error('语音合成超时');
};

// ==================== 厂商信息 ====================

export const PROVIDER_INFO = {
  id: 'minimax',
  name: 'MiniMax',
  category: 'audio' as const,
  subcategory: 'tts' as const,
  models: [
    { id: 'speech-2.6-hd', name: 'Speech 2.6 HD', isDefault: true },
  ],
  capabilities: {
    formats: ['mp3', 'wav', 'pcm', 'flac'],
    async: true,
    stream: true,
  },
};
