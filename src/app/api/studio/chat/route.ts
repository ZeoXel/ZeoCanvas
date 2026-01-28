/**
 * Studio AI 创意助手 Chat API
 *
 * 使用 OpenAI 兼容格式接入 LLM
 * 支持模式:
 * - default: 通用创意助手
 * - prompt_enhancer: 提示词优化 (帮我写)
 * - storyboard: 分镜脚本生成
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAssignedGatewayKey } from '@/lib/server/assignedKey';

// API 配置
const normalizeOpenAIBase = (baseUrl: string) => {
    if (baseUrl.endsWith('/v1')) return baseUrl;
    return `${baseUrl.replace(/\/+$/, '')}/v1`;
};

const getApiConfig = () => {
    const rawBaseUrl = process.env.GATEWAY_BASE_URL
        || process.env.OPENAI_API_BASE
        || process.env.OPENAI_BASE_URL
        || 'https://api.lsaigc.com';
    const baseUrl = normalizeOpenAIBase(rawBaseUrl);
    return { baseUrl };
};

// 根据模式获取系统提示词
const getSystemPrompt = (mode: string): string => {
    switch (mode) {
        case 'prompt_enhancer':
        case 'prompt_generator':
            return `你是一位专业的 AI 提示词优化专家。你的任务是将用户的想法、描述或素材分析转化为详细、专业的 AI 图像/视频生成提示词。

**重要：必须使用中文输出。**

工作模式：
- 如果用户提供文本描述：将其扩展为专业提示词
- 如果用户提供图片/视频素材：分析其视觉元素并生成对应的提示词

要求：
1. 保留用户的核心意图和风格倾向
2. 添加丰富的视觉细节：光影效果、色彩搭配、构图方式、氛围营造、材质质感、运动方式等
3. 使用专业的视觉/艺术/摄影/影视术语
4. 长度适中，通常 3-5 句话，150-300字
5. 直接输出优化后的提示词，不要添加任何解释或前缀
6. 如果分析视频，着重描述运动、节奏、镜头语言等动态元素

示例：
用户输入：一只猫在窗边
优化输出：一只优雅的橘色虎斑猫慵懒地蜷卧在阳光斑驳的窗台上，柔和的晨光从纱帘透入，在毛皮上投下温暖的光晕。窗外是朦胧的城市天际线，整体氛围宁静治愈，采用电影级摄影构图，浅景深效果，暖色调滤镜。`;

        case 'storyboard':
            return `你是一位专业的视频分镜脚本设计师。用户会给你一个视频主题或创意，你需要为其设计详细的分镜脚本。

每个分镜需要包含：
1. **镜号**: 分镜序号
2. **画面描述**: 详细的视觉内容描述
3. **镜头运动**: 推拉摇移跟等镜头语言
4. **时长建议**: 每个镜头的大致时长
5. **音效/配乐**: 声音设计建议

输出格式使用清晰的 Markdown 结构，便于阅读和执行。

示例格式：
## 分镜脚本：[主题]

### 镜头 1 (3-5秒)
- **画面**: 描述...
- **镜头**: 缓慢推进
- **音效**: 环境音...

### 镜头 2 (2-3秒)
...`;

        default:
            return `你是 Studio 的 AI 创意助手，专注于帮助用户进行创意内容生成。你的专长包括：

1. **提示词优化**: 将简单的想法转化为专业的 AI 生成提示词
2. **创意建议**: 提供视觉风格、构图、色彩等方面的专业建议
3. **分镜设计**: 协助规划视频内容的镜头脚本
4. **灵感激发**: 根据用户的初步想法拓展创意方向

请用简洁、专业的语言回复。回复时善用 Markdown 格式（标题、列表、加粗等）使内容更清晰易读。`;
    }
};

// 默认模型
const DEFAULT_MODEL = 'gpt-4o-mini';
const VISION_MODEL = 'gpt-4o'; // 多模态模型

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { messages, mode = 'default', image, video, model: requestedModel } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'messages is required and must be an array' }, { status: 400 });
        }

        const { baseUrl } = getApiConfig();
        const { apiKey } = await getAssignedGatewayKey();

        if (!apiKey) {
            return NextResponse.json({ error: '未分配可用的API Key' }, { status: 401 });
        }

        // 判断是否有多模态内容
        const hasMedia = !!(image || video);
        // 支持自定义模型，否则根据是否有媒体自动选择
        const model = requestedModel || (hasMedia ? VISION_MODEL : DEFAULT_MODEL);

        // 构建 OpenAI 格式的消息
        const systemPrompt = getSystemPrompt(mode);
        const openaiMessages: any[] = [
            { role: 'system', content: systemPrompt }
        ];

        // 处理用户消息
        for (const m of messages) {
            const role = m.role === 'model' ? 'assistant' : 'user';

            if (hasMedia && role === 'user') {
                // 多模态消息格式
                const content: any[] = [];

                // 添加文本（放在最前面）
                if (m.text) {
                    content.push({ type: 'text', text: m.text });
                }

                // 添加图片（使用 image_url 类型）
                if (image) {
                    content.push({
                        type: 'image_url',
                        image_url: { url: image }
                    });
                }

                // 添加视频（也使用 image_url 类型，API 会根据 URL 内容自动识别）
                if (video) {
                    content.push({
                        type: 'image_url',
                        image_url: { url: video }
                    });
                }

                openaiMessages.push({ role, content });
            } else {
                // 纯文本消息
                openaiMessages.push({ role, content: m.text });
            }
        }

        console.log(`[Studio Chat API] Mode: ${mode}, Model: ${model}, HasMedia: ${hasMedia}, HasVideo: ${!!video}, HasImage: ${!!image}`);
        if (video) {
            console.log(`[Studio Chat API] Video URL type: ${video.substring(0, 50)}...`);
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: openaiMessages,
                temperature: mode === 'prompt_enhancer' ? 0.7 : 0.8,
                max_tokens: 2048,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Studio Chat API] Error Response:', errorText);
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText || 'Unknown error' };
            }
            return NextResponse.json(
                { error: errorData.error?.message || errorData.error || `API错误: ${response.status}` },
                { status: response.status }
            );
        }

        const result = await response.json();
        const assistantMessage = result.choices?.[0]?.message?.content || '无响应';

        return NextResponse.json({
            message: assistantMessage,
            usage: result.usage,
        });

    } catch (error: any) {
        console.error('[Studio Chat API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
