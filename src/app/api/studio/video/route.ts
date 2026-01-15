/**
 * Studio 视频生成 API
 *
 * 使用统一的 provider 服务架构
 * 支持模型: Veo, Seedance
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateVideo, getVideoProviderId } from '@/services/providers';
import * as veoService from '@/services/providers/veo';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, model, aspectRatio, duration, enhancePrompt, images, imageRoles, videoConfig, viduSubjects } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }
        if (!model) {
            return NextResponse.json({ error: 'model is required' }, { status: 400 });
        }

        const providerId = getVideoProviderId(model);

        if (!providerId) {
            return NextResponse.json({ error: `不支持的视频模型: ${model}` }, { status: 400 });
        }

        console.log(`[Studio Video API] model: ${model}, provider: ${providerId}, images: ${images?.length || 0}, viduSubjects: ${viduSubjects?.length || 0}`);

        const videoUrl = await generateVideo(
            {
                prompt,
                model,
                aspectRatio,
                duration,
                images,
                imageRoles,
                enhancePrompt,
                videoConfig,  // 厂商扩展配置
                viduSubjects, // Vidu 主体参考
            },
            (progress) => {
                console.log(`[Studio Video API] Progress: ${progress}`);
            }
        );

        return NextResponse.json({
            success: true,
            videoUrl,
            status: 'SUCCESS',
        });

    } catch (error: any) {
        console.error('[Studio Video API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET 方法用于查询任务状态 (仅支持 Veo)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
        return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    try {
        const result = await veoService.queryTask(taskId);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
