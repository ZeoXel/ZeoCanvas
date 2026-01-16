/**
 * Suno API 服务 - AI 音乐生成
 *
 * 通过 USERAPI 网关调用
 *
 * 支持两种模式:
 * - 灵感模式：只需提供描述，AI 自动生成歌词和风格
 * - 自定义模式：完全控制标题、风格标签、歌词等
 *
 * 异步生成，需要轮询查询结果
 */

import { sunoGenerateInspiration, sunoGenerateCustom, sunoQuerySongs, GatewayError } from './gateway';

// ============ 类型定义 ============

export interface SunoGenerateParams {
    prompt: string;              // 音乐描述/灵感
    make_instrumental?: boolean; // 纯音乐（无人声）
}

export interface SunoCustomParams {
    title?: string;              // 歌曲标题
    tags?: string;               // 音乐风格标签，逗号分隔
    negative_tags?: string;      // 不希望出现的风格
    prompt?: string;             // 歌词/创作提示
    mv?: string;                 // 模型版本
    make_instrumental?: boolean; // 纯音乐
    generation_type?: string;    // 生成类型，默认 TEXT
}

export interface SunoGenerateResponse {
    code: number;
    data?: {
        song_id: string;
        song_id_2?: string;
    };
    message?: string;
}

export interface SunoSongInfo {
    id: string;
    title: string;
    status: 'pending' | 'processing' | 'complete' | 'error';
    audio_url?: string;
    image_url?: string;
    duration?: number;
    error_message?: string;
    metadata?: {
        tags?: string;
        prompt?: string;
    };
}

export interface SunoFeedResponse {
    code: number;
    data?: SunoSongInfo[];
    message?: string;
}

// ============ 版本预设 ============

export const SUNO_VERSION_PRESETS = [
    { label: 'Suno v3.0', value: 'chirp-v3-0', desc: '经典版本，稳定可靠' },
    { label: 'Suno v3.5', value: 'chirp-v3-5', desc: '改进版，音质更好' },
    { label: 'Suno v4.0', value: 'chirp-v4', desc: '主流版本，平衡质量与速度' },
    { label: 'Suno v4.5', value: 'chirp-auk', desc: '增强版，细节更丰富' },
    { label: 'Suno v4.5+', value: 'chirp-bluejay', desc: '进阶版，音乐性更强' },
    { label: 'Suno v5', value: 'chirp-crow', desc: '最新版，最佳音质' },
];

// ============ 音乐风格预设 ============

export const MUSIC_STYLE_PRESETS = [
    { label: '流行', value: 'pop, catchy, modern' },
    { label: '摇滚', value: 'rock, guitar, energetic' },
    { label: '电子', value: 'electronic, synth, dance' },
    { label: '古典', value: 'classical, orchestral, piano' },
    { label: '爵士', value: 'jazz, smooth, saxophone' },
    { label: 'R&B', value: 'rnb, soulful, groove' },
    { label: '民谣', value: 'folk, acoustic, gentle' },
    { label: '嘻哈', value: 'hiphop, rap, beat' },
    { label: '中国风', value: 'chinese, traditional, erhu' },
    { label: '轻音乐', value: 'ambient, relaxing, peaceful' },
];

// ============ 灵感模式 API ============

/**
 * 提交音乐生成任务（灵感模式）
 * 通过 USERAPI 网关调用
 */
export const generateMusic = async (params: SunoGenerateParams): Promise<{ songIds: string[] }> => {
    try {
        const result = await sunoGenerateInspiration({
            prompt: params.prompt,
            make_instrumental: params.make_instrumental || false,
        });

        if (result.code !== 'success' && result.code !== 0) {
            throw new Error((result as { message?: string }).message || '生成失败');
        }

        const data = result.data;
        const taskId = typeof data === 'string' ? data : data?.song_id;
        const songId2 = typeof data === 'object' ? data?.song_id_2 : undefined;

        const songIds = [taskId!];
        if (songId2) {
            songIds.push(songId2);
        }

        return { songIds };
    } catch (error) {
        if (error instanceof GatewayError) {
            throw new Error(`Suno API 错误: ${error.message}`);
        }
        throw error;
    }
};

/**
 * 提交音乐生成任务（自定义模式）
 * 通过 USERAPI 网关调用
 */
export const generateMusicCustom = async (params: SunoCustomParams): Promise<{ songIds: string[] }> => {
    try {
        const result = await sunoGenerateCustom({
            title: params.title,
            tags: params.tags,
            prompt: params.prompt || '',
            negative_tags: params.negative_tags,
            mv: params.mv || 'chirp-v4',
            make_instrumental: params.make_instrumental || false,
        });

        if (result.code !== 'success' && result.code !== 0) {
            throw new Error((result as { message?: string }).message || '生成失败');
        }

        const data = result.data;
        const taskId = typeof data === 'string' ? data : data?.song_id;
        const songId2 = typeof data === 'object' ? data?.song_id_2 : undefined;

        const songIds = [taskId!];
        if (songId2) {
            songIds.push(songId2);
        }

        return { songIds };
    } catch (error) {
        if (error instanceof GatewayError) {
            throw new Error(`Suno API 错误: ${error.message}`);
        }
        throw error;
    }
};

// ============ 通用 API ============

/**
 * 查询歌曲生成状态
 * 通过 USERAPI 网关调用
 */
export const querySongStatus = async (songIds: string[]): Promise<SunoSongInfo[]> => {
    try {
        const result = await sunoQuerySongs(songIds);

        const taskData = result.data;
        const songsList = taskData?.data || [];

        // 任务还未完成，返回临时状态
        if (!songsList || songsList.length === 0) {
            return [{
                id: taskData?.task_id || songIds[0],
                title: '',
                status: mapTaskStatus(taskData?.status),
                error_message: taskData?.fail_reason,
            }];
        }

        // 返回歌曲信息
        return songsList.map((song) => ({
            id: song.id,
            title: song.title || '',
            status: mapSongStatus(song.status),
            audio_url: song.audio_url,
            image_url: song.image_url,
            duration: song.duration,
            error_message: song.metadata?.error_message,
            metadata: song.metadata,
        }));
    } catch (error) {
        if (error instanceof GatewayError) {
            throw new Error(`查询失败: ${error.message}`);
        }
        throw error;
    }
};

// 辅助函数：映射任务状态
function mapTaskStatus(status?: string): SunoSongInfo['status'] {
    const statusMap: Record<string, SunoSongInfo['status']> = {
        'NOT_START': 'pending',
        'QUEUED': 'pending',
        'SUBMITTED': 'pending',
        'PROCESSING': 'processing',
        'IN_PROGRESS': 'processing',
        'SUCCESS': 'complete',
        'COMPLETED': 'complete',
        'FAILURE': 'error',
        'FAILED': 'error',
    };
    return statusMap[status?.toUpperCase() || ''] || 'processing';
}

// 辅助函数：映射歌曲状态
function mapSongStatus(status?: string): SunoSongInfo['status'] {
    const statusMap: Record<string, SunoSongInfo['status']> = {
        'submitted': 'pending',
        'queued': 'pending',
        'streaming': 'processing',
        'processing': 'processing',
        'complete': 'complete',
        'completed': 'complete',
        'error': 'error',
        'failed': 'error',
    };
    return statusMap[status?.toLowerCase() || ''] || 'processing';
}

/**
 * 轮询等待音乐生成完成
 */
export const waitForMusicGeneration = async (
    songIds: string[],
    onProgress?: (progress: string, songs?: SunoSongInfo[]) => void,
    maxAttempts: number = 120,
    interval: number = 3000
): Promise<SunoSongInfo[]> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const songs = await querySongStatus(songIds);

        const allComplete = songs.every(s => s.status === 'complete');
        const anyError = songs.find(s => s.status === 'error');

        if (anyError) {
            throw new Error(anyError.error_message || '音乐生成失败');
        }

        if (allComplete) {
            onProgress?.('生成完成!', songs);
            return songs;
        }

        const progressPercent = Math.min(95, Math.round((attempt / maxAttempts) * 100));
        const statusText = songs[0]?.status === 'processing' ? '创作中' : '排队中';
        onProgress?.(`${statusText}... ${progressPercent}%`, songs);

        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('生成超时，请稍后重试');
};

/**
 * 一站式音乐生成 - 灵感模式
 */
export const createMusic = async (
    params: SunoGenerateParams,
    onProgress?: (progress: string, songs?: SunoSongInfo[]) => void
): Promise<SunoSongInfo[]> => {
    onProgress?.('提交生成任务...');
    const { songIds } = await generateMusic(params);
    onProgress?.('任务已提交，等待生成...');
    return await waitForMusicGeneration(songIds, onProgress);
};

/**
 * 一站式音乐生成 - 自定义模式
 */
export const createMusicCustom = async (
    params: SunoCustomParams,
    onProgress?: (progress: string, songs?: SunoSongInfo[]) => void
): Promise<SunoSongInfo[]> => {
    onProgress?.('提交生成任务...');
    const { songIds } = await generateMusicCustom(params);
    onProgress?.('任务已提交，等待生成...');
    return await waitForMusicGeneration(songIds, onProgress);
};
