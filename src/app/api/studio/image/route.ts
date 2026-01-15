/**
 * Studio 图像生成 API
 *
 * 统一图像生成入口，根据模型路由到不同服务：
 * - Seedream: 火山引擎官方接口
 * - 其他: OpenAI 兼容网关
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateImage } from '@/services/providers/image';
import * as seedream from '@/services/providers/seedream';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, model, images, aspectRatio, n, size, imageSize } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        const usedModel = model || 'nano-banana';
        console.log(`[Studio Image API] model: ${usedModel}, count: ${n || 1}`);

        let urls: string[];

        // Seedream 使用火山引擎官方接口
        if (usedModel.includes('seedream')) {
            const result = await seedream.generateImage({
                prompt,
                model: usedModel,
                images,
                aspectRatio,
                n,
                size,
            });
            urls = result.urls;
        } else {
            // 其他模型使用 OpenAI 兼容网关
            const result = await generateImage({
                prompt,
                model: usedModel,
                images,
                aspectRatio,
                count: n,
                imageSize,
            });
            urls = result.urls;
        }

        return NextResponse.json({
            success: true,
            images: urls,
        });

    } catch (error: any) {
        console.error('[Studio Image API] Error:', error);

        const errorMessage = error.cause?.code === 'ENOTFOUND'
            ? `无法连接到API服务器: ${error.cause?.hostname}`
            : error.cause?.code === 'ECONNREFUSED'
            ? `API服务器拒绝连接`
            : error.cause?.code
            ? `网络错误: ${error.cause.code}`
            : error.message || 'Internal server error';

        return NextResponse.json(
            { error: errorMessage, details: error.cause?.code },
            { status: 500 }
        );
    }
}
