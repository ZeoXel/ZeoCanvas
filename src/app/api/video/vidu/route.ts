/**
 * Vidu 视频生成 API 路由
 *
 * 使用统一的 provider 服务架构
 * 支持模式: text2video, img2video, start-end, multiframe, reference, reference-audio
 *
 * POST - 创建视频生成任务
 * GET  - 查询任务状态
 *
 * 生成结果自动上传到 COS 存储
 */

import { NextRequest, NextResponse } from 'next/server';
import * as viduService from '@/services/providers/vidu';
import { smartUploadVideoServer, buildMediaPathServer } from '@/services/cosStorageServer';
import { getAssignedGatewayKey } from '@/lib/server/assignedKey';

// Route Segment Config
export const maxDuration = 60; // 创建任务只需要很短时间
export const dynamic = 'force-dynamic';

// POST: 创建视频生成任务
export async function POST(request: NextRequest) {
    try {
        const { apiKey } = await getAssignedGatewayKey();
        if (!apiKey) {
            return NextResponse.json({ error: '未分配可用的API Key' }, { status: 401 });
        }
        const gatewayBaseUrl = process.env.GATEWAY_BASE_URL || 'https://api.lsaigc.com';

        const body = await request.json();
        const {
            mode = 'img2video',
            model = 'viduq2-turbo',
            prompt,
            images,
            duration,
            resolution,
            aspect_ratio,
            movement_amplitude,
            style,
            bgm,
            audio,
            voice_id,
            watermark,
            // 多帧专用
            start_image,
            image_settings,
            // 参考生视频专用
            subjects,
            // 是否等待结果（默认不等待，使用前端轮询）
            wait_result = false,
        } = body;

        console.log(`[Vidu API] Mode: ${mode}, Model: ${model}`);

        // 如果不等待结果，只创建任务
        if (!wait_result) {
            let taskId: string;

            switch (mode) {
                case 'text2video':
                    taskId = await viduService.text2video({
                        model, prompt, duration, aspect_ratio, resolution,
                        movement_amplitude, style, bgm, watermark,
                    }, { apiKey, baseUrl: gatewayBaseUrl });
                    break;

                case 'img2video':
                    taskId = await viduService.img2video({
                        model, images, prompt, duration, resolution,
                        movement_amplitude, audio, voice_id, watermark,
                    }, { apiKey, baseUrl: gatewayBaseUrl });
                    break;

                case 'start-end':
                    taskId = await viduService.startEnd2video({
                        model, images, prompt, duration, resolution,
                        movement_amplitude, bgm, watermark,
                    }, { apiKey, baseUrl: gatewayBaseUrl });
                    break;

                case 'multiframe':
                    taskId = await viduService.multiframe({
                        model, start_image, image_settings, resolution, watermark,
                    }, { apiKey, baseUrl: gatewayBaseUrl });
                    break;

                case 'reference':
                    taskId = await viduService.reference2video({
                        model, images, prompt, duration, aspect_ratio, resolution,
                        movement_amplitude, bgm, watermark,
                    }, { apiKey, baseUrl: gatewayBaseUrl });
                    break;

                case 'reference-audio':
                    taskId = await viduService.reference2videoAudio({
                        model, subjects, prompt, audio: true, duration, aspect_ratio,
                        resolution, movement_amplitude, watermark,
                    }, { apiKey, baseUrl: gatewayBaseUrl });
                    break;

                default:
                    return NextResponse.json(
                        { error: `不支持的模式: ${mode}` },
                        { status: 400 }
                    );
            }

            return NextResponse.json({
                success: true,
                taskId,
                message: '任务已创建，请查询状态获取结果',
            });
        }

        // 等待结果
        const result = await viduService.generateVideo(
            {
                mode,
                model,
                prompt,
                images,
                duration,
                resolution,
                aspect_ratio,
                movement_amplitude,
                style,
                bgm,
                audio,
                voice_id,
                watermark,
                start_image,
                image_settings,
                subjects,
            },
            (state) => {
                console.log(`[Vidu API] Task state: ${state}`);
            },
            { apiKey, baseUrl: gatewayBaseUrl }
        );

        // 上传到 COS 存储（将临时 URL 转为永久存储）
        const uploadPath = buildMediaPathServer('videos');
        console.log(`[Vidu API] Uploading video to COS (${uploadPath})...`);
        const videoUrl = await smartUploadVideoServer(result.videoUrl, uploadPath);
        console.log(`[Vidu API] Video uploaded: ${videoUrl}`);

        return NextResponse.json({
            success: true,
            videoUrl,
            coverUrl: result.coverUrl,
            taskId: result.taskId,
        });

    } catch (error: any) {
        console.error('[Vidu API] Error:', error);
        return NextResponse.json(
            { error: error.message || '请求失败' },
            { status: 500 }
        );
    }
}

// GET: 查询任务状态
export async function GET(request: NextRequest) {
    try {
        const { apiKey } = await getAssignedGatewayKey();
        if (!apiKey) {
            return NextResponse.json({ error: '未分配可用的API Key' }, { status: 401 });
        }
        const gatewayBaseUrl = process.env.GATEWAY_BASE_URL || 'https://api.lsaigc.com';

        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('task_id');

        if (!taskId) {
            return NextResponse.json(
                { error: '缺少 task_id 参数' },
                { status: 400 }
            );
        }

        const result = await viduService.queryTask(taskId, { apiKey, baseUrl: gatewayBaseUrl });
        const creation = result.creations?.[0];

        // 如果任务成功且有视频 URL，上传到 COS
        let videoUrl = creation?.url;
        if (result.state === 'success' && videoUrl) {
            const uploadPath = buildMediaPathServer('videos');
            console.log(`[Vidu Query] Uploading video to COS...`);
            videoUrl = await smartUploadVideoServer(videoUrl, uploadPath);
        }

        return NextResponse.json({
            taskId: result.task_id,
            state: result.state,
            videoUrl,
            coverUrl: creation?.cover_url,
            credits: result.credits,
            error: result.state === 'failed' ? result.err_code : undefined,
        });

    } catch (error: any) {
        console.error('[Vidu Query] Error:', error);
        return NextResponse.json(
            { error: error.message || '查询失败' },
            { status: 500 }
        );
    }
}
