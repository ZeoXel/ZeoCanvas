/**
 * Studio 视频生成 API
 *
 * 使用前端轮询模式，避免 Vercel serverless 超时
 *
 * POST - 创建任务，立即返回 taskId
 * GET  - 查询任务状态，成功后自动上传到 COS 存储
 *
 * 集成 USERAPI 任务追踪：
 * - 创建任务时记录到 USERAPI
 * - 任务完成时更新状态和记录消费
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVideoProviderId } from '@/services/providers';
import * as veoService from '@/services/providers/veo';
import * as seedanceService from '@/services/providers/seedance';
import * as viduService from '@/services/providers/vidu';
import { smartUploadVideoServer, buildMediaPathServer } from '@/services/cosStorageServer';
import { createUserApiTask, updateUserApiTask, recordConsumptionServer } from '@/services/userApiTasks';

// 从请求头获取 API Key
function getApiKeyFromRequest(request: NextRequest): string | null {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
}

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
                    });
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
                    });
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
                    });
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
                    });
                }

                console.log(`[Studio Video API] Vidu mode: ${mode}`);
                break;
            }

            default:
                return NextResponse.json({ error: `不支持的视频模型: ${model}` }, { status: 400 });
        }

        console.log(`[Studio Video API] Task created: ${taskId}, provider: ${providerId}`);

        // 记录任务到 USERAPI（异步，不阻塞返回）
        const apiKey = getApiKeyFromRequest(request);
        if (apiKey) {
            createUserApiTask(apiKey, {
                taskId,
                platform: providerId,
                action: body.images?.length > 0 ? 'img2video' : 'text2video',
                requestData: {
                    model,
                    prompt: prompt?.slice(0, 200),
                    duration,
                    aspectRatio,
                },
            }).catch(err => console.warn('[Studio Video API] Failed to create USERAPI task:', err));
        }

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
        let status: string;
        let videoUrl: string | undefined;
        let error: string | undefined;
        let progress: string | undefined;

        switch (provider) {
            case 'veo': {
                const result = await veoService.queryTask(taskId);
                status = result.status;
                videoUrl = result.data?.output;
                error = result.fail_reason;
                progress = result.progress;
                break;
            }

            case 'seedance': {
                const result = await seedanceService.queryTask(taskId);
                // 映射状态
                if (result.status === 'succeeded') status = 'SUCCESS';
                else if (result.status === 'failed') status = 'FAILURE';
                else status = 'IN_PROGRESS';
                videoUrl = result.content?.video_url;
                error = result.error?.message;
                break;
            }

            case 'vidu': {
                const result = await viduService.queryTask(taskId);
                // 映射状态
                if (result.state === 'success') status = 'SUCCESS';
                else if (result.state === 'failed') status = 'FAILURE';
                else status = 'IN_PROGRESS';
                videoUrl = result.creations?.[0]?.url;
                error = result.err_code;
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

        // 更新 USERAPI 任务状态并记录消费（任务完成或失败时）
        const apiKey = getApiKeyFromRequest(request);
        if (apiKey && (status === 'SUCCESS' || status === 'FAILURE')) {
            // 更新任务状态
            updateUserApiTask(apiKey, taskId, {
                status: status === 'SUCCESS' ? 'success' : 'failure',
                failReason: error,
                responseData: { videoUrl },
            }).catch(err => console.warn('[Studio Video API] Failed to update USERAPI task:', err));

            // 记录消费（仅成功时）
            if (status === 'SUCCESS') {
                recordConsumptionServer(apiKey, {
                    service: 'video',
                    provider,
                    model: provider, // 实际模型信息在创建时已存储
                    usage: {
                        durationSeconds: 4, // 默认时长，实际应从任务数据获取
                        resolution: '720p',
                    },
                    metadata: {
                        taskId,
                    },
                }).catch(err => console.warn('[Studio Video API] Failed to record consumption:', err));
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
