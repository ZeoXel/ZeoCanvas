/**
 * Studio 视频生成 API (Veo)
 *
 * 支持模型:
 * - Veo 3.1 系列: veo3.1, veo3.1-pro, veo3.1-components
 * - Veo 3 系列: veo3, veo3-fast, veo3-pro, veo3-pro-frames, veo3-fast-frames
 * - Veo 2 系列: veo2, veo2-fast, veo2-pro, veo2-fast-frames, veo2-fast-components
 */

import { NextRequest, NextResponse } from 'next/server';

// API 配置
const getApiConfig = () => {
    const baseUrl = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.bltcy.ai';
    const apiKey = process.env.OPENAI_API_KEY;
    return { baseUrl, apiKey };
};

// 等待函数
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 查询任务状态
async function queryTask(baseUrl: string, apiKey: string, taskId: string) {
    const response = await fetch(`${baseUrl}/v2/videos/generations/${taskId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {
        throw new Error(`查询任务失败: ${response.status}`);
    }

    return response.json();
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            prompt,
            model,
            aspectRatio,
            enhancePrompt,
            enableUpsample,
            images, // 用于图生视频
        } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        if (!model) {
            return NextResponse.json({ error: 'model is required' }, { status: 400 });
        }

        const { baseUrl, apiKey } = getApiConfig();

        if (!apiKey) {
            return NextResponse.json({ error: 'API Key未配置' }, { status: 500 });
        }

        // 构建请求体
        const requestBody: any = {
            prompt,
            model,
        };

        if (aspectRatio) requestBody.aspect_ratio = aspectRatio;
        if (enhancePrompt !== undefined) requestBody.enhance_prompt = enhancePrompt;
        if (enableUpsample !== undefined) requestBody.enable_upsample = enableUpsample;
        if (images && images.length > 0) requestBody.images = images;

        console.log(`[Studio Video API] Creating task with model: ${model}`);

        // 发起生成请求
        const createResponse = await fetch(`${baseUrl}/v2/videos/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!createResponse.ok) {
            const errorData = await createResponse.json().catch(() => ({ error: 'Unknown error' }));
            console.error('[Studio Video API] Create Error:', errorData);
            return NextResponse.json(
                { error: errorData.error?.message || errorData.error || `API错误: ${createResponse.status}` },
                { status: createResponse.status }
            );
        }

        const createResult = await createResponse.json();
        const taskId = createResult.task_id;

        if (!taskId) {
            return NextResponse.json({ error: '未返回任务ID' }, { status: 500 });
        }

        console.log(`[Studio Video API] Task created: ${taskId}`);

        // 轮询等待结果 (最多等待10分钟)
        const maxAttempts = 120;
        let attempts = 0;

        while (attempts < maxAttempts) {
            await wait(5000); // 每5秒查询一次
            attempts++;

            try {
                const taskResult = await queryTask(baseUrl, apiKey, taskId);

                console.log(`[Studio Video API] Task ${taskId} status: ${taskResult.status}, progress: ${taskResult.progress || 'N/A'}`);

                if (taskResult.status === 'SUCCESS') {
                    if (taskResult.data?.output) {
                        return NextResponse.json({
                            success: true,
                            videoUrl: taskResult.data.output,
                            taskId,
                            status: 'SUCCESS',
                        });
                    }
                    return NextResponse.json({ error: '视频生成成功但未返回URL' }, { status: 500 });
                }

                if (taskResult.status === 'FAILURE') {
                    return NextResponse.json(
                        { error: `视频生成失败: ${taskResult.fail_reason || '未知错误'}` },
                        { status: 500 }
                    );
                }

                // 继续等待 IN_PROGRESS 或 NOT_START 状态
            } catch (queryError: any) {
                console.error(`[Studio Video API] Query error:`, queryError);
                // 继续尝试
            }
        }

        return NextResponse.json(
            { error: '视频生成超时，请稍后重试', taskId },
            { status: 504 }
        );

    } catch (error: any) {
        console.error('[Studio Video API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET 方法用于查询任务状态
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
        return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const { baseUrl, apiKey } = getApiConfig();

    if (!apiKey) {
        return NextResponse.json({ error: 'API Key未配置' }, { status: 500 });
    }

    try {
        const result = await queryTask(baseUrl, apiKey, taskId);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
