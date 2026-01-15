/**
 * Studio 图像生成 API
 *
 * 使用统一的 provider 服务架构
 * 支持模型: Nano Banana, Seedream
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateImage, getProviderId } from '@/services/providers';
import { SIZE_MAP } from '@/services/providers/seedream';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, model, images, aspectRatio, n, size, imageSize, responseFormat } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        const providerId = getProviderId(model || 'nano-banana');

        if (!providerId) {
            return NextResponse.json({ error: `不支持的模型: ${model}` }, { status: 400 });
        }

        console.log(`[Studio Image API] Generating with model: ${model}, provider: ${providerId}, n: ${n}`);

        // 确定最终尺寸
        let finalSize = size;
        if (providerId === 'seedream' && aspectRatio && SIZE_MAP[aspectRatio]) {
            finalSize = SIZE_MAP[aspectRatio];
        }

        const urls = await generateImage({
            prompt,
            model: model || 'nano-banana',
            aspectRatio,
            images,
            count: n,
            size: finalSize,
        });

        return NextResponse.json({
            success: true,
            images: urls,
        });

    } catch (error: any) {
        console.error('[Studio Image API] Error:', error);

        // 提供更详细的错误信息
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
