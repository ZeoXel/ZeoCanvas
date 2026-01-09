/**
 * MiniMax TTS API 代理路由
 *
 * 文档参考: docs/minimax.md
 *
 * POST - 语音合成
 *   - 同步模式: /minimax/v1/t2a_v2
 *   - 异步模式: /minimax/v1/t2a_async_v2 (query param: mode=async)
 * GET  - 查询异步任务状态
 *   - /minimax/v1/query/t2a_async_query_v2?task_id=xxx
 */

import { NextRequest, NextResponse } from 'next/server';

// API 基础 URL - 使用项目统一配置
const MINIMAX_API_BASE = process.env.MINIMAX_API_BASE || process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.bltcy.ai';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || process.env.OPENAI_API_KEY;

// POST: 语音合成
export async function POST(request: NextRequest) {
    if (!MINIMAX_API_KEY) {
        return NextResponse.json(
            {
                base_resp: {
                    status_code: -1,
                    status_msg: 'MINIMAX_API_KEY 未配置'
                }
            },
            { status: 500 }
        );
    }

    try {
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode'); // 'async' 表示异步模式
        const body = await request.json();

        // 选择 API 端点
        // 同步: /minimax/v1/t2a_v2
        // 异步: /minimax/v1/t2a_async_v2
        const endpoint = mode === 'async'
            ? '/minimax/v1/t2a_async_v2'
            : '/minimax/v1/t2a_v2';

        // 构建请求体
        const requestBody = {
            model: body.model || 'speech-2.6-hd',
            text: body.text,
            stream: body.stream ?? false,
            voice_setting: {
                voice_id: body.voice_setting?.voice_id || 'male-qn-qingse',
                speed: body.voice_setting?.speed ?? 1,
                vol: body.voice_setting?.vol ?? 1,
                pitch: body.voice_setting?.pitch ?? 0,
                ...(body.voice_setting?.emotion && { emotion: body.voice_setting.emotion }),
            },
            audio_setting: {
                sample_rate: body.audio_setting?.sample_rate ?? 32000,
                bitrate: body.audio_setting?.bitrate ?? 128000,
                format: body.audio_setting?.format || 'mp3',
                channel: body.audio_setting?.channel ?? 1,
                // 异步模式使用 audio_sample_rate
                ...(mode === 'async' && { audio_sample_rate: body.audio_setting?.sample_rate ?? 32000 }),
            },
            // 可选参数
            ...(body.voice_modify && { voice_modify: body.voice_modify }),
            ...(body.pronunciation_dict && { pronunciation_dict: body.pronunciation_dict }),
            ...(body.output_format && { output_format: body.output_format }),
            ...(body.subtitle_enable !== undefined && { subtitle_enable: body.subtitle_enable }),
        };

        console.log('[MiniMax API] Request:', endpoint, JSON.stringify(requestBody).substring(0, 500));

        const response = await fetch(`${MINIMAX_API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MINIMAX_API_KEY}`,
            },
            body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();
        console.log('[MiniMax API] Response:', response.status, responseText.substring(0, 500));

        if (!response.ok) {
            return NextResponse.json(
                {
                    base_resp: {
                        status_code: response.status,
                        status_msg: `MiniMax API 错误: ${response.status}`
                    }
                },
                { status: response.status }
            );
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            return NextResponse.json(
                {
                    base_resp: {
                        status_code: -1,
                        status_msg: '无效的响应格式'
                    }
                },
                { status: 500 }
            );
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[MiniMax API] Request Failed:', error);
        return NextResponse.json(
            {
                base_resp: {
                    status_code: -1,
                    status_msg: error.message || '请求失败'
                }
            },
            { status: 500 }
        );
    }
}

// GET: 查询异步任务状态
export async function GET(request: NextRequest) {
    if (!MINIMAX_API_KEY) {
        return NextResponse.json(
            {
                base_resp: {
                    status_code: -1,
                    status_msg: 'MINIMAX_API_KEY 未配置'
                }
            },
            { status: 500 }
        );
    }

    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('task_id');
        const fileId = searchParams.get('file_id');

        // 如果有 file_id，尝试获取文件下载 URL
        if (fileId) {
            // 文件检索接口
            const response = await fetch(
                `${MINIMAX_API_BASE}/minimax/v1/files/retrieve?file_id=${fileId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                    },
                }
            );

            if (!response.ok) {
                return NextResponse.json(
                    {
                        base_resp: {
                            status_code: response.status,
                            status_msg: '文件检索失败'
                        }
                    },
                    { status: response.status }
                );
            }

            const result = await response.json();
            return NextResponse.json(result);
        }

        // 查询任务状态
        if (!taskId) {
            return NextResponse.json(
                {
                    base_resp: {
                        status_code: -1,
                        status_msg: '缺少 task_id 参数'
                    }
                },
                { status: 400 }
            );
        }

        // 查询异步任务状态: /minimax/v1/query/t2a_async_query_v2
        const response = await fetch(
            `${MINIMAX_API_BASE}/minimax/v1/query/t2a_async_query_v2?task_id=${taskId}`,
            {
                headers: {
                    'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                },
            }
        );

        const responseText = await response.text();
        console.log('[MiniMax Query API] Response:', response.status, responseText.substring(0, 500));

        if (!response.ok) {
            return NextResponse.json(
                {
                    base_resp: {
                        status_code: response.status,
                        status_msg: `查询失败: ${response.status}`
                    }
                },
                { status: response.status }
            );
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            return NextResponse.json(
                {
                    base_resp: {
                        status_code: -1,
                        status_msg: '无效的响应格式'
                    }
                },
                { status: 500 }
            );
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[MiniMax Query] Request Failed:', error);
        return NextResponse.json(
            {
                base_resp: {
                    status_code: -1,
                    status_msg: error.message || '查询失败'
                }
            },
            { status: 500 }
        );
    }
}
