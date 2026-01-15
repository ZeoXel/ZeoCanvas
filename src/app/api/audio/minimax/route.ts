/**
 * MiniMax TTS API 路由
 *
 * 使用统一的 provider 服务架构
 * 支持模型: speech-2.6-hd
 *
 * POST - 语音合成 (同步/异步)
 * GET  - 查询异步任务状态
 */

import { NextRequest, NextResponse } from 'next/server';
import * as minimaxService from '@/services/providers/minimax';

// POST: 语音合成
export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode'); // 'async' 表示异步模式
        const body = await request.json();

        console.log(`[MiniMax API] Mode: ${mode || 'sync'}, Text length: ${body.text?.length}`);

        if (mode === 'async') {
            // 异步模式 - 返回任务ID
            const taskId = await minimaxService.createAsyncTask({
                text: body.text,
                model: body.model,
                voice_setting: body.voice_setting,
                audio_setting: body.audio_setting,
            });

            return NextResponse.json({
                base_resp: { status_code: 0, status_msg: 'success' },
                task_id: taskId,
            });
        }

        // 同步模式 - 直接返回音频
        const result = await minimaxService.synthesize({
            text: body.text,
            model: body.model,
            stream: body.stream,
            voice_setting: body.voice_setting,
            audio_setting: body.audio_setting,
        });

        return NextResponse.json({
            base_resp: { status_code: 0, status_msg: 'success' },
            audio_file: result.audio_url,
            data: {
                audio: result.audio_data,
                duration: result.duration,
            },
        });

    } catch (error: any) {
        console.error('[MiniMax API] Error:', error);
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
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('task_id');
        const fileId = searchParams.get('file_id');

        // 获取文件信息
        if (fileId) {
            const fileInfo = await minimaxService.getFileInfo(fileId);
            return NextResponse.json({
                base_resp: { status_code: 0, status_msg: 'success' },
                file: { download_url: fileInfo.url },
            });
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

        const result = await minimaxService.queryTask(taskId);

        return NextResponse.json({
            base_resp: { status_code: 0, status_msg: 'success' },
            status: result.status === 'success' ? 2 : result.status === 'failed' ? 3 : 1,
            file_id: result.file_id,
            audio_file: result.audio_url,
        });

    } catch (error: any) {
        console.error('[MiniMax Query] Error:', error);
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
