/**
 * Studio 图像生成 API
 *
 * 支持模型:
 * - Seedream (即梦4): doubao-seedream-4-5-251128
 * - Nano-banana: nano-banana, nano-banana-hd, nano-banana-2
 */

import { NextRequest, NextResponse } from 'next/server';

// API 配置
const getApiConfig = () => {
    const baseUrl = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.bltcy.ai';
    const apiKey = process.env.OPENAI_API_KEY;
    return { baseUrl, apiKey };
};

// 判断模型类型
const getModelType = (model: string): 'seedream' | 'nano-banana' | 'unknown' => {
    if (model.includes('seedream') || model.includes('doubao')) return 'seedream';
    if (model.includes('nano-banana')) return 'nano-banana';
    return 'unknown';
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, model, images, aspectRatio, n, size, imageSize, responseFormat } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        const { baseUrl, apiKey } = getApiConfig();

        if (!apiKey) {
            return NextResponse.json({ error: 'API Key未配置' }, { status: 500 });
        }

        const modelType = getModelType(model || 'nano-banana');

        // 构建请求体
        const requestBody: any = {
            model: model || 'nano-banana',
            prompt,
        };

        if (modelType === 'seedream') {
            // Seedream 特定参数
            if (images && images.length > 0) requestBody.image = images;
            if (n) requestBody.n = String(n);
            if (size) requestBody.size = size;
            if (responseFormat) requestBody.response_format = responseFormat || 'url';
        } else if (modelType === 'nano-banana') {
            // Nano-banana 特定参数
            if (aspectRatio) requestBody.aspect_ratio = aspectRatio;
            if (images && images.length > 0) requestBody.image = images;
            if (imageSize && model === 'nano-banana-2') requestBody.image_size = imageSize;
            requestBody.response_format = responseFormat || 'url';
        }

        console.log(`[Studio Image API] Generating with model: ${model}`);

        const response = await fetch(`${baseUrl}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('[Studio Image API] Error:', errorData);
            return NextResponse.json(
                { error: errorData.error?.message || errorData.error || `API错误: ${response.status}` },
                { status: response.status }
            );
        }

        const result = await response.json();

        // 标准化返回格式
        const imageUrls = result.data?.map((d: any) => d.url || (d.b64_json ? `data:image/png;base64,${d.b64_json}` : null)).filter(Boolean) || [];

        return NextResponse.json({
            success: true,
            images: imageUrls,
            usage: result.usage,
            created: result.created,
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
