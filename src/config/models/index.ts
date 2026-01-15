// 模型注册表 - 按厂商分组

import { IMAGE_PROVIDERS } from './image-models';
import { VIDEO_PROVIDERS } from './video-models';
import { AUDIO_PROVIDERS } from './audio-models';
import type { ProviderDefinition, ModelDefinition, ModelCategory, MenuCategory, ModelVariant } from './types';

export type { ProviderDefinition, ModelDefinition, ModelCategory, MenuCategory, ModelVariant } from './types';

// 所有厂商合并
const ALL_PROVIDERS: ProviderDefinition[] = [
  ...IMAGE_PROVIDERS,
  ...VIDEO_PROVIDERS,
  ...AUDIO_PROVIDERS,
];

// 厂商映射 (id -> definition)
const PROVIDER_MAP = new Map<string, ProviderDefinition>(
  ALL_PROVIDERS.map(p => [p.id, p])
);

// 模型ID -> 厂商ID 映射
const MODEL_TO_PROVIDER_MAP = new Map<string, string>();
ALL_PROVIDERS.forEach(provider => {
  provider.models.forEach(model => {
    MODEL_TO_PROVIDER_MAP.set(model.id, provider.id);
  });
});

// ============ API ============

/** 获取厂商定义 */
export function getProvider(providerId: string): ProviderDefinition | undefined {
  return PROVIDER_MAP.get(providerId);
}

/** 根据模型ID获取其所属厂商 */
export function getProviderByModelId(modelId: string): ProviderDefinition | undefined {
  const providerId = MODEL_TO_PROVIDER_MAP.get(modelId);
  return providerId ? PROVIDER_MAP.get(providerId) : undefined;
}

/** 获取厂商的默认模型ID */
export function getDefaultModelId(providerId: string): string | undefined {
  const provider = PROVIDER_MAP.get(providerId);
  if (!provider) return undefined;
  const defaultModel = provider.models.find(m => m.isDefault) || provider.models[0];
  return defaultModel?.id;
}

/** 获取厂商的所有模型变体 */
export function getProviderModels(providerId: string): ModelVariant[] {
  return PROVIDER_MAP.get(providerId)?.models || [];
}

/** 获取指定类别的所有厂商 */
export function getProvidersByCategory(category: ModelCategory): ProviderDefinition[] {
  return ALL_PROVIDERS.filter(p => p.category === category);
}

/** 获取图片厂商 */
export function getImageProviders(): ProviderDefinition[] {
  return IMAGE_PROVIDERS;
}

/** 获取视频厂商 */
export function getVideoProviders(): ProviderDefinition[] {
  return VIDEO_PROVIDERS;
}

/** 获取音频厂商 */
export function getAudioProviders(): ProviderDefinition[] {
  return AUDIO_PROVIDERS;
}

/** 获取菜单结构（用于节点创建菜单） */
export function getMenuStructure(): MenuCategory[] {
  return [
    { type: 'PROMPT_INPUT', label: '提示词', icon: 'Type', hasSubmenu: false },
    { type: 'IMAGE_ASSET', label: '插入图片', icon: 'ImageIcon', hasSubmenu: false },
    { type: 'VIDEO_ASSET', label: '插入视频', icon: 'VideoIcon', hasSubmenu: false },
    { type: 'divider', label: '', icon: '', hasSubmenu: false },
    { type: 'IMAGE_GENERATOR', label: '图片生成', icon: 'ImageIcon', hasSubmenu: true, providers: IMAGE_PROVIDERS },
    { type: 'VIDEO_GENERATOR', label: '视频生成', icon: 'Film', hasSubmenu: true, providers: VIDEO_PROVIDERS },
    { type: 'AUDIO_GENERATOR', label: '音频生成', icon: 'Music', hasSubmenu: true, providers: AUDIO_PROVIDERS },
    { type: 'divider', label: '', icon: '', hasSubmenu: false },
    { type: 'MULTI_FRAME_VIDEO', label: '智能多帧', icon: 'Scan', hasSubmenu: false },
  ];
}

// ============ 兼容旧接口 ============

/** 获取所有模型（扁平化，兼容旧代码） */
export function getAllModels(): ModelDefinition[] {
  return ALL_PROVIDERS.flatMap(provider =>
    provider.models.map(model => ({
      id: model.id,
      name: model.name,
      shortName: model.name,
      category: provider.category,
      subcategory: provider.subcategory,
      provider: provider.name,
      providerId: provider.id,
      logo: provider.logo,
      capabilities: provider.capabilities,
      defaults: provider.defaults,
    }))
  );
}

/** 获取单个模型定义（兼容旧代码） */
export function getModel(modelId: string): ModelDefinition | undefined {
  const provider = getProviderByModelId(modelId);
  if (!provider) return undefined;
  const model = provider.models.find(m => m.id === modelId);
  if (!model) return undefined;
  return {
    id: model.id,
    name: model.name,
    shortName: model.name,
    category: provider.category,
    subcategory: provider.subcategory,
    provider: provider.name,
    providerId: provider.id,
    logo: provider.logo,
    capabilities: provider.capabilities,
    defaults: provider.defaults,
  };
}

/** 获取图片模型列表（兼容旧代码） */
export function getImageModels(): ModelDefinition[] {
  return getAllModels().filter(m => m.category === 'image');
}

/** 获取视频模型列表（兼容旧代码） */
export function getVideoModels(): ModelDefinition[] {
  return getAllModels().filter(m => m.category === 'video');
}

/** 获取音频模型列表（兼容旧代码） */
export function getAudioModels(): ModelDefinition[] {
  return getAllModels().filter(m => m.category === 'audio');
}
