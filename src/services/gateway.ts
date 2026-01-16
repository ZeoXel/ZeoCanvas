/**
 * USERAPI 网关统一调用模块
 *
 * 所有 API 调用通过此模块转发到 USERAPI 网关
 * 使用用户的 ua_xxx API Key 进行认证
 */

import { getApiKey } from './userApiService';

// 网关配置
const getGatewayConfig = () => {
    const baseUrl = process.env.NEXT_PUBLIC_USERAPI_URL || 'http://localhost:3001';
    return { baseUrl };
};

// 错误类型
export class GatewayError extends Error {
    status: number;
    code?: string;

    constructor(message: string, status: number, code?: string) {
        super(message);
        this.name = 'GatewayError';
        this.status = status;
        this.code = code;
    }
}

/**
 * 通用网关请求
 */
export async function gatewayFetch(
    provider: string,
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    const { baseUrl } = getGatewayConfig();
    const apiKey = getApiKey();

    if (!apiKey) {
        throw new GatewayError('未登录或 API Key 无效，请重新登录', 401, 'UNAUTHORIZED');
    }

    // 构建网关 URL: /api/v1/{provider}/{path}
    const gatewayPath = path.startsWith('/') ? path.slice(1) : path;
    const url = `${baseUrl}/api/v1/${provider}/${gatewayPath}`;

    // 合并 headers
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${apiKey}`);
    if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
    }

    console.log(`[Gateway] ${options.method || 'GET'} ${provider}/${gatewayPath}`);

    const response = await fetch(url, {
        ...options,
        headers,
    });

    return response;
}

/**
 * 网关 POST 请求
 */
export async function gatewayPost<T = unknown>(
    provider: string,
    path: string,
    body: unknown
): Promise<T> {
    const response = await gatewayFetch(provider, path, {
        method: 'POST',
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new GatewayError(
            data.error || data.message || `请求失败: ${response.status}`,
            response.status,
            data.code
        );
    }

    return data;
}

/**
 * 网关 GET 请求
 */
export async function gatewayGet<T = unknown>(
    provider: string,
    path: string,
    params?: Record<string, string>
): Promise<T> {
    let fullPath = path;
    if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath = `${path}?${searchParams.toString()}`;
    }

    const response = await gatewayFetch(provider, fullPath, {
        method: 'GET',
    });

    const data = await response.json();

    if (!response.ok) {
        throw new GatewayError(
            data.error || data.message || `请求失败: ${response.status}`,
            response.status,
            data.code
        );
    }

    return data;
}

// ==================== Vidu API ====================

export interface ViduCreateTaskParams {
    mode: 'text2video' | 'img2video' | 'start-end' | 'multiframe' | 'reference' | 'reference-audio';
    model?: 'viduq2-turbo' | 'viduq2-pro';
    resolution?: '540p' | '720p' | '1080p';
    watermark?: boolean;
    wm_url?: string;
    wm_position?: string;
    // text2video
    prompt?: string;
    // img2video / multiframe
    start_image?: string;
    image_settings?: Array<{
        key_image: string;
        prompt?: string;
        duration?: number;
    }>;
    // start-end
    end_image?: string;
    // reference
    reference_image?: string;
}

export interface ViduTaskResult {
    task_id?: string;
    state?: string;
    video_url?: string;
    cover_url?: string;
    creation_id?: string;
    credits?: number;
    error?: string;
}

/**
 * 创建 Vidu 视频任务
 */
export async function viduCreateTask(params: ViduCreateTaskParams): Promise<ViduTaskResult> {
    const endpoint = getViduEndpoint(params.mode);
    return gatewayPost<ViduTaskResult>('vidu', endpoint, params);
}

/**
 * 查询 Vidu 任务状态
 */
export async function viduQueryTask(taskId: string): Promise<ViduTaskResult> {
    return gatewayGet<ViduTaskResult>('vidu', `ent/v2/tasks/${taskId}`);
}

function getViduEndpoint(mode: string): string {
    const endpoints: Record<string, string> = {
        'text2video': 'ent/v2/text2video',
        'img2video': 'ent/v2/img2video',
        'start-end': 'ent/v2/start-end',
        'multiframe': 'ent/v2/multiframe',
        'reference': 'ent/v2/reference',
        'reference-audio': 'ent/v2/reference-audio',
    };
    return endpoints[mode] || 'ent/v2/text2video';
}

// ==================== MiniMax TTS API ====================

export interface MinimaxTTSParams {
    text: string;
    model?: string;
    voice_setting?: {
        voice_id?: string;
        speed?: number;
        vol?: number;
        pitch?: number;
        emotion?: string;
    };
    audio_setting?: {
        sample_rate?: number;
        bitrate?: number;
        format?: 'mp3' | 'wav' | 'pcm' | 'flac';
        channel?: number;
    };
    stream?: boolean;
}

export interface MinimaxTTSResult {
    audio_file?: string;
    audio_url?: string;
    data?: {
        audio?: string;
        duration?: number;
    };
    base_resp?: {
        status_code: number;
        status_msg?: string;
    };
}

/**
 * MiniMax 语音合成 (同步)
 */
export async function minimaxSynthesize(params: MinimaxTTSParams): Promise<MinimaxTTSResult> {
    return gatewayPost<MinimaxTTSResult>('openai', 'minimax/v1/t2a_v2', {
        model: params.model || 'speech-2.6-hd',
        text: params.text,
        stream: params.stream ?? false,
        voice_setting: {
            voice_id: params.voice_setting?.voice_id || 'male-qn-qingse',
            speed: params.voice_setting?.speed ?? 1,
            vol: params.voice_setting?.vol ?? 1,
            pitch: params.voice_setting?.pitch ?? 0,
            ...(params.voice_setting?.emotion && { emotion: params.voice_setting.emotion }),
        },
        audio_setting: {
            sample_rate: params.audio_setting?.sample_rate ?? 32000,
            bitrate: params.audio_setting?.bitrate ?? 128000,
            format: params.audio_setting?.format || 'mp3',
            channel: params.audio_setting?.channel ?? 1,
        },
    });
}

// ==================== Suno Music API ====================

export interface SunoGenerateParams {
    mode: 'inspiration' | 'custom';
    // inspiration mode
    gpt_description_prompt?: string;
    // custom mode
    title?: string;
    tags?: string;
    prompt?: string;
    negative_tags?: string;
    // common
    mv?: string;
    make_instrumental?: boolean;
    continue_clip_id?: string;
    continue_at?: number;
}

export interface SunoGenerateResult {
    code: string | number;
    data: string | {
        song_id?: string;
        song_id_2?: string;
        task_id?: string;
    };
    message?: string;
}

export interface SunoSongInfo {
    id: string;
    title?: string;
    status: string;
    audio_url?: string;
    image_url?: string;
    video_url?: string;
    duration?: number;
    metadata?: {
        tags?: string;
        prompt?: string;
        error_message?: string;
    };
}

export interface SunoQueryResult {
    code: string | number;
    data: {
        task_id?: string;
        status?: string;
        progress?: string;
        fail_reason?: string;
        data?: SunoSongInfo[];
    };
}

/**
 * Suno 灵感模式生成
 */
export async function sunoGenerateInspiration(params: {
    prompt: string;
    make_instrumental?: boolean;
    mv?: string;
}): Promise<SunoGenerateResult> {
    return gatewayPost<SunoGenerateResult>('openai', 'suno/generate', {
        gpt_description_prompt: params.prompt,
        make_instrumental: params.make_instrumental || false,
        mv: params.mv || 'chirp-v4',
    });
}

/**
 * Suno 自定义模式生成
 */
export async function sunoGenerateCustom(params: {
    title?: string;
    tags?: string;
    prompt: string;
    negative_tags?: string;
    mv?: string;
    make_instrumental?: boolean;
    continue_clip_id?: string;
    continue_at?: number;
}): Promise<SunoGenerateResult> {
    return gatewayPost<SunoGenerateResult>('openai', 'suno/submit/music', {
        title: params.title || '',
        tags: params.tags || '',
        prompt: params.prompt || '',
        negative_tags: params.negative_tags || '',
        mv: params.mv || 'chirp-v4',
        make_instrumental: params.make_instrumental || false,
        generation_type: 'TEXT',
        ...(params.continue_clip_id && {
            continue_clip_id: params.continue_clip_id,
            continue_at: params.continue_at,
        }),
    });
}

/**
 * Suno 查询歌曲状态
 */
export async function sunoQuerySongs(songIds: string[]): Promise<SunoQueryResult> {
    const ids = songIds.join(',');
    try {
        return await gatewayGet<SunoQueryResult>('openai', `suno/fetch/${ids}`);
    } catch {
        // 失败则尝试 /feed 端点
        return gatewayGet<SunoQueryResult>('openai', `suno/feed/${ids}`);
    }
}

// ==================== OpenAI Compatible API ====================

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface ChatCompletionParams {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

export interface ChatCompletionResult {
    id: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * OpenAI 兼容聊天接口
 */
export async function chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    return gatewayPost<ChatCompletionResult>('openai', 'v1/chat/completions', params);
}

// ==================== Image Generation API ====================

export interface ImageGenerationParams {
    model: string;
    prompt: string;
    size?: string;
    n?: number;
    response_format?: 'url' | 'b64_json';
}

export interface ImageGenerationResult {
    data: Array<{
        url?: string;
        b64_json?: string;
    }>;
}

/**
 * 图像生成 (OpenAI 兼容)
 */
export async function generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
    return gatewayPost<ImageGenerationResult>('openai', 'v1/images/generations', params);
}

// ==================== Volcengine Seedream API ====================

export interface SeedreamParams {
    model: string;
    prompt: string;
    size?: string;
    seed?: number;
    // 其他 Seedream 特定参数
}

/**
 * 火山引擎 Seedream 图像生成
 */
export async function seedreamGenerate(params: SeedreamParams): Promise<ImageGenerationResult> {
    return gatewayPost<ImageGenerationResult>('volcengine', 'images/generations', params);
}
