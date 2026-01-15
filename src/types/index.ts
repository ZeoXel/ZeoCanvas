
export enum NodeType {
  PROMPT_INPUT = 'PROMPT_INPUT',
  IMAGE_ASSET = 'IMAGE_ASSET', // 图片素材节点：上传图片素材，传递给下游节点
  VIDEO_ASSET = 'VIDEO_ASSET', // 视频素材节点：上传视频素材，传递给下游节点
  IMAGE_GENERATOR = 'IMAGE_GENERATOR',
  VIDEO_GENERATOR = 'VIDEO_GENERATOR',
  VIDEO_FACTORY = 'VIDEO_FACTORY', // 视频工厂：展示和编辑视频结果
  IMAGE_EDITOR = 'IMAGE_EDITOR',
  AUDIO_GENERATOR = 'AUDIO_GENERATOR', // Suno 音乐生成
  VOICE_GENERATOR = 'VOICE_GENERATOR', // MiniMax 语音合成
  MULTI_FRAME_VIDEO = 'MULTI_FRAME_VIDEO', // 智能多帧视频：多张关键帧+转场生成视频
}

export enum NodeStatus {
  IDLE = 'IDLE',
  WORKING = 'WORKING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export type VideoGenerationMode = 'DEFAULT' | 'CONTINUE' | 'CUT' | 'FIRST_LAST_FRAME' | 'CHARACTER_REF';

// 音频生成模式
export type AudioGenerationMode = 'music' | 'voice';

// Suno 音乐生成配置
export interface MusicGenerationConfig {
  title?: string;               // 歌曲标题
  tags?: string;                // 风格标签 "pop, electronic"
  negativeTags?: string;        // 排除风格 "sad, slow"
  instrumental?: boolean;       // 纯音乐（无人声）
  mv?: string;                  // Suno 模型版本
  taskIds?: string[];           // 异步任务 ID 列表
  status?: 'pending' | 'processing' | 'complete' | 'error';
  coverImage?: string;          // 封面图 URL
}

// MiniMax 语音合成配置
export interface VoiceSynthesisConfig {
  voiceId?: string;             // 音色 ID
  speed?: number;               // 语速 [0.5, 2]
  volume?: number;              // 音量 (0, 10]
  pitch?: number;               // 语调 [-12, 12]
  emotion?: 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm' | 'fluent';
  // 声音效果器
  voiceModify?: {
    pitch?: number;             // 音高 [-100, 100]
    intensity?: number;         // 强度 [-100, 100]
    timbre?: number;            // 音色 [-100, 100]
    soundEffect?: 'spacious_echo' | 'auditorium_echo' | 'lofi_telephone' | 'robotic' | '';
  };
}

export interface AppNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width?: number; // Custom width
  height?: number; // Custom height
  title: string;
  status: NodeStatus;
  data: {
    prompt?: string; // 生成/优化后的提示词（用于下游节点）
    userInput?: string; // 用户的简短想法（用于生成提示词的输入）
    model?: string; // Selected AI model
    image?: string; // Base64 (The currently displayed main image)
    originalImage?: string; // Base64 (Original image before doodles, for editing)
    canvasData?: string; // Base64 PNG (Doodle layer only, transparent background)
    images?: string[]; // Array of Base64 strings (for multiple generations)
    imageCount?: number; // Number of images to generate (1-4)
    videoCount?: number; // Number of videos to generate (1-4)
    videoUri?: string; // URL
    videoUris?: string[]; // Array of URLs (for multiple video generations)
    videoMetadata?: any; // Stores the raw Video object from Gemini API for extension
    audioUri?: string; // Base64 or Blob URL for Audio Node
    audioUris?: string[]; // 多个音频（Suno 会生成两首）
    analysis?: string; // Video analysis result
    error?: string;
    progress?: string;

    // 音频节点扩展配置
    audioMode?: AudioGenerationMode;    // 'music' | 'voice'
    musicConfig?: MusicGenerationConfig; // Suno 音乐配置
    voiceConfig?: VoiceSynthesisConfig;  // MiniMax 语音配置
    aspectRatio?: string; // e.g., '16:9', '4:3'
    resolution?: string; // e.g., '1080p', '4k'
    duration?: number; // Duration in seconds (for Audio/Video)
    
    // Video Strategies (StoryContinuator, SceneDirector, FrameWeaver, CharacterRef)
    generationMode?: VideoGenerationMode; 
    selectedFrame?: string; // Base64 of the specific frame captured from video (Raw)
    croppedFrame?: string; // Base64 of the cropped/edited frame (Final Input)
    
    // Input Management
    sortedInputIds?: string[]; // Order of input nodes for multi-image composition

    // Reference Images (用户上传的参考图，区别于生成结果)
    referenceImages?: string[]; // Base64 strings of uploaded reference images

    // Multi-Frame Video (智能多帧视频节点数据)
    multiFrameData?: {
      frames: SmartSequenceItem[];  // 关键帧列表
      viduModel?: 'viduq2-turbo' | 'viduq2-pro';  // Vidu 模型
      viduResolution?: '540p' | '720p' | '1080p'; // Vidu 分辨率
      taskId?: string;              // Vidu 任务 ID (用于轮询)
    };

    // First-Last Frame (首尾帧视频生成)
    firstLastFrameData?: {
      firstFrame?: string;  // Base64 首帧图片
      lastFrame?: string;   // Base64 尾帧图片
    };

    // Video Provider Extended Config (视频厂商扩展配置)
    videoConfig?: {
      // Vidu Q2 系列 (注：Q2 不支持 style 参数)
      movement_amplitude?: 'auto' | 'small' | 'medium' | 'large';  // 图生/首尾帧
      bgm?: boolean;           // 背景音乐 (首尾帧/文生)
      audio?: boolean;         // 音视频直出 (仅图生)
      voice_id?: string;       // 音色 ID (audio=true 时)
      // Seedance
      return_last_frame?: boolean;  // 返回尾帧
      generate_audio?: boolean;     // 有声视频 (1.5 pro)
      camera_fixed?: boolean;       // 固定摄像头
      watermark?: boolean;          // 水印
      service_tier?: 'default' | 'flex';  // 服务等级
      seed?: number;                // 随机种子
      // Veo
      enhance_prompt?: boolean;     // 增强提示词
    };
  };
  inputs: string[]; // IDs of nodes this node connects FROM
}

export interface Group {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  hasOutputPort?: boolean; // 是否显示右侧连接点（批量素材分组用）
  nodeIds?: string[]; // 分组包含的节点ID列表
}

export interface Connection {
  from: string;
  to: string;
  isAuto?: boolean; // 自动生成的连接（批量生产时），虚线显示且不传递上游参数
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  id?: string;
}

export interface Workflow {
  id: string;
  title: string;
  thumbnail: string;
  nodes: AppNode[];
  connections: Connection[];
  groups: Group[];
}

// Canvas 画布 - 用于保存和恢复工作状态
export interface Canvas {
  id: string;
  title: string;
  thumbnail?: string;
  nodes: AppNode[];
  connections: Connection[];
  groups: Group[];
  createdAt: number;
  updatedAt: number;
  // 视口状态
  pan?: { x: number; y: number };
  scale?: number;
}

// New Smart Sequence Types
export interface SmartSequenceItem {
    id: string;
    src: string; // Base64 or URL
    transition: {
        duration: number; // 1-6s
        prompt: string;
    };
}

// Window interface for Google AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}