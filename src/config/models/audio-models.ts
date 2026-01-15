import type { ProviderDefinition } from './types';

/** 音频生成厂商列表 */
export const AUDIO_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'suno',
    name: 'Suno 音乐',
    category: 'audio',
    subcategory: 'music',
    logo: '/logos/suno.svg',
    models: [
      { id: 'suno-v4', name: 'Suno V4', isDefault: true },
    ],
    capabilities: {
      multiOutput: true,
      maxOutputCount: 2,
    },
    defaults: {},
  },
  {
    id: 'minimax',
    name: 'MiniMax 语音',
    category: 'audio',
    subcategory: 'voice',
    logo: '/logos/minimax.svg',
    models: [
      { id: 'speech-2.6-hd', name: 'Speech 2.6 HD', isDefault: true },
    ],
    capabilities: {},
    defaults: {},
  },
];
