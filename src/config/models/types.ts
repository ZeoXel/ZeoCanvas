// 模型注册表类型定义 - 按厂商分组

export type ModelCategory = 'image' | 'video' | 'audio';
export type AudioSubcategory = 'music' | 'voice';

/** 单个模型变体 */
export interface ModelVariant {
  id: string;           // API 调用时使用的模型 ID
  name: string;         // 显示名称 (如 "Nano Banana Pro")
  isDefault?: boolean;  // 是否为该厂商的默认模型
}

/** 模型能力配置 */
export interface ModelCapabilities {
  aspectRatios?: string[];
  durations?: number[];
  resolutions?: string[];
  multiImage?: boolean;
  firstLastFrame?: boolean;
  multiOutput?: boolean;
  maxOutputCount?: number;
  // Vidu 特有功能
  modes?: string[];          // 支持的生成模式
  audio?: boolean;           // 音视频直出
  bgm?: boolean;             // 背景音乐
  multiSubject?: boolean;    // 多主体参考
  maxSubjects?: number;      // 最大主体数
  maxKeyframes?: number;     // 最大关键帧数
}

/** 模型默认值 */
export interface ModelDefaults {
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
}

/** 厂商定义 - 包含该厂商的所有模型变体 */
export interface ProviderDefinition {
  id: string;              // 厂商 ID (如 'nano-banana')
  name: string;            // 厂商显示名称 (如 'Nano Banana')
  category: ModelCategory;
  subcategory?: AudioSubcategory;
  logo?: string;           // 厂商 logo
  models: ModelVariant[];  // 该厂商的所有模型变体
  capabilities: ModelCapabilities;
  defaults: ModelDefaults;
}

/** 菜单分类项 */
export interface MenuCategory {
  type: string;
  label: string;
  icon: string;
  hasSubmenu: boolean;
  providers?: ProviderDefinition[];  // 改为 providers
}

/** 兼容旧接口 - 扁平化的模型定义 */
export interface ModelDefinition {
  id: string;
  name: string;
  shortName?: string;
  category: ModelCategory;
  subcategory?: AudioSubcategory;
  provider: string;
  providerId: string;
  logo?: string;
  capabilities: ModelCapabilities;
  defaults: ModelDefaults;
}
