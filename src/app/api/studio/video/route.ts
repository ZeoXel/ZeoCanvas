/**
 * Studio 视频生成 API
 *
 * 使用前端轮询模式，避免 Vercel serverless 超时
 *
 * POST - 创建任务，立即返回 taskId
 * GET  - 查询任务状态，成功后自动上传到 COS 存储
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVideoProviderId } from '@/services/providers';
import * as veoService from '@/services/providers/veo';
import * as seedanceService from '@/services/providers/seedance';
import * as viduService from '@/services/providers/vidu';
import { smartUploadVideoServer, buildMediaPathServer } from '@/services/cosStorageServer';
import { getAssignedGatewayKey } from '@/lib/server/assignedKey';

// Route Segment Config
export const maxDuration = 60; // 创建任务只需要很短时间
export const dynamic = 'force-dynamic';

/**
 * POST - 创建视频生成任务（立即返回 taskId，不等待完成）
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, model, aspectRatio, duration, enhancePrompt, images, imageRoles, videoConfig, viduSubjects } = body;

        console.log(`[Studio Video API] Creating task:`, {
            model,
            aspectRatio,
            duration,
            imagesCount: images?.length || 0,
            imageRoles,
            viduSubjectsCount: viduSubjects?.length || 0
        });

        if (!prompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }
        if (!model) {
            return NextResponse.json({ error: 'model is required' }, { status: 400 });
        }

        const providerId = getVideoProviderId(model);
        const { apiKey } = await getAssignedGatewayKey();

        if (!apiKey) {
            return NextResponse.json({ error: '未分配可用的API Key' }, { status: 401 });
        }
        const gatewayBaseUrl = process.env.GATEWAY_BASE_URL || 'https://api.lsaigc.com';

        if (!providerId) {
            return NextResponse.json({ error: `不支持的视频模型: ${model}` }, { status: 400 });
        }

        let taskId: string;
        const config = videoConfig || {};

        // 根据 provider 创建任务
        switch (providerId) {
            case 'veo': {
                taskId = await veoService.createTask({
                    prompt,
                    model: model as any,
                    aspectRatio: aspectRatio as any,
                    duration,
                    enhancePrompt: config.enhance_prompt ?? enhancePrompt,
                    images,
                }, { apiKey, baseUrl: gatewayBaseUrl });
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
                }, { apiKey, baseUrl: gatewayBaseUrl });
                break;
            }

            case 'vidu': {
                // 自动判断生成模式
                let mode: viduService.GenerationMode = 'text2video';

                if (viduSubjects && viduSubjects.length > 0) {
                    mode = 'reference';
                    taskId = await viduService.reference2video({
                        model: model as viduService.ViduModel,
                        images: viduSubjects.flatMap((s: any) => s.images),
                        prompt,
                        duration,
                        resolution: config.resolution as viduService.Resolution,
                        aspect_ratio: aspectRatio as viduService.AspectRatio,
                        movement_amplitude: config.movement_amplitude as viduService.MovementAmplitude,
                        bgm: config.bgm,
                        watermark: config.watermark,
                    }, { apiKey, baseUrl: gatewayBaseUrl });
                } else if (images && images.length >= 2 && imageRoles?.includes('first_frame') && imageRoles?.includes('last_frame')) {
                    mode = 'start-end';
                    taskId = await viduService.startEnd2video({
                        model: model as viduService.ViduModel,
                        images,
                        prompt,
                        duration,
                        resolution: config.resolution as viduService.Resolution,
                        movement_amplitude: config.movement_amplitude as viduService.MovementAmplitude,
                        bgm: config.bgm,
                        watermark: config.watermark,
                    }, { apiKey, baseUrl: gatewayBaseUrl });
                } else if (images && images.length > 0) {
                    mode = 'img2video';
                    taskId = await viduService.img2video({
                        model: model as viduService.ViduModel,
                        images,
                        prompt,
                        duration,
                        resolution: config.resolution as viduService.Resolution,
                        movement_amplitude: config.movement_amplitude as viduService.MovementAmplitude,
                        watermark: config.watermark,
                    }, { apiKey, baseUrl: gatewayBaseUrl });
                } else {
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
                    }, { apiKey, baseUrl: gatewayBaseUrl });
                }

                console.log(`[Studio Video API] Vidu mode: ${mode}`);
                break;
            }

            default:
                return NextResponse.json({ error: `不支持的视频模型: ${model}` }, { status: 400 });
        }

        console.log(`[Studio Video API] Task created: ${taskId}, provider: ${providerId}`);

        return NextResponse.json({
            success: true,
            taskId,
            provider: providerId,
            status: 'PENDING',
        });

    } catch (error: any) {
        console.error('[Studio Video API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET - 查询任务状态，成功后自动上传到 COS
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const provider = searchParams.get('provider') as 'veo' | 'seedance' | 'vidu';

    if (!taskId) {
        return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }
    if (!provider) {
        return NextResponse.json({ error: 'provider is required' }, { status: 400 });
    }

    try {
        const { apiKey } = await getAssignedGatewayKey();
        if (!apiKey) {
            return NextResponse.json({ error: '未分配可用的API Key' }, { status: 401 });
        }
        const gatewayBaseUrl = process.env.GATEWAY_BASE_URL || 'https://api.lsaigc.com';
        let status: string;
        let videoUrl: string | undefined;
        let error: string | undefined;
        let progress: string | undefined;

        switch (provider) {
            case 'veo': {
                const result = await veoService.queryTask(taskId, { apiKey, baseUrl: gatewayBaseUrl });
                status = result.status;
                videoUrl = result.data?.output;
                error = result.fail_reason;
                progress = result.progress;
                break;
            }

            case 'seedance': {
                const result = await seedanceService.queryTask(taskId, { apiKey, baseUrl: gatewayBaseUrl });
                // 映射状态
                if (result.status === 'succeeded') status = 'SUCCESS';
                else if (result.status === 'failed') status = 'FAILURE';
                else status = 'IN_PROGRESS';
                videoUrl = result.content?.video_url;
                error = result.error?.message;
                break;
            }

            case 'vidu': {
                const result = await viduService.queryTask(taskId, { apiKey, baseUrl: gatewayBaseUrl });
                // 映射状态（优先检查 err_code，因为它可能在 state 不是 failed 时就出现）
                if (result.err_code) {
                    status = 'FAILURE';
                    error = result.err_code;
                } else if (result.state === 'success') {
                    status = 'SUCCESS';
                    videoUrl = result.creations?.[0]?.url;
                } else if (result.state === 'failed') {
                    status = 'FAILURE';
                    error = result.err_code || '视频生成失败';
                } else {
                    status = 'IN_PROGRESS';
                }
                break;
            }

            default:
                return NextResponse.json({ error: `不支持的 provider: ${provider}` }, { status: 400 });
        }

        // 如果任务成功且有视频 URL，上传到 COS 存储
        if (status === 'SUCCESS' && videoUrl) {
            try {
                const uploadPath = buildMediaPathServer('videos');
                console.log(`[Studio Video API] Uploading video to COS (${uploadPath})...`);
                const cosUrl = await smartUploadVideoServer(videoUrl, uploadPath);
                console.log(`[Studio Video API] Video uploaded: ${cosUrl}`);
                videoUrl = cosUrl; // 使用 COS URL
            } catch (uploadError: any) {
                console.warn(`[Studio Video API] COS upload failed, using original URL:`, uploadError.message);
                // 上传失败时使用原始 URL
            }
        }

        return NextResponse.json({
            taskId,
            provider,
            status,
            videoUrl,
            error,
            progress,
        });

    } catch (error: any) {
        console.error('[Studio Video API] Query error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
