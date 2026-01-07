/**
 * MiniMax API 服务 - TTS 语音合成
 *
 * 接口文档: ./docs/接入文档/minimax.md
 *
 * 特性:
 * - 同步和异步两种模式
 * - 丰富的声音控制：音色、语速、音量、语调、情感
 * - 声音效果器：音高、强度、音色调节、音效
 * - 多种输出格式：mp3, wav, pcm, flac
 */

export interface MinimaxVoiceSetting {
    voice_id: string;           // 音色编号
    speed?: number;             // 语速 [0.5, 2]，默认 1.0
    vol?: number;               // 音量 (0, 10]，默认 1.0
    pitch?: number;             // 语调 [-12, 12]，默认 0
    emotion?: MinimaxEmotion;   // 情感
}

export interface MinimaxVoiceModify {
    pitch?: number;             // 音高 [-100, 100]，负值低沉，正值明亮
    intensity?: number;         // 强度 [-100, 100]，负值刚劲，正值轻柔
    timbre?: number;            // 音色 [-100, 100]，负值浑厚，正值清脆
    sound_effects?: MinimaxSoundEffect;  // 音效
}

export interface MinimaxAudioSetting {
    sample_rate?: number;       // 采样率 [8000, 16000, 22050, 24000, 32000, 44100]
    bitrate?: number;           // 比特率 [32000, 64000, 128000, 256000]
    format?: 'mp3' | 'wav' | 'pcm' | 'flac';
    channel?: 1 | 2;            // 声道数
}

export type MinimaxEmotion = 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm' | 'fluent';
export type MinimaxSoundEffect = 'spacious_echo' | 'auditorium_echo' | 'lofi_telephone' | 'robotic';
export type MinimaxModel = 'speech-2.6-hd' | 'speech-2.6-turbo' | 'speech-02-hd' | 'speech-02-turbo' | 'speech-01-hd' | 'speech-01-turbo';

export interface MinimaxGenerateParams {
    model?: MinimaxModel;
    text: string;
    stream?: boolean;
    voice_setting: MinimaxVoiceSetting;
    voice_modify?: MinimaxVoiceModify;
    audio_setting?: MinimaxAudioSetting;
    output_format?: 'url' | 'hex';
}

export interface MinimaxSyncResponse {
    data?: {
        audio: string;          // hex 编码的音频数据 或 URL
        status: number;         // 1: 合成中, 2: 合成结束
    };
    extra_info?: {
        audio_length: number;   // 音频时长（毫秒）
        audio_size: number;     // 文件大小（字节）
        word_count: number;     // 字数
    };
    base_resp: {
        status_code: number;
        status_msg: string;
    };
}

export interface MinimaxAsyncResponse {
    task_id: number;
    file_id: number;
    base_resp: {
        status_code: number;
        status_msg: string;
    };
}

export interface MinimaxTaskStatus {
    task_id: number;
    status: 'Processing' | 'Success' | 'Failed' | 'Expired';
    file_id?: number;
    base_resp: {
        status_code: number;
        status_msg: string;
    };
}

/**
 * 同步语音合成（适合短文本，<5000字）
 */
export const synthesizeSpeechSync = async (params: MinimaxGenerateParams): Promise<string> => {
    const response = await fetch('/api/audio/minimax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: params.model || 'speech-2.6-hd',
            text: params.text,
            stream: false,
            voice_setting: params.voice_setting,
            voice_modify: params.voice_modify,
            audio_setting: params.audio_setting || {
                sample_rate: 32000,
                bitrate: 128000,
                format: 'mp3',
                channel: 1,
            },
            output_format: 'url',  // 直接返回 URL
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`MiniMax API 错误: ${error}`);
    }

    const result: MinimaxSyncResponse = await response.json();

    if (result.base_resp.status_code !== 0) {
        throw new Error(result.base_resp.status_msg || '语音合成失败');
    }

    if (!result.data?.audio) {
        throw new Error('未返回音频数据');
    }

    // 如果是 hex 格式，转换为 base64 data URL
    if (!result.data.audio.startsWith('http')) {
        const audioBytes = hexToBytes(result.data.audio);
        const base64 = bytesToBase64(audioBytes);
        const format = params.audio_setting?.format || 'mp3';
        return `data:audio/${format};base64,${base64}`;
    }

    return result.data.audio;
};

/**
 * 异步语音合成（适合长文本，最长5万字）
 */
export const synthesizeSpeechAsync = async (params: MinimaxGenerateParams): Promise<{ taskId: number; fileId: number }> => {
    const response = await fetch('/api/audio/minimax?mode=async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: params.model || 'speech-2.6-hd',
            text: params.text,
            voice_setting: params.voice_setting,
            voice_modify: params.voice_modify,
            audio_setting: params.audio_setting || {
                audio_sample_rate: 32000,
                bitrate: 128000,
                format: 'mp3',
                channel: 1,
            },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`MiniMax API 错误: ${error}`);
    }

    const result: MinimaxAsyncResponse = await response.json();

    if (result.base_resp.status_code !== 0) {
        throw new Error(result.base_resp.status_msg || '创建任务失败');
    }

    return { taskId: result.task_id, fileId: result.file_id };
};

/**
 * 查询异步任务状态
 */
export const queryAsyncTaskStatus = async (taskId: number): Promise<MinimaxTaskStatus> => {
    const response = await fetch(`/api/audio/minimax?task_id=${taskId}`);

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`查询失败: ${error}`);
    }

    return await response.json();
};

/**
 * 轮询等待异步任务完成
 */
export const waitForAsyncSynthesis = async (
    taskId: number,
    fileId: number,
    onProgress?: (progress: string) => void,
    maxAttempts: number = 60,
    interval: number = 2000
): Promise<string> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const status = await queryAsyncTaskStatus(taskId);

        if (status.status === 'Success') {
            onProgress?.('合成完成!');
            // 返回文件下载 URL
            return `/api/audio/minimax/download?file_id=${fileId}`;
        }

        if (status.status === 'Failed') {
            throw new Error(status.base_resp.status_msg || '合成失败');
        }

        if (status.status === 'Expired') {
            throw new Error('任务已过期');
        }

        const progressPercent = Math.min(95, Math.round((attempt / maxAttempts) * 100));
        onProgress?.(`合成中... ${progressPercent}%`);

        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('合成超时');
};

/**
 * 智能语音合成（根据文本长度自动选择同步/异步）
 */
export const synthesizeSpeech = async (
    params: MinimaxGenerateParams,
    onProgress?: (progress: string) => void
): Promise<string> => {
    const textLength = params.text.length;

    // 短文本使用同步接口
    if (textLength <= 3000) {
        onProgress?.('正在合成语音...');
        return await synthesizeSpeechSync(params);
    }

    // 长文本使用异步接口
    onProgress?.('提交合成任务...');
    const { taskId, fileId } = await synthesizeSpeechAsync(params);
    return await waitForAsyncSynthesis(taskId, fileId, onProgress);
};

// 工具函数：hex 转 bytes
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// 工具函数：bytes 转 base64
function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// 预设音色列表
export const VOICE_PRESETS = [
    { id: 'male-qn-qingse', label: '青涩青年', gender: 'male', desc: '年轻男声，清新自然' },
    { id: 'male-qn-jingying', label: '精英青年', gender: 'male', desc: '成熟男声，专业稳重' },
    { id: 'male-qn-badao', label: '霸道青年', gender: 'male', desc: '低沉男声，有力量感' },
    { id: 'male-qn-daxuesheng', label: '大学生', gender: 'male', desc: '阳光男声，活力四射' },
    { id: 'female-shaonv', label: '少女', gender: 'female', desc: '甜美女声，青春活泼' },
    { id: 'female-yujie', label: '御姐', gender: 'female', desc: '成熟女声，知性优雅' },
    { id: 'female-chengshu', label: '成熟女性', gender: 'female', desc: '温婉女声，亲切自然' },
    { id: 'female-tianmei', label: '甜美女声', gender: 'female', desc: '软糯女声，可爱治愈' },
    { id: 'presenter_male', label: '男主持', gender: 'male', desc: '播音腔，专业标准' },
    { id: 'presenter_female', label: '女主持', gender: 'female', desc: '播音腔，专业标准' },
    { id: 'audiobook_male_1', label: '有声书男1', gender: 'male', desc: '叙述感强，适合朗读' },
    { id: 'audiobook_male_2', label: '有声书男2', gender: 'male', desc: '磁性男声，深沉稳重' },
    { id: 'audiobook_female_1', label: '有声书女1', gender: 'female', desc: '温柔女声，娓娓道来' },
    { id: 'audiobook_female_2', label: '有声书女2', gender: 'female', desc: '知性女声，清晰流畅' },
];

// 情感预设
export const EMOTION_PRESETS: { label: string; value: MinimaxEmotion; desc: string }[] = [
    { label: '中性', value: 'calm', desc: '平和自然的语调' },
    { label: '开心', value: 'happy', desc: '愉快欢乐的语气' },
    { label: '悲伤', value: 'sad', desc: '低落忧伤的语气' },
    { label: '愤怒', value: 'angry', desc: '激动愤怒的语气' },
    { label: '恐惧', value: 'fearful', desc: '害怕紧张的语气' },
    { label: '厌恶', value: 'disgusted', desc: '厌恶反感的语气' },
    { label: '惊讶', value: 'surprised', desc: '惊讶意外的语气' },
    { label: '生动', value: 'fluent', desc: '富有感染力的表达' },
];

// 音效预设
export const SOUND_EFFECT_PRESETS: { label: string; value: MinimaxSoundEffect | ''; desc: string }[] = [
    { label: '无音效', value: '', desc: '原始音质' },
    { label: '空旷回音', value: 'spacious_echo', desc: '空旷房间的回音效果' },
    { label: '礼堂广播', value: 'auditorium_echo', desc: '大厅广播的声音效果' },
    { label: '电话音质', value: 'lofi_telephone', desc: '老式电话的失真效果' },
    { label: '电音效果', value: 'robotic', desc: '机器人/电子音效果' },
];
