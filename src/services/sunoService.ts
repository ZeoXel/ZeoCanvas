/**
 * Suno API 服务 - AI 音乐生成
 *
 * 支持两种模式:
 * - 灵感模式：只需提供描述，AI 自动生成歌词和风格
 * - 自定义模式：完全控制标题、风格标签、歌词等
 *
 * 异步生成，需要轮询查询结果
 */

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
 */
export const generateMusic = async (params: SunoGenerateParams): Promise<{ songIds: string[] }> => {
    const response = await fetch('/api/audio/suno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'inspiration',
            prompt: params.prompt,
            make_instrumental: params.make_instrumental || false,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Suno API 错误: ${error}`);
    }

    const result: SunoGenerateResponse = await response.json();

    if (result.code !== 0 || !result.data) {
        throw new Error(result.message || '生成失败');
    }

    const songIds = [result.data.song_id];
    if (result.data.song_id_2) {
        songIds.push(result.data.song_id_2);
    }

    return { songIds };
};

/**
 * 提交音乐生成任务（自定义模式）
 */
export const generateMusicCustom = async (params: SunoCustomParams): Promise<{ songIds: string[] }> => {
    const response = await fetch('/api/audio/suno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'custom',
            title: params.title,
            tags: params.tags,
            negative_tags: params.negative_tags,
            prompt: params.prompt,
            mv: params.mv || 'chirp-v4',
            make_instrumental: params.make_instrumental || false,
            generation_type: params.generation_type || 'TEXT',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Suno API 错误: ${error}`);
    }

    const result: SunoGenerateResponse = await response.json();

    if (result.code !== 0 || !result.data) {
        throw new Error(result.message || '生成失败');
    }

    const songIds = [result.data.song_id];
    if (result.data.song_id_2) {
        songIds.push(result.data.song_id_2);
    }

    return { songIds };
};

// ============ 通用 API ============

/**
 * 查询歌曲生成状态
 */
export const querySongStatus = async (songIds: string[]): Promise<SunoSongInfo[]> => {
    const idsParam = songIds.join(',');
    const response = await fetch(`/api/audio/suno?ids=${encodeURIComponent(idsParam)}`);

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`查询失败: ${error}`);
    }

    const result: SunoFeedResponse = await response.json();

    if (result.code !== 0 || !result.data) {
        throw new Error(result.message || '查询失败');
    }

    return result.data;
};

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
