/**
 * Suno V2 API 代理路由
 *
 * 文档参考: docs/sunov2.md
 *
 * POST - 提交音乐生成任务
 *   - 灵感模式: { gpt_description_prompt: "描述" }
 *   - 自定义模式: { title, tags, prompt, mv, ... }
 * GET  - 查询歌曲状态 (ids=clip1,clip2)
 */

import { NextRequest, NextResponse } from 'next/server';

// API 基础 URL - 使用项目统一配置
const SUNO_API_BASE = process.env.SUNO_API_BASE || process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.bltcy.ai';
const SUNO_API_KEY = process.env.SUNO_API_KEY || process.env.OPENAI_API_KEY;

// POST: 提交生成任务
export async function POST(request: NextRequest) {
    if (!SUNO_API_KEY) {
        return NextResponse.json(
            { code: -1, message: 'SUNO_API_KEY 未配置' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { mode, ...params } = body;

        // 根据模式选择 API 端点
        // 灵感模式: /suno/generate
        // 自定义模式: /suno/submit/music
        let endpoint: string;
        let requestBody: any;

        if (mode === 'inspiration' || params.gpt_description_prompt) {
            // 灵感模式
            endpoint = '/suno/generate';
            requestBody = {
                gpt_description_prompt: params.prompt || params.gpt_description_prompt,
                make_instrumental: params.make_instrumental || false,
                mv: params.mv || 'chirp-v4',
            };
        } else {
            // 自定义模式
            endpoint = '/suno/submit/music';
            requestBody = {
                title: params.title || '',
                tags: params.tags || '',
                prompt: params.prompt || '',
                negative_tags: params.negative_tags || '',
                mv: params.mv || 'chirp-v4',
                make_instrumental: params.make_instrumental || false,
                generation_type: params.generation_type || 'TEXT',
                // 续写相关参数
                ...(params.continue_clip_id && { continue_clip_id: params.continue_clip_id }),
                ...(params.continue_at !== undefined && { continue_at: params.continue_at }),
                ...(params.task && { task: params.task }),
                ...(params.task_id && { task_id: params.task_id }),
            };
        }

        console.log('[Suno API] Request:', endpoint, requestBody);

        const response = await fetch(`${SUNO_API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUNO_API_KEY}`,
                'Accept': '*/*',
            },
            body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();
        console.log('[Suno API] Response:', response.status, responseText);

        if (!response.ok) {
            return NextResponse.json(
                { code: -1, message: `Suno API 错误: ${response.status} - ${responseText}` },
                { status: response.status }
            );
        }

        // 解析响应
        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            return NextResponse.json(
                { code: -1, message: `无效的响应: ${responseText}` },
                { status: 500 }
            );
        }

        // 标准化响应格式
        // API 返回格式: { code: "success", data: "task_id", message: "" }
        // 前端期望格式: { code: 0, data: { song_id: "xxx" } }

        if (result.code === 'success' || result.code === 0) {
            // data 可能是字符串(任务ID)或对象
            const taskId = typeof result.data === 'string' ? result.data : result.data?.song_id || result.data?.task_id;

            return NextResponse.json({
                code: 0,
                data: {
                    song_id: taskId,
                    // 如果有第二个 song_id
                    ...(result.data?.song_id_2 && { song_id_2: result.data.song_id_2 }),
                },
            });
        }

        // 返回错误
        return NextResponse.json({
            code: -1,
            message: result.message || '生成失败',
        }, { status: 400 });
    } catch (error: any) {
        console.error('[Suno API] Request Failed:', error);
        return NextResponse.json(
            { code: -1, message: error.message || '请求失败' },
            { status: 500 }
        );
    }
}

// GET: 查询歌曲状态
export async function GET(request: NextRequest) {
    if (!SUNO_API_KEY) {
        return NextResponse.json(
            { code: -1, message: 'SUNO_API_KEY 未配置' },
            { status: 500 }
        );
    }

    try {
        const { searchParams } = new URL(request.url);
        const ids = searchParams.get('ids');

        if (!ids) {
            return NextResponse.json(
                { code: -1, message: '缺少 ids 参数' },
                { status: 400 }
            );
        }

        // 尝试多种查询端点格式
        // 格式1: /suno/feed/{ids} (文档标准)
        // 格式2: /suno/fetch/{ids} (备选)
        // 格式3: /suno/{ids} (简化)

        let feedUrl = `${SUNO_API_BASE}/suno/fetch/${ids}`;
        console.log('[Suno Feed API] Trying URL:', feedUrl);

        let response = await fetch(feedUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SUNO_API_KEY}`,
                'Accept': '*/*',
            },
        });

        // 如果 /fetch 失败，尝试 /feed
        if (!response.ok) {
            const errorText = await response.text();
            console.log('[Suno Feed API] /fetch failed:', response.status, errorText);

            feedUrl = `${SUNO_API_BASE}/suno/feed/${ids}`;
            console.log('[Suno Feed API] Trying fallback URL:', feedUrl);

            response = await fetch(feedUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${SUNO_API_KEY}`,
                    'Accept': '*/*',
                },
            });
        }

        const responseText = await response.text();
        console.log('[Suno Feed API] Response:', response.status, responseText.substring(0, 1000));

        if (!response.ok) {
            return NextResponse.json(
                { code: -1, message: `查询失败: ${response.status} - ${responseText}` },
                { status: response.status }
            );
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error('[Suno Feed API] JSON Parse Error:', e);
            return NextResponse.json(
                { code: -1, message: `无效的响应: ${responseText.substring(0, 200)}` },
                { status: 500 }
            );
        }

        console.log('[Suno Feed API] Parsed Result:', JSON.stringify(result).substring(0, 500));

        // API 返回格式 (根据 docs/suno查询.md):
        // {
        //   code: "success",
        //   data: {
        //     task_id: "xxx",
        //     status: "NOT_START" | "PROCESSING" | "SUCCESS" | "FAILURE",
        //     progress: "0%",
        //     fail_reason: "",
        //     data: [...] // 歌曲数组，任务完成时有数据
        //   }
        // }

        const taskData = result.data;
        const taskStatus = taskData?.status;
        const songsList = taskData?.data; // 嵌套的 data 是歌曲数组

        console.log('[Suno Feed API] Task status:', taskStatus, 'Songs:', songsList?.length || 0);

        // 如果任务还未完成，返回任务状态
        if (!songsList || songsList.length === 0) {
            // 映射任务状态到前端状态
            const mappedStatus = mapTaskStatus(taskStatus);

            return NextResponse.json({
                code: 0,
                data: [{
                    id: taskData?.task_id || ids,
                    title: '',
                    status: mappedStatus,
                    progress: taskData?.progress,
                    error_message: taskData?.fail_reason,
                }],
            });
        }

        // 任务完成，返回歌曲信息
        return NextResponse.json({
            code: 0,
            data: songsList.map((song: any) => ({
                id: song.id || song.clip_id,
                title: song.title || '',
                status: mapSunoStatus(song.status),
                audio_url: song.audio_url,
                image_url: song.image_url || song.image_large_url,
                video_url: song.video_url,
                duration: song.metadata?.duration || song.duration,
                error_message: song.metadata?.error_message,
                metadata: {
                    tags: song.metadata?.tags,
                    prompt: song.metadata?.prompt,
                },
            })),
        });
    } catch (error: any) {
        console.error('[Suno Feed] Request Failed:', error);
        return NextResponse.json(
            { code: -1, message: error.message || '查询失败' },
            { status: 500 }
        );
    }
}

// 映射任务状态 (NOT_START, PROCESSING, SUCCESS, FAILURE)
function mapTaskStatus(status: string): 'pending' | 'processing' | 'complete' | 'error' {
    const statusMap: Record<string, 'pending' | 'processing' | 'complete' | 'error'> = {
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
    return statusMap[status?.toUpperCase()] || 'processing';
}

// 映射 Suno 歌曲状态到标准状态
function mapSunoStatus(status: string): 'pending' | 'processing' | 'complete' | 'error' {
    const statusMap: Record<string, 'pending' | 'processing' | 'complete' | 'error'> = {
        'submitted': 'pending',
        'queued': 'pending',
        'streaming': 'processing',
        'processing': 'processing',
        'complete': 'complete',
        'completed': 'complete',
        'error': 'error',
        'failed': 'error',
    };
    return statusMap[status?.toLowerCase()] || 'processing';
}
