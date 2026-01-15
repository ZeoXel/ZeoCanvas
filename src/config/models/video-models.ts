import type { ProviderDefinition } from './types';

/** 视频生成厂商列表 */
export const VIDEO_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'veo',
    name: 'Veo',
    category: 'video',
    logo: '/logos/veo.svg',
    models: [
      { id: 'veo3.1', name: 'Veo 3.1', isDefault: true },
      { id: 'veo3.1-pro', name: 'Veo 3.1 Pro' },
      { id: 'veo3.1-components', name: 'Veo 多图参考' },
    ],
    capabilities: {
      aspectRatios: ['16:9', '9:16', '1:1'],
      durations: [5, 6, 7, 8],
      firstLastFrame: true,
      multiOutput: true,
      maxOutputCount: 4,
    },
    defaults: {
      aspectRatio: '16:9',
      duration: 8,
    },
  },
  {
    id: 'seedance',
    name: 'Seedance',
    category: 'video',
    logo: '/logos/seedance.svg',
    models: [
      { id: 'doubao-seedance-1-5-pro-251215', name: 'Seedance 1.5', isDefault: true },
    ],
    capabilities: {
      aspectRatios: ['16:9', '9:16', '1:1'],
      durations: [-1, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      firstLastFrame: true,
      multiOutput: true,
      maxOutputCount: 4,
    },
    defaults: {
      aspectRatio: '16:9',
      duration: 5,
    },
  },
  {
    id: 'vidu',
    name: 'Vidu',
    category: 'video',
    logo: '/logos/vidu.svg',
    models: [
      { id: 'viduq2-pro', name: 'Q2 Pro', isDefault: true },
      { id: 'viduq2-turbo', name: 'Q2 Turbo' },
      { id: 'viduq2-pro-fast', name: 'Q2 Pro Fast' },
      { id: 'viduq2', name: 'Q2' },
    ],
    capabilities: {
      aspectRatios: ['16:9', '9:16', '4:3', '3:4', '1:1'],
      durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      resolutions: ['540p', '720p', '1080p'],
      // Vidu 特有功能
      modes: ['text2video', 'img2video', 'start-end', 'multiframe', 'reference', 'reference-audio'],
      firstLastFrame: true,
      multiImage: true,        // 多图参考
      audio: true,             // 音视频直出
      bgm: true,               // 背景音乐
      multiSubject: true,      // 多主体参考
      maxSubjects: 7,
      maxKeyframes: 9,
    },
    defaults: {
      aspectRatio: '16:9',
      duration: 5,
      resolution: '720p',
    },
  },
];
