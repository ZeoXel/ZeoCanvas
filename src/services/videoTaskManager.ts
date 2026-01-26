/**
 * 视频任务管理器
 *
 * 功能：
 * - 持久化待处理的视频任务到 localStorage
 * - 页面刷新后恢复轮询
 * - 任务完成后自动清理
 * - 自动压缩图片避免 Vercel 请求体大小限制
 * - 集成 USERAPI 任务追踪（通过传递 API Key）
 */

import { compressImages } from '@/services/providers/shared';
import { getApiKey } from './userApiService';

const STORAGE_KEY = 'zeocanvas_video_tasks';

export interface VideoTask {
  taskId: string;
  provider: 'veo' | 'seedance' | 'vidu';
  nodeId: string;
  model: string;
  aspectRatio: string;
  createdAt: number;
}

export interface VideoTaskResult {
  taskId: string;
  status: 'SUCCESS' | 'FAILURE' | 'IN_PROGRESS';
  videoUrl?: string;
  error?: string;
}

// 获取所有待处理任务
export const getPendingTasks = (): VideoTask[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const tasks = JSON.parse(data) as VideoTask[];
    // 过滤掉超过 30 分钟的任务（认为已过期）
    const now = Date.now();
    const validTasks = tasks.filter(t => now - t.createdAt < 30 * 60 * 1000);
    // 如果有过期任务被过滤，更新存储
    if (validTasks.length !== tasks.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validTasks));
    }
    return validTasks;
  } catch {
    return [];
  }
};

// 添加任务
export const addTask = (task: VideoTask): void => {
  try {
    const tasks = getPendingTasks();
    // 避免重复添加
    if (!tasks.find(t => t.taskId === task.taskId)) {
      tasks.push(task);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }
  } catch (e) {
    console.warn('[VideoTaskManager] Failed to add task:', e);
  }
};

// 移除任务
export const removeTask = (taskId: string): void => {
  try {
    const tasks = getPendingTasks();
    const filtered = tasks.filter(t => t.taskId !== taskId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[VideoTaskManager] Failed to remove task:', e);
  }
};

// 查询任务状态
export const queryTaskStatus = async (taskId: string, provider: string): Promise<VideoTaskResult> => {
  const apiKey = getApiKey();
  const headers: HeadersInit = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`/api/studio/video?taskId=${taskId}&provider=${provider}`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Query failed: ${response.status}`);
  }
  return response.json();
};

// 轮询单个任务直到完成
export const pollTask = async (
  task: VideoTask,
  onProgress?: (status: string) => void,
  onComplete?: (result: VideoTaskResult) => void,
  onError?: (error: string) => void
): Promise<VideoTaskResult | null> => {
  const maxAttempts = 120; // 10 分钟
  const pollInterval = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await queryTaskStatus(task.taskId, task.provider);

      onProgress?.(result.status);

      if (result.status === 'SUCCESS') {
        removeTask(task.taskId);
        onComplete?.(result);
        return result;
      }

      if (result.status === 'FAILURE') {
        removeTask(task.taskId);
        onError?.(result.error || '视频生成失败');
        return result;
      }

      // IN_PROGRESS - 继续等待
    } catch (err: any) {
      console.warn(`[VideoTaskManager] Poll error (attempt ${i + 1}):`, err.message);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // 超时
  removeTask(task.taskId);
  onError?.('视频生成超时（10分钟）');
  return null;
};

// 创建视频任务（只创建，不轮询）
export const createVideoTask = async (
  nodeId: string,
  requestBody: {
    prompt: string;
    model: string;
    aspectRatio?: string;
    duration?: number;
    images?: string[];
    imageRoles?: string[];
    videoConfig?: any;
    viduSubjects?: any[];
  }
): Promise<VideoTask> => {
  // 压缩图片避免 Vercel 4.5MB 请求体限制
  const compressedBody = { ...requestBody };

  if (requestBody.images && requestBody.images.length > 0) {
    console.log(`[VideoTaskManager] Compressing ${requestBody.images.length} images...`);
    compressedBody.images = await compressImages(requestBody.images, {
      maxWidth: 1280,
      maxHeight: 720,
      quality: 0.85,
    });
  }

  if (requestBody.viduSubjects && requestBody.viduSubjects.length > 0) {
    console.log(`[VideoTaskManager] Compressing Vidu subject images...`);
    compressedBody.viduSubjects = await Promise.all(
      requestBody.viduSubjects.map(async (subject: any) => ({
        ...subject,
        images: await compressImages(subject.images || [], {
          maxWidth: 1280,
          maxHeight: 720,
          quality: 0.85,
        }),
      }))
    );
  }

  const apiKey = getApiKey();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch('/api/studio/video', {
    method: 'POST',
    headers,
    body: JSON.stringify(compressedBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API错误: ${response.status}`);
  }

  const result = await response.json();
  const task: VideoTask = {
    taskId: result.taskId,
    provider: result.provider,
    nodeId,
    model: requestBody.model,
    aspectRatio: requestBody.aspectRatio || '16:9',
    createdAt: Date.now(),
  };

  addTask(task);
  return task;
};
