/**
 * 图片代理 API
 *
 * 用于解决第三方图片服务（如火山引擎 TOS）的 CORS 问题
 * 通过服务端获取图片并返回，绕过浏览器的跨域限制
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // 验证 URL 是否为有效的图片 URL
    const parsedUrl = new URL(url);

    // 只允许特定域名的图片代理（安全考虑）
    const allowedHosts = [
      'ark-content-generation-v2-cn-beijing.tos-cn-beijing.volces.com',
      'tos-cn-beijing.volces.com',
      // 可以添加更多允许的域名
    ];

    if (!allowedHosts.some(host => parsedUrl.hostname.includes(host))) {
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
    }

    // 获取图片
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StudioProxy/1.0)',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    // 获取图片数据
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // 返回图片，添加 CORS 头
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 缓存 24 小时
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[Image Proxy] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
