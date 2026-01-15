'use client';

import { brand as defaultBrand, type BrandConfig } from '@/config/brand';

export type { BrandConfig };

// 客户端直接使用静态配置，无需 fetch
export function useBrand(): BrandConfig {
  return defaultBrand;
}
