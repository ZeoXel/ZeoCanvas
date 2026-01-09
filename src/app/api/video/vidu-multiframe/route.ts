/**
 * Vidu 智能多帧 API 代理路由
 *
 * 文档参考:
 *   - docs/vidu智能多帧.md
 *   - docs/vidu查询生成结果.md
 *
 * POST - 提交智能多帧视频生成任务
 * GET  - 查询任务状态和生成结果
 */

import { NextRequest, NextResponse } from 'next/server';

// Route Segment Config - 增加请求体大小限制和超时时间
export const maxDuration = 300; // 5 分钟超时
export const dynamic = 'force-dynamic';

// Vidu API 配置
const VIDU_API_BASE = process.env.VIDU_API_BASE || 'https://api.vidu.cn';
const VIDU_API_KEY = process.env.VIDU_API_KEY || process.env.OPENAI_API_KEY;

// 等待函数
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 查询生成物接口 - GET /ent/v2/tasks/{id}/creations
// 严格按照 docs/vidu查询生成结果.md 官方文档
async function queryViduTask(taskId: string) {
    const url = `${VIDU_API_BASE}/ent/v2/tasks/${taskId}/creations`;
    console.log(`[Vidu Query] URL: ${url}`);
    console.log(`[Vidu Query] API Base: ${VIDU_API_BASE}`);

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Token ${VIDU_API_KEY}`,
        },
    });

    const responseText = await response.text();
    console.log(`[Vidu Query] Response: ${response.status} - ${responseText.substring(0, 200)}`);

    if (!response.ok) {
        throw new Error(`查询任务失败: ${response.status} - ${responseText}`);
    }

    return JSON.parse(responseText);
}

// POST: 提交智能多帧视频生成任务
export async function POST(request: NextRequest) {
    if (!VIDU_API_KEY) {
        return NextResponse.json(
            { error: 'VIDU_API_KEY 未配置' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const {
            model = 'viduq2-turbo',
            start_image,
            image_settings,
            resolution = '720p',
            watermark = false,
            wm_url,
            wm_position,
            meta_data,
            payload,
            callback_url,
        } = body;

        // 验证必填参数
        if (!start_image) {
            return NextResponse.json(
                { error: '缺少必填参数: start_image (首帧图像)' },
                { status: 400 }
            );
        }

        if (!image_settings || !Array.isArray(image_settings) || image_settings.length < 1) {
            return NextResponse.json(
                { error: '缺少必填参数: image_settings (关键帧配置，至少需要1个)' },
                { status: 400 }
            );
        }

        if (image_settings.length > 9) {
            return NextResponse.json(
                { error: 'image_settings 最多支持9个关键帧' },
                { status: 400 }
            );
        }

        // 构建请求体
        const requestBody: any = {
            model,
            start_image,
            image_settings: image_settings.map((setting: any) => ({
                key_image: setting.key_image,
                ...(setting.prompt && { prompt: setting.prompt }),
                ...(setting.duration && { duration: setting.duration }),
            })),
            resolution,
            watermark,
        };

        // 可选参数
        if (wm_url) requestBody.wm_url = wm_url;
        if (wm_position) requestBody.wm_position = wm_position;
        if (meta_data) requestBody.meta_data = meta_data;
        if (payload) requestBody.payload = payload;
        if (callback_url) requestBody.callback_url = callback_url;

        console.log('[Vidu MultiFrame] Creating task:', JSON.stringify(requestBody).substring(0, 500));

        // 创建任务
        const createResponse = await fetch(`${VIDU_API_BASE}/ent/v2/multiframe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${VIDU_API_KEY}`,
            },
            body: JSON.stringify(requestBody),
        });

        const responseText = await createResponse.text();
        console.log('[Vidu MultiFrame] Response:', createResponse.status, responseText.substring(0, 500));

        if (!createResponse.ok) {
            return NextResponse.json(
                { error: `Vidu API 错误: ${createResponse.status} - ${responseText}` },
                { status: createResponse.status }
            );
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            return NextResponse.json(
                { error: '无效的响应格式' },
                { status: 500 }
            );
        }

        const taskId = result.task_id;
        if (!taskId) {
            return NextResponse.json(
                { error: '未返回任务ID', data: result },
                { status: 500 }
            );
        }

        console.log(`[Vidu MultiFrame] Task created: ${taskId}, state: ${result.state}`);

        // 如果有 callback_url，直接返回任务信息
        if (callback_url) {
            return NextResponse.json({
                success: true,
                taskId,
                state: result.state,
                credits: result.credits,
                message: '任务已提交，结果将通过回调返回',
            });
        }

        // 轮询等待结果 (最多等待15分钟)
        const maxAttempts = 180;
        for (let i = 0; i < maxAttempts; i++) {
            await wait(5000); // 每5秒查询一次

            try {
                const taskResult = await queryViduTask(taskId);
                console.log(`[Vidu MultiFrame] Task ${taskId} state: ${taskResult.state}`);

                if (taskResult.state === 'success') {
                    // 视频生成成功 - 从 creations 数组获取视频URL
                    const creation = taskResult.creations?.[0];
                    const videoUrl = creation?.url;
                    const coverUrl = creation?.cover_url;
                    const watermarkedUrl = creation?.watermarked_url;

                    if (videoUrl) {
                        return NextResponse.json({
                            success: true,
                            videoUrl,
                            coverUrl,
                            watermarkedUrl,
                            taskId,
                            state: 'success',
                            credits: taskResult.credits,
                            creationId: creation?.id,
                        });
                    }
                    return NextResponse.json({
                        success: true,
                        taskId,
                        state: 'success',
                        data: taskResult,
                    });
                }

                if (taskResult.state === 'failed') {
                    return NextResponse.json(
                        { error: `视频生成失败: ${taskResult.err_code || '未知错误'}`, taskId },
                        { status: 500 }
                    );
                }

                // 继续等待: created, queueing, processing
            } catch (queryError: any) {
                console.error('[Vidu MultiFrame] Query error:', queryError.message);
                // 继续尝试
            }
        }

        return NextResponse.json(
            { error: '视频生成超时，请稍后查询任务状态', taskId },
            { status: 504 }
        );

    } catch (error: any) {
        console.error('[Vidu MultiFrame] Error:', error);
        return NextResponse.json(
            { error: error.message || '请求失败' },
            { status: 500 }
        );
    }
}

// GET: 查询任务状态和生成结果
export async function GET(request: NextRequest) {
    if (!VIDU_API_KEY) {
        return NextResponse.json(
            { error: 'VIDU_API_KEY 未配置' },
            { status: 500 }
        );
    }

    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('task_id');

        if (!taskId) {
            return NextResponse.json(
                { error: '缺少 task_id 参数' },
                { status: 400 }
            );
        }

        // 使用 /creations 端点查询生成结果
        const result = await queryViduTask(taskId);

        // 提取生成物信息
        const creation = result.creations?.[0];

        // 标准化响应
        return NextResponse.json({
            taskId: result.id,
            state: result.state,
            videoUrl: creation?.url,
            coverUrl: creation?.cover_url,
            watermarkedUrl: creation?.watermarked_url,
            creationId: creation?.id,
            credits: result.credits,
            error: result.state === 'failed' ? result.err_code : undefined,
            raw: result,
        });

    } catch (error: any) {
        console.error('[Vidu MultiFrame Query] Error:', error);
        return NextResponse.json(
            { error: error.message || '查询失败' },
            { status: 500 }
        );
    }
}
