/**
 * USERAPI 任务服务（服务端版本）
 *
 * 在 API 路由中调用 USERAPI 的任务管理 API
 * 用于记录任务状态和消费
 */

// USERAPI 基础 URL
const getUserApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_USERAPI_URL || 'http://localhost:3001';
};

// 任务创建参数
export interface CreateTaskParams {
  taskId: string;
  platform: string;
  action: string;
  quotaPreConsumed?: number;
  requestData?: Record<string, unknown>;
}

// 任务更新参数
export interface UpdateTaskParams {
  status?: 'submitted' | 'queued' | 'in_progress' | 'success' | 'failure';
  progress?: string;
  failReason?: string;
  quotaActual?: number;
  responseData?: Record<string, unknown>;
}

// USERAPI 任务响应
export interface TaskResponse {
  success: boolean;
  data?: {
    id: string;
    taskId: string;
    platform: string;
    action: string;
    status: string;
    progress?: string;
    failReason?: string;
    quotaPreConsumed?: number;
    quotaActual?: number;
    requestData?: Record<string, unknown>;
    responseData?: Record<string, unknown>;
  };
  error?: string;
}

/**
 * 在 USERAPI 创建任务记录
 */
export async function createUserApiTask(
  apiKey: string,
  params: CreateTaskParams
): Promise<TaskResponse> {
  const baseUrl = getUserApiBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[UserApiTasks] Failed to create task:', data);
      return { success: false, error: data.error || 'Failed to create task' };
    }

    console.log('[UserApiTasks] Task created:', data.data?.id);
    return { success: true, data: data.data };
  } catch (error) {
    console.error('[UserApiTasks] Error creating task:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 更新 USERAPI 任务状态
 */
export async function updateUserApiTask(
  apiKey: string,
  taskId: string,
  params: UpdateTaskParams
): Promise<TaskResponse> {
  const baseUrl = getUserApiBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/v1/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[UserApiTasks] Failed to update task:', data);
      return { success: false, error: data.error || 'Failed to update task' };
    }

    console.log('[UserApiTasks] Task updated:', taskId, params.status);
    return { success: true, data: data.data };
  } catch (error) {
    console.error('[UserApiTasks] Error updating task:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 记录消费到 USERAPI
 */
export async function recordConsumptionServer(
  apiKey: string,
  params: {
    service: 'video' | 'image' | 'audio' | 'chat';
    provider: string;
    model: string;
    usage: {
      durationSeconds?: number;
      resolution?: string;
      imageCount?: number;
      songCount?: number;
      inputTokens?: number;
      outputTokens?: number;
    };
    metadata?: {
      taskId?: string;
      prompt?: string;
      [key: string]: unknown;
    };
  }
): Promise<{ success: boolean; credits?: number; balance?: number; error?: string }> {
  const baseUrl = getUserApiBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/credits/consume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[UserApiTasks] Failed to record consumption:', data);
      return { success: false, error: data.error || 'Failed to record consumption' };
    }

    console.log('[UserApiTasks] Consumption recorded:', data.transaction?.credits);
    return {
      success: true,
      credits: data.transaction?.credits,
      balance: data.transaction?.balance,
    };
  } catch (error) {
    console.error('[UserApiTasks] Error recording consumption:', error);
    return { success: false, error: String(error) };
  }
}
