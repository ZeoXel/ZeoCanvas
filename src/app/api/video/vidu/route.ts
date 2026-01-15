/**
 * Vidu 视频生成 API 路由
 *
 * 使用统一的 provider 服务架构
 * 支持模式: text2video, img2video, start-end, multiframe, reference, reference-audio
 *
 * POST - 创建视频生成任务
 * GET  - 查询任务状态
 */

import { NextRequest, NextResponse } from 'next/server';
import * as viduService from '@/services/providers/vidu';

// Route Segment Config
export const maxDuration = 300; // 5 分钟超时
export const dynamic = 'force-dynamic';

// POST: 创建视频生成任务
export async function POST(request: NextRequest) {
    try {
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
            // 是否等待结果
            wait_result = true,
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
                    });
                    break;

                case 'img2video':
                    taskId = await viduService.img2video({
                        model, images, prompt, duration, resolution,
                        movement_amplitude, audio, voice_id, watermark,
                    });
                    break;

                case 'start-end':
                    taskId = await viduService.startEnd2video({
                        model, images, prompt, duration, resolution,
                        movement_amplitude, bgm, watermark,
                    });
                    break;

                case 'multiframe':
                    taskId = await viduService.multiframe({
                        model, start_image, image_settings, resolution, watermark,
                    });
                    break;

                case 'reference':
                    taskId = await viduService.reference2video({
                        model, images, prompt, duration, aspect_ratio, resolution,
                        movement_amplitude, bgm, watermark,
                    });
                    break;

                case 'reference-audio':
                    taskId = await viduService.reference2videoAudio({
                        model, subjects, prompt, audio: true, duration, aspect_ratio,
                        resolution, movement_amplitude, watermark,
                    });
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
            }
        );

        return NextResponse.json({
            success: true,
            videoUrl: result.videoUrl,
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
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('task_id');

        if (!taskId) {
            return NextResponse.json(
                { error: '缺少 task_id 参数' },
                { status: 400 }
            );
        }

        const result = await viduService.queryTask(taskId);
        const creation = result.creations?.[0];

        return NextResponse.json({
            taskId: result.task_id,
            state: result.state,
            videoUrl: creation?.url,
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
