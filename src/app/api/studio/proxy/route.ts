/**
 * 媒体代理 API - 解决 CORS 问题
 * 用于代理火山引擎等外部服务的媒体文件
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    try {
        // 验证 URL 是否来自可信源
        const allowedHosts = [
            'ark-content-generation-cn-beijing.tos-cn-beijing.volces.com',
            'ark-content-generation-v2-cn-beijing.tos-cn-beijing.volces.com',
            'prod-ss-vidu.s3.cn-northwest-1.amazonaws.com.cn', // Vidu S3
        ];

        const urlObj = new URL(url);
        if (!allowedHosts.some(host => urlObj.hostname.includes(host))) {
            console.error('[Proxy API] Blocked URL:', urlObj.hostname);
            return NextResponse.json({ error: '不允许的 URL 来源' }, { status: 403 });
        }

        const response = await fetch(url);

        if (!response.ok) {
            return NextResponse.json(
                { error: `代理请求失败: ${response.status}` },
                { status: response.status }
            );
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch (error: any) {
        console.error('[Proxy API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Proxy error' },
            { status: 500 }
        );
    }
}
