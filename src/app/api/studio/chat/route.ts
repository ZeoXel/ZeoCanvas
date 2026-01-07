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

// API 配置
const getApiConfig = () => {
    const baseUrl = process.env.OPENAI_API_BASE || process.env.OPENAI_BASE_URL || 'https://api.bltcy.ai';
    const apiKey = process.env.OPENAI_API_KEY;
    return { baseUrl, apiKey };
};

// 根据模式获取系统提示词
const getSystemPrompt = (mode: string): string => {
    switch (mode) {
        case 'prompt_enhancer':
        case 'prompt_generator':
            return `你是一位专业的 AI 提示词优化专家。用户会给你一个简短的想法或描述，你需要将它扩展成一个详细、生动、专业的 AI 图像/视频生成提示词。

要求：
1. 保留用户的核心意图和风格倾向
2. 添加丰富的视觉细节：光影效果、色彩搭配、构图方式、氛围营造、材质质感等
3. 使用专业的视觉/艺术/摄影术语
4. 长度适中，通常 3-5 句话，150-300字
5. 直接输出优化后的提示词，不要添加任何解释或前缀
6. 如果用户输入已经很详细，在此基础上进一步润色和专业化

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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { messages, mode = 'default' } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'messages is required and must be an array' }, { status: 400 });
        }

        const { baseUrl, apiKey } = getApiConfig();

        if (!apiKey) {
            return NextResponse.json({ error: 'API Key未配置' }, { status: 500 });
        }

        // 构建 OpenAI 格式的消息
        const systemPrompt = getSystemPrompt(mode);
        const openaiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map((m: { role: string; text: string }) => ({
                role: m.role === 'model' ? 'assistant' : 'user',
                content: m.text
            }))
        ];

        console.log(`[Studio Chat API] Mode: ${mode}, Messages: ${messages.length}`);

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages: openaiMessages,
                temperature: mode === 'prompt_enhancer' ? 0.7 : 0.8,
                max_tokens: 2048,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('[Studio Chat API] Error:', errorData);
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
