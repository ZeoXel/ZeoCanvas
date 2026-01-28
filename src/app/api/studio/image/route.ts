/**
 * Studio 图像生成 API
 *
 * 统一图像生成入口，根据模型路由到不同服务：
 * - Seedream: 火山引擎官方接口
 * - 其他: OpenAI 兼容网关
 *
 * 生成结果自动上传到 COS 存储
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateImage } from '@/services/providers/image';
import { smartUploadBatchServer, buildMediaPathServer } from '@/services/cosStorageServer';
import { getAssignedGatewayKey } from '@/lib/server/assignedKey';

// Route Segment Config
export const maxDuration = 60; // 图像生成通常较快
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, model, images, aspectRatio, n, size, imageSize } = body;

        console.log(`[Studio Image API] Request received:`, {
            prompt: prompt?.slice(0, 50),
            model,
            hasImages: !!images,
            aspectRatio,
            n,
            size,
            imageSize,
        });

        if (!prompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        const usedModel = model || 'nano-banana';
        console.log(`[Studio Image API] Using model: ${usedModel}, count: ${n || 1}`);

        let urls: string[];

        const { apiKey } = await getAssignedGatewayKey();
        if (!apiKey) {
            return NextResponse.json({ error: '未分配可用的API Key' }, { status: 401 });
        }
        const gatewayBaseUrl = process.env.GATEWAY_BASE_URL || 'https://api.lsaigc.com';

        const result = await generateImage({
            prompt,
            model: usedModel,
            images,
            aspectRatio,
            size,
            count: n,
            imageSize,
            apiKey,
            baseUrl: gatewayBaseUrl,
        });
        urls = result.urls;

        // 上传到 COS 存储（将临时 URL 转为永久存储）
        // 使用统一路径结构: zeocanvas/{userId}/images/{filename}
        const uploadPath = buildMediaPathServer('images');
        console.log(`[Studio Image API] Uploading ${urls.length} images to COS (${uploadPath})...`);
        const cosUrls = await smartUploadBatchServer(urls, uploadPath);
        console.log(`[Studio Image API] Uploaded to COS:`, cosUrls);

        return NextResponse.json({
            success: true,
            images: cosUrls,
        });

    } catch (error: any) {
        console.error('[Studio Image API] Error:', error);
        console.error('[Studio Image API] Error stack:', error.stack);

        let errorMessage: string;
        if (error.cause?.code === 'ENOTFOUND') {
            errorMessage = `无法连接到API服务器: ${error.cause?.hostname}`;
        } else if (error.cause?.code === 'ECONNREFUSED') {
            errorMessage = `API服务器拒绝连接`;
        } else if (error.cause?.code) {
            errorMessage = `网络错误: ${error.cause.code}`;
        } else {
            errorMessage = error.message || 'Internal server error';
        }

        return NextResponse.json(
            {
                error: errorMessage,
                details: error.cause?.code,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}
