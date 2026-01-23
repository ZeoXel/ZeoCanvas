/**
 * Studio 视频生成 API
 *
 * 使用统一的 provider 服务架构
 * 支持模型: Veo, Seedance, Vidu
 *
 * 异步模式：立即返回 taskId，前端轮询查询结果
 * 这样可以避免长时间的 HTTP 请求导致连接超时 (ERR_CONNECTION_CLOSED)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVideoProviderId } from '@/services/providers';
import * as veoService from '@/services/providers/veo';
import * as seedanceService from '@/services/providers/seedance';
import * as viduService from '@/services/providers/vidu';

// Route Segment Config - 设置合理的超时时间
export const maxDuration = 60; // 60 秒超时 (只用于创建任务)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, model, aspectRatio, duration, enhancePrompt, images, imageRoles, videoConfig, viduSubjects } = body;

        console.log(`[Studio Video API] Received request:`, {
            model,
            aspectRatio,
            duration,
            imagesCount: images?.length || 0,
            imageRoles,
            videoConfig,
            viduSubjectsCount: viduSubjects?.length || 0
        });

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

        // 异步模式：只创建任务，立即返回 taskId
        let taskId: string;
        const config = videoConfig || {};

        switch (providerId) {
            case 'veo': {
                taskId = await veoService.createTask({
                    prompt,
                    model: model as any,
                    aspectRatio: aspectRatio as any,
                    duration,
                    images,
                    enhancePrompt: config.enhance_prompt ?? enhancePrompt,
                });
                break;
            }

            case 'seedance': {
                taskId = await seedanceService.createTask({
                    prompt,
                    model,
                    duration,
                    aspectRatio,
                    images,
                    imageRoles,
                    return_last_frame: config.return_last_frame,
                    generate_audio: config.generate_audio,
                    camera_fixed: config.camera_fixed,
                    watermark: config.watermark,
                    service_tier: config.service_tier,
                    seed: config.seed,
                });
                break;
            }

            case 'vidu': {
                // 根据输入参数自动判断生成模式
                let mode: viduService.GenerationMode = 'text2video';
                const viduImages = images;
                const viduImageRoles = imageRoles;

                // 优先检查是否有主体参考
                if (viduSubjects && viduSubjects.length > 0) {
                    mode = 'reference';
                    console.log(`[Vidu] Using reference mode with ${viduSubjects.length} subjects`);

                    taskId = await viduService.reference2video({
                        model: model as viduService.ViduModel,
                        images: viduSubjects.flatMap((s: { id: string; images: string[] }) => s.images),
                        prompt,
                        duration,
                        aspect_ratio: aspectRatio as viduService.AspectRatio,
                        resolution: config.resolution as viduService.Resolution,
                        movement_amplitude: config.movement_amplitude as viduService.MovementAmplitude,
                        bgm: config.bgm,
                        watermark: config.watermark,
                    });
                } else if (viduImages && viduImages.length >= 2 && viduImageRoles?.includes('first_frame') && viduImageRoles?.includes('last_frame')) {
                    // 首尾帧模式
                    mode = 'start-end';
                    taskId = await viduService.startEnd2video({
                        model: model as viduService.ViduModel,
                        images: viduImages,
                        prompt,
                        duration,
                        resolution: config.resolution as viduService.Resolution,
                        movement_amplitude: config.movement_amplitude as viduService.MovementAmplitude,
                        bgm: config.bgm,
                        watermark: config.watermark,
                    });
                } else if (viduImages && viduImages.length > 0) {
                    // 图生视频模式
                    mode = 'img2video';
                    taskId = await viduService.img2video({
                        model: model as viduService.ViduModel,
                        images: viduImages,
                        prompt,
                        duration,
                        resolution: config.resolution as viduService.Resolution,
                        movement_amplitude: config.movement_amplitude as viduService.MovementAmplitude,
                        audio: config.audio,
                        voice_id: config.voice_id,
                        watermark: config.watermark,
                    });
                } else {
                    // 文生视频模式
                    taskId = await viduService.text2video({
                        model: model as viduService.ViduModel,
                        prompt,
                        duration,
                        aspect_ratio: aspectRatio as viduService.AspectRatio,
                        resolution: config.resolution as viduService.Resolution,
                        movement_amplitude: config.movement_amplitude as viduService.MovementAmplitude,
                        style: config.style as viduService.Style,
                        bgm: config.bgm,
                        watermark: config.watermark,
                    });
                }

                console.log(`[Vidu] Created task with mode: ${mode}, taskId: ${taskId}`);
                break;
            }

            default:
                return NextResponse.json({ error: `不支持的视频模型: ${model}` }, { status: 400 });
        }

        // 返回 taskId，前端负责轮询
        return NextResponse.json({
            success: true,
            taskId,
            providerId,
            status: 'PENDING',
            message: '任务已创建，请查询状态获取结果',
        });

    } catch (error: any) {
        console.error('[Studio Video API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET 方法用于查询任务状态 (支持 Veo, Seedance, Vidu)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const providerId = searchParams.get('providerId');

    if (!taskId) {
        return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }
    if (!providerId) {
        return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    }

    try {
        switch (providerId) {
            case 'veo': {
                const result = await veoService.queryTask(taskId);
                return NextResponse.json({
                    taskId: result.task_id,
                    status: result.status,
                    progress: result.progress,
                    videoUrl: result.status === 'SUCCESS' ? result.data?.output : undefined,
                    error: result.status === 'FAILURE' ? result.fail_reason : undefined,
                });
            }

            case 'seedance': {
                const result = await seedanceService.queryTask(taskId);
                // 映射 Seedance 状态到统一状态
                let status: string;
                switch (result.status) {
                    case 'running': status = 'IN_PROGRESS'; break;
                    case 'succeeded': status = 'SUCCESS'; break;
                    case 'failed': status = 'FAILURE'; break;
                    default: status = result.status;
                }
                return NextResponse.json({
                    taskId: result.id,
                    status,
                    videoUrl: status === 'SUCCESS' ? result.content?.video_url : undefined,
                    error: status === 'FAILURE' ? result.error?.message : undefined,
                });
            }

            case 'vidu': {
                const result = await viduService.queryTask(taskId);
                // 映射 Vidu 状态到统一状态
                let status: string;
                switch (result.state) {
                    case 'created':
                    case 'queueing': status = 'NOT_START'; break;
                    case 'processing': status = 'IN_PROGRESS'; break;
                    case 'success': status = 'SUCCESS'; break;
                    case 'failed': status = 'FAILURE'; break;
                    default: status = result.state;
                }
                const creation = result.creations?.[0];
                return NextResponse.json({
                    taskId: result.task_id,
                    status,
                    videoUrl: status === 'SUCCESS' ? creation?.url : undefined,
                    coverUrl: status === 'SUCCESS' ? creation?.cover_url : undefined,
                    error: status === 'FAILURE' ? result.err_code : undefined,
                });
            }

            default:
                return NextResponse.json({ error: `不支持的 providerId: ${providerId}` }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[Studio Video Query] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
