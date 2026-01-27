/**
 * 消耗追踪服务
 * 在API调用完成后记录消耗到USERAPI网关
 *
 * 重要：积分计算由 USERAPI 网关统一处理
 * 此服务只传递用量信息，不再本地计算积分
 */

import { getApiKey } from './userApiService';
import { emitCreditsUpdated } from './creditsEvents';

// 用量信息类型
export interface UsageData {
  // 视频
  durationSeconds?: number;
  resolution?: string;
  // 图像
  imageCount?: number;
  quality?: string;
  // 音频
  songCount?: number;
  characterCount?: number;
  // 对话
  inputTokens?: number;
  outputTokens?: number;
}

// 消耗记录请求体 - 新版本使用 usage 而非 credits
export interface ConsumptionRecord {
  service: 'video' | 'image' | 'audio' | 'chat';
  provider: string;
  model: string;
  usage: UsageData;
  metadata?: {
    taskId?: string;
    prompt?: string;
    rawProviderCost?: number;  // 厂商原始消耗值（用于记录）
    [key: string]: unknown;
  };
}

// USERAPI 响应
interface RecordConsumptionResponse {
  success: boolean;
  transaction?: {
    id: string;
    credits: number;
    balance: number;
  };
  calculation?: {
    service: string;
    provider: string;
    model: string;
    usage: UsageData;
    calculatedCredits: number;
  };
  error?: string;
}

/**
 * 获取USERAPI基础URL
 */
const getUserApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_USERAPI_URL || 'http://localhost:3001';
};

/**
 * 记录消耗到USERAPI网关
 * USERAPI 会根据 usage 自动计算积分
 */
export async function recordConsumption(record: ConsumptionRecord): Promise<RecordConsumptionResponse> {
  const baseUrl = getUserApiBaseUrl();
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('[ConsumptionTracker] No API key, skipping consumption recording');
    return { success: false, error: 'No API key' };
  }

  try {
    const response = await fetch(`${baseUrl}/api/credits/consume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        service: record.service,
        provider: record.provider,
        model: record.model,
        // 传递用量信息，让 USERAPI 计算积分
        usage: record.usage,
        metadata: record.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[ConsumptionTracker] Failed to record consumption:', error);
      return { success: false, error: error.error || 'Failed to record' };
    }

    const result = await response.json();
    console.log('[ConsumptionTracker] Consumption recorded:', result);

    // 触发积分更新事件，通知 UI 刷新
    if (result.transaction) {
      emitCreditsUpdated({
        credits: result.transaction.credits,
        balance: result.transaction.balance,
        type: 'consumption',
        service: record.service,
      });
    }

    return {
      success: true,
      transaction: result.transaction,
      calculation: result.calculation,
    };
  } catch (error) {
    console.error('[ConsumptionTracker] Error recording consumption:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// 各服务类型的消耗记录函数
// ============================================

/**
 * 记录视频生成消耗
 */
export async function recordVideoConsumption(params: {
  provider: string;
  model: string;
  taskId: string;
  durationSeconds: number;
  resolution?: '480p' | '720p' | '1080p';
  prompt?: string;
  viduCredits?: number;  // Vidu API 返回的原始 credits（用于记录）
}): Promise<RecordConsumptionResponse> {
  return recordConsumption({
    service: 'video',
    provider: params.provider,
    model: params.model,
    usage: {
      durationSeconds: params.durationSeconds,
      resolution: params.resolution || '720p',
    },
    metadata: {
      taskId: params.taskId,
      prompt: params.prompt,
      rawProviderCost: params.viduCredits,
    },
  });
}

/**
 * 记录图像生成消耗
 */
export async function recordImageConsumption(params: {
  provider: string;
  model: string;
  taskId?: string;
  imageCount: number;
  resolution?: string;
  quality?: string;
  prompt?: string;
  seedreamTokens?: number;  // Seedream 返回的 total_tokens（用于记录）
}): Promise<RecordConsumptionResponse> {
  return recordConsumption({
    service: 'image',
    provider: params.provider,
    model: params.model,
    usage: {
      imageCount: params.imageCount,
      resolution: params.resolution,
      quality: params.quality,
    },
    metadata: {
      taskId: params.taskId,
      prompt: params.prompt,
      rawProviderCost: params.seedreamTokens,
    },
  });
}

/**
 * 记录音频生成消耗
 */
export async function recordAudioConsumption(params: {
  provider: string;
  model: string;
  taskId?: string;
  songCount?: number;
  durationSeconds?: number;
  characterCount?: number;
  prompt?: string;
}): Promise<RecordConsumptionResponse> {
  return recordConsumption({
    service: 'audio',
    provider: params.provider,
    model: params.model,
    usage: {
      songCount: params.songCount,
      characterCount: params.characterCount,
    },
    metadata: {
      taskId: params.taskId,
      prompt: params.prompt,
    },
  });
}

/**
 * 记录Chat/分析消耗
 */
export async function recordChatConsumption(params: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  prompt?: string;
}): Promise<RecordConsumptionResponse> {
  return recordConsumption({
    service: 'chat',
    provider: params.provider,
    model: params.model,
    usage: {
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
    },
    metadata: {
      prompt: params.prompt?.slice(0, 200), // 截断长prompt
    },
  });
}

// ============================================
// 预检查：检查用户是否有足够积分
// ============================================

/**
 * 检查用户积分余额是否足够
 */
export async function checkSufficientCredits(requiredCredits: number): Promise<{
  sufficient: boolean;
  balance: number;
  required: number;
}> {
  const baseUrl = getUserApiBaseUrl();
  const apiKey = getApiKey();

  if (!apiKey) {
    return { sufficient: false, balance: 0, required: requiredCredits };
  }

  try {
    const response = await fetch(`${baseUrl}/api/credits/balance`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return { sufficient: false, balance: 0, required: requiredCredits };
    }

    const data = await response.json();
    const balance = data.remaining || 0;

    return {
      sufficient: balance >= requiredCredits,
      balance,
      required: requiredCredits,
    };
  } catch (error) {
    console.error('[ConsumptionTracker] Error checking balance:', error);
    return { sufficient: false, balance: 0, required: requiredCredits };
  }
}

/**
 * 从 USERAPI 获取预估积分
 * 注意：这是本地估算，实际计费以 USERAPI 为准
 */
export async function fetchEstimatedCredits(
  type: 'video' | 'image' | 'audio' | 'chat',
  provider: string,
  model: string,
  usage: UsageData
): Promise<number> {
  const baseUrl = getUserApiBaseUrl();
  const apiKey = getApiKey();

  if (!apiKey) {
    return 0;
  }

  try {
    const response = await fetch(`${baseUrl}/api/credits/pricing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        service: type,
        provider,
        model,
        usage,
      }),
    });

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.calculatedCredits || 0;
  } catch (error) {
    console.error('[ConsumptionTracker] Error fetching estimate:', error);
    return 0;
  }
}

/**
 * 本地预估任务消耗积分（备用，当无法连接 USERAPI 时使用）
 * 警告：这只是粗略估算，实际计费以 USERAPI pricing.yaml 为准
 */
export function estimateCreditsLocally(
  type: 'video' | 'image' | 'audio' | 'chat',
  params: {
    durationSeconds?: number;
    resolution?: string;
    imageCount?: number;
    songCount?: number;
    characterCount?: number;
    inputTokens?: number;
    outputTokens?: number;
  }
): number {
  // 这些是粗略估算值，实际以 USERAPI 为准
  switch (type) {
    case 'video':
      // 假设每秒 15 积分，分辨率倍率 0.6/1.0/1.5
      const videoBase = 15;
      const resMultiplier = params.resolution === '1080p' ? 1.5 :
                           params.resolution === '480p' ? 0.6 : 1.0;
      return Math.ceil((params.durationSeconds || 4) * videoBase * resMultiplier);

    case 'image':
      // 假设每张 3 积分
      return (params.imageCount || 1) * 3;

    case 'audio':
      // 假设每首 50 积分
      return (params.songCount || 1) * 50;

    case 'chat':
      // 假设 input 0.5/1K, output 1.5/1K
      const inputCredits = ((params.inputTokens || 0) / 1000) * 0.5;
      const outputCredits = ((params.outputTokens || 0) / 1000) * 1.5;
      return Math.ceil(inputCredits + outputCredits);

    default:
      return 0;
  }
}
