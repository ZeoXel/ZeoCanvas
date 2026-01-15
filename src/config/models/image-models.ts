import type { ProviderDefinition } from './types';

/** 图片生成厂商列表 */
export const IMAGE_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'nano-banana',
    name: 'Nano Banana',
    category: 'image',
    logo: '/logos/nano-banana.svg',
    models: [
      { id: 'nano-banana', name: 'Nano Banana', isDefault: true },
      { id: 'nano-banana-pro', name: 'Nano Banana Pro' },
    ],
    capabilities: {
      aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      multiImage: true,
      multiOutput: true,
      maxOutputCount: 4,
    },
    defaults: {
      aspectRatio: '16:9',
    },
  },
  {
    id: 'seedream',
    name: 'Seedream',
    category: 'image',
    logo: '/logos/seedream.svg',
    models: [
      { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5', isDefault: true },
    ],
    capabilities: {
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
      multiImage: true,
      multiOutput: true,
      maxOutputCount: 4,
    },
    defaults: {
      aspectRatio: '16:9',
    },
  },
];
