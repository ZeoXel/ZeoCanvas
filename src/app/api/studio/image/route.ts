/**
 * Studio 图像生成 API
 *
 * 支持模型:
 * - Seedream 4.5 (火山引擎): doubao-seedream-4-5-251128
 * - Nano Banana (OpenAI兼容): nano-banana, nano-banana-pro
 */

import { NextRequest, NextResponse } from 'next/server';

// OpenAI 兼容 API 配置 (Nano-banana)
const getOpenAIConfig = () => {
    const baseUrl = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.bltcy.ai';
    const apiKey = process.env.OPENAI_API_KEY;
    return { baseUrl, apiKey };
};

// 火山引擎 API 配置 (Seedream)
const getVolcengineConfig = () => {
    const baseUrl = 'https://ark.cn-beijing.volces.com/api/v3';
    const apiKey = process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY;
    return { baseUrl, apiKey };
};

// 判断模型提供商
const getModelProvider = (model: string): 'seedream' | 'nano-banana' => {
    if (model.includes('seedream') || model.includes('doubao')) return 'seedream';
    return 'nano-banana';
};

// Seedream 比例到尺寸映射
const SEEDREAM_SIZE_MAP: Record<string, string> = {
    '1:1': '2048x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '16:9': '2560x1440',
    '9:16': '1440x2560',
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, model, images, aspectRatio, n, size, imageSize, responseFormat } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        const modelType = getModelProvider(model || 'nano-banana');
        const { baseUrl, apiKey } = modelType === 'seedream' ? getVolcengineConfig() : getOpenAIConfig();

        if (!apiKey) {
            return NextResponse.json({ error: `API Key未配置 (${modelType})` }, { status: 500 });
        }

        // 构建请求体
        const requestBody: any = {
            model: model || 'nano-banana',
            prompt,
        };

        if (modelType === 'seedream') {
            // Seedream 特定参数 - 将比例转换为尺寸
            if (images && images.length > 0) requestBody.image = images;
            // 优先使用 aspectRatio 映射，其次用 size
            const seedreamSize = aspectRatio ? SEEDREAM_SIZE_MAP[aspectRatio] : size;
            if (seedreamSize) requestBody.size = seedreamSize;
            if (responseFormat) requestBody.response_format = responseFormat || 'url';
            requestBody.watermark = false; // Seedream 4.5: 始终不添加水印

            // Seedream 4.5 组图功能：通过提示词控制数量
            // max_images 是上限，实际数量由提示词决定
            if (n && n > 1) {
                requestBody.sequential_image_generation = 'auto';
                requestBody.sequential_image_generation_options = {
                    max_images: Math.min(n, 15)  // 上限，最大15
                };
                // 将数量要求添加到提示词中
                requestBody.prompt = `${prompt} ${n}张`;
            } else {
                requestBody.sequential_image_generation = 'disabled';
            }
        } else if (modelType === 'nano-banana') {
            // Nano-banana 特定参数
            if (aspectRatio) requestBody.aspect_ratio = aspectRatio;
            if (images && images.length > 0) requestBody.image = images;
            if (imageSize && model === 'nano-banana-2') requestBody.image_size = imageSize;
            requestBody.response_format = responseFormat || 'url';
        }

        console.log(`[Studio Image API] Generating with model: ${model}, type: ${modelType}, n: ${n}`);
        console.log(`[Studio Image API] Request body:`, JSON.stringify(requestBody, null, 2));

        // Seedream 用 /images/generations，Nano-banana 用 /v1/images/generations
        const apiPath = modelType === 'seedream' ? '/images/generations' : '/v1/images/generations';
        const response = await fetch(`${baseUrl}${apiPath}`, {
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
