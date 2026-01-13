/**
 * Studio 视频生成 API
 *
 * 支持模型:
 * - Seedance 系列 (火山引擎): doubao-seedance-1-5-pro, doubao-seedance-1-0-pro, etc.
 * - Veo 3.1 系列: veo3.1, veo3.1-pro, veo3.1-components
 * - Veo 3 系列: veo3, veo3-fast, veo3-pro, veo3-pro-frames, veo3-fast-frames
 * - Veo 2 系列: veo2, veo2-fast, veo2-pro, veo2-fast-frames, veo2-fast-components
 */

import { NextRequest, NextResponse } from 'next/server';

// OpenAI 兼容 API 配置 (Veo)
const getOpenAIConfig = () => {
    const baseUrl = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.bltcy.ai';
    const apiKey = process.env.OPENAI_API_KEY;
    return { baseUrl, apiKey };
};

// 火山引擎 API 配置 (Seedance)
const getVolcengineConfig = () => {
    const baseUrl = 'https://ark.cn-beijing.volces.com/api/v3';
    const apiKey = process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY;
    return { baseUrl, apiKey };
};

// 判断模型提供商
const getModelProvider = (model: string): 'seedance' | 'veo' => {
    if (model.includes('seedance')) return 'seedance';
    return 'veo';
};

// 等待函数
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 查询 Veo 任务状态
async function queryVeoTask(baseUrl: string, apiKey: string, taskId: string) {
    const response = await fetch(`${baseUrl}/v2/videos/generations/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(`查询任务失败: ${response.status}`);
    return response.json();
}

// 查询 Seedance 任务状态
async function querySeedanceTask(baseUrl: string, apiKey: string, taskId: string) {
    const response = await fetch(`${baseUrl}/contents/generations/tasks/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(`查询任务失败: ${response.status}`);
    return response.json();
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, model, aspectRatio, duration, enhancePrompt, enableUpsample, images, imageRoles } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }
        if (!model) {
            return NextResponse.json({ error: 'model is required' }, { status: 400 });
        }

        const modelType = getModelProvider(model);
        const { baseUrl, apiKey } = modelType === 'seedance' ? getVolcengineConfig() : getOpenAIConfig();

        if (!apiKey) {
            return NextResponse.json({ error: `API Key未配置 (${modelType})` }, { status: 500 });
        }

        console.log(`[Studio Video API] Creating task with model: ${model}, type: ${modelType}, images: ${images?.length || 0}, imageRoles: ${JSON.stringify(imageRoles)}`);

        // ============ Seedance API (火山引擎) ============
        if (modelType === 'seedance') {
            // Seedance: 将 duration 追加到提示词 (--dur X)
            let finalPrompt = prompt;
            if (duration && duration > 0) {
                finalPrompt = `${prompt} --dur ${duration}`;
            }

            // 构建 Seedance 请求体
            const content: any[] = [{ type: 'text', text: finalPrompt }];

            // 如果有图片，添加图片内容 (支持首尾帧 role)
            if (images && images.length > 0) {
                images.forEach((img: string, index: number) => {
                    const imageContent: any = {
                        type: 'image_url',
                        image_url: { url: img }
                    };
                    // 添加 role 字段（用于首尾帧：first_frame / last_frame）
                    if (imageRoles && imageRoles[index]) {
                        imageContent.role = imageRoles[index];
                    }
                    content.push(imageContent);
                });
            }

            const seedanceBody: any = { model, content };

            const createResponse = await fetch(`${baseUrl}/contents/generations/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(seedanceBody),
            });

            if (!createResponse.ok) {
                const errorData = await createResponse.json().catch(() => ({}));
                console.error('[Seedance] Create Error:', errorData);
                return NextResponse.json(
                    { error: errorData.error?.message || `API错误: ${createResponse.status}` },
                    { status: createResponse.status }
                );
            }

            const createResult = await createResponse.json();
            const taskId = createResult.id;

            if (!taskId) {
                return NextResponse.json({ error: '未返回任务ID' }, { status: 500 });
            }

            console.log(`[Seedance] Task created: ${taskId}`);

            // 轮询等待结果 (最多10分钟)
            const maxAttempts = 120;
            for (let i = 0; i < maxAttempts; i++) {
                await wait(5000);
                try {
                    const taskResult = await querySeedanceTask(baseUrl, apiKey, taskId);
                    console.log(`[Seedance] Task ${taskId} status: ${taskResult.status}`);

                    if (taskResult.status === 'succeeded') {
                        // Seedance 返回格式: content.video_url
                        const videoUrl = taskResult.content?.video_url;
                        if (videoUrl) {
                            return NextResponse.json({ success: true, videoUrl, taskId, status: 'SUCCESS' });
                        }
                        return NextResponse.json({ error: '视频生成成功但未返回URL' }, { status: 500 });
                    }

                    if (taskResult.status === 'failed') {
                        return NextResponse.json(
                            { error: `视频生成失败: ${taskResult.error?.message || '未知错误'}` },
                            { status: 500 }
                        );
                    }
                } catch (queryErr) {
                    console.error('[Seedance] Query error:', queryErr);
                }
            }

            return NextResponse.json({ error: '视频生成超时', taskId }, { status: 504 });
        }

        // ============ Veo API (OpenAI兼容) ============
        const requestBody: any = { prompt, model };
        if (aspectRatio) requestBody.aspect_ratio = aspectRatio;
        if (enhancePrompt !== undefined) requestBody.enhance_prompt = enhancePrompt;
        if (enableUpsample !== undefined) requestBody.enable_upsample = enableUpsample;
        if (images && images.length > 0) requestBody.images = images;

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
                const taskResult = await queryVeoTask(baseUrl, apiKey, taskId);

                console.log(`[Veo] Task ${taskId} status: ${taskResult.status}, progress: ${taskResult.progress || 'N/A'}`);

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

    // 默认使用 Veo API 配置（OpenAI 兼容）
    const { baseUrl, apiKey } = getOpenAIConfig();

    if (!apiKey) {
        return NextResponse.json({ error: 'API Key未配置 (veo)' }, { status: 500 });
    }

    try {
        const result = await queryVeoTask(baseUrl, apiKey, taskId);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
