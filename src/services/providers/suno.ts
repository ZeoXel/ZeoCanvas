/**
 * Suno AI 音乐生成服务
 *
 * 支持模型:
 * - chirp-v4: Suno V4 (默认)
 * - chirp-v3.5: Suno V3.5
 *
 * 模式:
 * - 灵感模式: 自然语言描述生成音乐
 * - 自定义模式: 标题、风格、歌词完整控制
 */

import { wait } from './shared';

// ==================== 配置 ====================

const getSunoConfig = () => {
  const baseUrl = process.env.SUNO_API_BASE || process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.bltcy.ai';
  const apiKey = process.env.SUNO_API_KEY || process.env.OPENAI_API_KEY;
  return { baseUrl, apiKey };
};

// ==================== 类型定义 ====================

export interface InspirationOptions {
  prompt: string;              // 灵感描述
  make_instrumental?: boolean; // 纯音乐
  mv?: string;                 // 模型版本
}

export interface CustomOptions {
  title?: string;              // 歌曲标题
  tags?: string;               // 风格标签
  prompt: string;              // 歌词
  negative_tags?: string;      // 排除风格
  mv?: string;                 // 模型版本
  make_instrumental?: boolean;
  // 续写相关
  continue_clip_id?: string;
  continue_at?: number;
}

export interface GenerateResult {
  task_id: string;
  song_ids: string[];
}

export interface SongInfo {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  audio_url?: string;
  image_url?: string;
  video_url?: string;
  duration?: number;
  error_message?: string;
  metadata?: {
    tags?: string;
    prompt?: string;
  };
}

export interface QueryResult {
  songs: SongInfo[];
  task_status?: string;
  progress?: string;
}

// ==================== API 函数 ====================

/**
 * 灵感模式生成 - 自然语言描述
 */
export const generateInspiration = async (options: InspirationOptions): Promise<GenerateResult> => {
  const { baseUrl, apiKey } = getSunoConfig();

  if (!apiKey) {
    throw new Error('Suno API Key 未配置');
  }

  const body = {
    gpt_description_prompt: options.prompt,
    make_instrumental: options.make_instrumental || false,
    mv: options.mv || 'chirp-v4',
  };

  const response = await fetch(`${baseUrl}/suno/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': '*/*',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Suno API 错误: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (result.code !== 'success' && result.code !== 0) {
    throw new Error(`Suno 错误: ${result.message || '生成失败'}`);
  }

  const taskId = typeof result.data === 'string' ? result.data : result.data?.song_id;
  const songId2 = result.data?.song_id_2;

  return {
    task_id: taskId,
    song_ids: songId2 ? [taskId, songId2] : [taskId],
  };
};

/**
 * 自定义模式生成 - 完整控制
 */
export const generateCustom = async (options: CustomOptions): Promise<GenerateResult> => {
  const { baseUrl, apiKey } = getSunoConfig();

  if (!apiKey) {
    throw new Error('Suno API Key 未配置');
  }

  const body: any = {
    title: options.title || '',
    tags: options.tags || '',
    prompt: options.prompt || '',
    negative_tags: options.negative_tags || '',
    mv: options.mv || 'chirp-v4',
    make_instrumental: options.make_instrumental || false,
    generation_type: 'TEXT',
  };

  // 续写参数
  if (options.continue_clip_id) {
    body.continue_clip_id = options.continue_clip_id;
    if (options.continue_at !== undefined) {
      body.continue_at = options.continue_at;
    }
  }

  const response = await fetch(`${baseUrl}/suno/submit/music`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': '*/*',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Suno API 错误: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (result.code !== 'success' && result.code !== 0) {
    throw new Error(`Suno 错误: ${result.message || '生成失败'}`);
  }

  const taskId = typeof result.data === 'string' ? result.data : result.data?.song_id;

  return {
    task_id: taskId,
    song_ids: [taskId],
  };
};

/**
 * 查询歌曲状态
 */
export const querySongs = async (songIds: string[]): Promise<QueryResult> => {
  const { baseUrl, apiKey } = getSunoConfig();

  if (!apiKey) {
    throw new Error('Suno API Key 未配置');
  }

  const ids = songIds.join(',');

  // 尝试 /fetch 端点
  let response = await fetch(`${baseUrl}/suno/fetch/${ids}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': '*/*',
    },
  });

  // 失败则尝试 /feed 端点
  if (!response.ok) {
    response = await fetch(`${baseUrl}/suno/feed/${ids}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': '*/*',
      },
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Suno 查询错误: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const taskData = result.data;
  const songsList = taskData?.data || [];

  // 任务还未完成
  if (!songsList || songsList.length === 0) {
    return {
      songs: [{
        id: taskData?.task_id || songIds[0],
        title: '',
        status: mapTaskStatus(taskData?.status),
        error_message: taskData?.fail_reason,
      }],
      task_status: taskData?.status,
      progress: taskData?.progress,
    };
  }

  // 返回歌曲信息
  return {
    songs: songsList.map((song: any) => ({
      id: song.id || song.clip_id,
      title: song.title || '',
      status: mapSongStatus(song.status),
      audio_url: song.audio_url,
      image_url: song.image_url || song.image_large_url,
      video_url: song.video_url,
      duration: song.metadata?.duration || song.duration,
      error_message: song.metadata?.error_message,
      metadata: {
        tags: song.metadata?.tags,
        prompt: song.metadata?.prompt,
      },
    })),
  };
};

/**
 * 生成音乐并等待完成
 */
export const generateAndWait = async (
  options: InspirationOptions | CustomOptions,
  mode: 'inspiration' | 'custom' = 'inspiration',
  onProgress?: (status: string, progress?: string) => void
): Promise<SongInfo[]> => {
  // 创建任务
  const result = mode === 'inspiration'
    ? await generateInspiration(options as InspirationOptions)
    : await generateCustom(options as CustomOptions);

  // 轮询等待结果 (最多10分钟)
  const maxAttempts = 120;
  let attempts = 0;

  while (attempts < maxAttempts) {
    await wait(5000);
    attempts++;

    const queryResult = await querySongs(result.song_ids);
    onProgress?.(queryResult.task_status || 'processing', queryResult.progress);

    // 检查是否所有歌曲都完成
    const allComplete = queryResult.songs.every(s => s.status === 'complete' || s.status === 'error');

    if (allComplete) {
      const hasError = queryResult.songs.some(s => s.status === 'error');
      if (hasError) {
        const errorSong = queryResult.songs.find(s => s.status === 'error');
        throw new Error(`音乐生成失败: ${errorSong?.error_message || '未知错误'}`);
      }
      return queryResult.songs;
    }
  }

  throw new Error('音乐生成超时');
};

// ==================== 辅助函数 ====================

function mapTaskStatus(status: string): 'pending' | 'processing' | 'complete' | 'error' {
  const statusMap: Record<string, 'pending' | 'processing' | 'complete' | 'error'> = {
    'NOT_START': 'pending',
    'QUEUED': 'pending',
    'SUBMITTED': 'pending',
    'PROCESSING': 'processing',
    'IN_PROGRESS': 'processing',
    'SUCCESS': 'complete',
    'COMPLETED': 'complete',
    'FAILURE': 'error',
    'FAILED': 'error',
  };
  return statusMap[status?.toUpperCase()] || 'processing';
}

function mapSongStatus(status: string): 'pending' | 'processing' | 'complete' | 'error' {
  const statusMap: Record<string, 'pending' | 'processing' | 'complete' | 'error'> = {
    'submitted': 'pending',
    'queued': 'pending',
    'streaming': 'processing',
    'processing': 'processing',
    'complete': 'complete',
    'completed': 'complete',
    'error': 'error',
    'failed': 'error',
  };
  return statusMap[status?.toLowerCase()] || 'processing';
}

// ==================== 厂商信息 ====================

export const PROVIDER_INFO = {
  id: 'suno',
  name: 'Suno',
  category: 'audio' as const,
  subcategory: 'music' as const,
  models: [
    { id: 'chirp-v4', name: 'Suno V4', isDefault: true },
    { id: 'chirp-v3.5', name: 'Suno V3.5' },
  ],
  capabilities: {
    inspiration: true,      // 灵感模式
    custom: true,           // 自定义模式
    instrumental: true,     // 纯音乐
    continue: true,         // 续写
    maxDuration: 240,       // 最长4分钟
  },
};
