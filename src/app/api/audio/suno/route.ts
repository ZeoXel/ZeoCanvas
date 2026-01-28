/**
 * Suno 音乐生成 API 路由
 *
 * 使用统一的 provider 服务架构
 * 支持模型: chirp-v4, chirp-v3.5
 *
 * POST - 提交音乐生成任务
 * GET  - 查询歌曲状态
 */

import { NextRequest, NextResponse } from 'next/server';
import * as sunoService from '@/services/providers/suno';
import { getAssignedGatewayKey } from '@/lib/server/assignedKey';

// Route Segment Config
export const maxDuration = 60; // 创建任务只需要很短时间
export const dynamic = 'force-dynamic';

// POST: 提交生成任务
export async function POST(request: NextRequest) {
    try {
        const { apiKey } = await getAssignedGatewayKey();
        if (!apiKey) {
            return NextResponse.json(
                { code: -1, message: '未分配可用的API Key' },
                { status: 401 }
            );
        }
        const gatewayBaseUrl = process.env.GATEWAY_BASE_URL || 'https://api.lsaigc.com';

        const body = await request.json();
        const { mode, ...params } = body;

        console.log(`[Suno API] Mode: ${mode || 'auto'}`);

        let result: sunoService.GenerateResult;

        if (mode === 'inspiration' || params.gpt_description_prompt) {
            // 灵感模式
            result = await sunoService.generateInspiration({
                prompt: params.prompt || params.gpt_description_prompt,
                make_instrumental: params.make_instrumental,
                mv: params.mv,
            }, { apiKey, baseUrl: gatewayBaseUrl });
        } else {
            // 自定义模式
            result = await sunoService.generateCustom({
                title: params.title,
                tags: params.tags,
                prompt: params.prompt,
                negative_tags: params.negative_tags,
                mv: params.mv,
                make_instrumental: params.make_instrumental,
                continue_clip_id: params.continue_clip_id,
                continue_at: params.continue_at,
            }, { apiKey, baseUrl: gatewayBaseUrl });
        }

        return NextResponse.json({
            code: 0,
            data: {
                song_id: result.song_ids[0],
                ...(result.song_ids[1] && { song_id_2: result.song_ids[1] }),
            },
        });

    } catch (error: any) {
        console.error('[Suno API] Error:', error);
        return NextResponse.json(
            { code: -1, message: error.message || '请求失败' },
            { status: 500 }
        );
    }
}

// GET: 查询歌曲状态
export async function GET(request: NextRequest) {
    try {
        const { apiKey } = await getAssignedGatewayKey();
        if (!apiKey) {
            return NextResponse.json(
                { code: -1, message: '未分配可用的API Key' },
                { status: 401 }
            );
        }
        const gatewayBaseUrl = process.env.GATEWAY_BASE_URL || 'https://api.lsaigc.com';

        const { searchParams } = new URL(request.url);
        const ids = searchParams.get('ids');

        if (!ids) {
            return NextResponse.json(
                { code: -1, message: '缺少 ids 参数' },
                { status: 400 }
            );
        }

        const songIds = ids.split(',');
        const result = await sunoService.querySongs(songIds, { apiKey, baseUrl: gatewayBaseUrl });

        return NextResponse.json({
            code: 0,
            data: result.songs,
        });

    } catch (error: any) {
        console.error('[Suno Query] Error:', error);
        return NextResponse.json(
            { code: -1, message: error.message || '查询失败' },
            { status: 500 }
        );
    }
}
