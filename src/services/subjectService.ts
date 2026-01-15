/**
 * 主体服务 - 提供主体相关工具函数
 *
 * 核心理念：主体 = 命名的参考图素材库
 * - Vidu: 原生多图主体支持
 * - 其他场景: @主体ID 自动解析为参考图输入
 */

import type { Subject } from '@/types';

// ==================== 主体引用解析 ====================

/** 主体引用解析结果 */
export interface SubjectReference {
  id: string;           // 主体 ID
  primaryImage: string; // 主要图片 (front 角度或第一张)
  name: string;         // 主体名称
  subject: Subject;     // 完整的主体对象
}

/**
 * 从提示词中解析 @主体名称 引用
 * 支持格式: @小灰 @机器人 等（按名称匹配）
 * @param prompt 提示词
 * @param subjects 主体库
 * @returns 解析出的主体引用列表
 */
export const parseSubjectReferences = (
  prompt: string,
  subjects: Subject[]
): SubjectReference[] => {
  if (!prompt || !subjects || subjects.length === 0) return [];

  const refs: SubjectReference[] = [];
  const seen = new Set<string>();

  // 按名称长度降序排序，优先匹配更长的名称（避免 @小灰灰 被 @小灰 误匹配）
  const sortedSubjects = [...subjects].sort((a, b) => b.name.length - a.name.length);

  for (const subject of sortedSubjects) {
    // 转义正则特殊字符
    const escapedName = subject.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 匹配 @名称，名称后不能是英文字母数字下划线（避免 @test 匹配 @test123）
    // 中文场景：@小灰在奔跑 可以匹配，因为"在"不是英文字符
    const pattern = new RegExp(`@${escapedName}(?![a-zA-Z0-9_])`, 'g');

    if (pattern.test(prompt) && !seen.has(subject.id)) {
      seen.add(subject.id);

      if (subject.images.length > 0) {
        // 获取主要图片：优先 front 角度，否则取第一张
        const frontImage = subject.images.find(img => img.angle === 'front');
        const primaryImage = frontImage?.base64 || subject.images[0].base64;

        refs.push({
          id: subject.id,
          primaryImage,
          name: subject.name,
          subject, // 完整的主体对象
        });
      }
    }
  }

  return refs;
};

/**
 * 清理提示词中的 @主体名称 引用（用于非 Vidu 场景）
 * @param prompt 原始提示词
 * @param subjects 主体库（用于识别名称）
 * @returns 清理后的提示词
 */
export const cleanSubjectReferences = (prompt: string, subjects?: Subject[]): string => {
  if (!prompt) return prompt;

  if (!subjects || subjects.length === 0) {
    return prompt;
  }

  let cleaned = prompt;

  // 按名称长度降序排序，优先清理更长的名称
  const sortedSubjects = [...subjects].sort((a, b) => b.name.length - a.name.length);

  for (const subject of sortedSubjects) {
    const escapedName = subject.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 使用与 parseSubjectReferences 相同的匹配规则
    const pattern = new RegExp(`@${escapedName}(?![a-zA-Z0-9_])`, 'g');
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim().replace(/\s+/g, ' ');
};

/**
 * 获取主体的主要图片（front 角度或第一张）
 * @param subject 主体
 * @returns 主要图片 Base64
 */
export const getPrimaryImage = (subject: Subject): string | null => {
  if (!subject || !subject.images || subject.images.length === 0) return null;
  const frontImage = subject.images.find(img => img.angle === 'front');
  return frontImage?.base64 || subject.images[0].base64;
};

// ==================== 缩略图生成 ====================

/**
 * 生成缩略图 - 压缩图片用于预览
 * @param imageSource 原始图片 (Base64 或 URL)
 * @param maxSize 最大尺寸（默认 200px）
 * @returns 压缩后的图片 Base64
 */
export const generateThumbnail = (imageSource: string, maxSize: number = 200): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // 设置 crossOrigin 以避免 canvas 被污染（需要在 src 之前设置）
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          // 回退：返回原图
          resolve(imageSource);
          return;
        }

        // 计算缩放比例
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        // 绘制缩略图
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 转换为 Base64
        const thumbnail = canvas.toDataURL('image/png');
        resolve(thumbnail);
      } catch (err) {
        // 如果 toDataURL 失败（跨域问题），回退返回原图
        console.warn('[SubjectService] 缩略图生成失败，使用原图:', err);
        resolve(imageSource);
      }
    };

    img.onerror = () => {
      // 加载失败时回退返回原图
      console.warn('[SubjectService] 图片加载失败，使用原图');
      resolve(imageSource);
    };

    img.src = imageSource;
  });
};

/**
 * 生成唯一的主体 ID
 * @param prefix 前缀（默认 'subj'）
 * @returns 唯一 ID
 */
export const generateSubjectId = (prefix: string = 'subj'): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${timestamp}_${random}`;
};

/**
 * 生成唯一的主体图片 ID
 * @returns 唯一 ID
 */
export const generateSubjectImageId = (): string => {
  return generateSubjectId('simg');
};
