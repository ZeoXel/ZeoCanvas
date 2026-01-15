// 品牌配置 - 修改此处即可更换品牌

export const brand = {
  name: 'LSAI Studio',           // 完整名称（用于 alt 等）
  namePrefix: 'LSAI ',           // 普通部分
  nameHighlight: 'Studio',       // 渐变高亮部分
  slogan: 'AI Creative Workspace',
  title: 'LSAI Studio - AI Creative Workflow',
  description: 'AI-powered creative workflow studio',
  logo: {
    light: '/logo-dark.svg',     // 浅色模式使用的 logo
    dark: '/logo-light.svg',     // 深色模式使用的 logo
    favicon: '/logo-dark.svg'    // 浏览器图标
  }
} as const;

export type BrandConfig = typeof brand;
