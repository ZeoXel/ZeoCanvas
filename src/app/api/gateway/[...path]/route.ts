/**
 * Gateway Proxy API
 *
 * Routes requests to the configured New API gateway without exposing API keys
 * to the client. Intended for browser-side calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAssignedGatewayKey } from '@/lib/server/assignedKey';

const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL || 'https://api.lsaigc.com';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

const buildTargetUrl = (request: NextRequest, path: string[]) => {
  const url = new URL(request.url);
  const pathname = path.join('/');
  const base = GATEWAY_BASE_URL.replace(/\/+$/, '');
  return `${base}/${pathname}${url.search}`;
};

const forward = async (request: NextRequest, path: string[]) => {
  const { apiKey } = await getAssignedGatewayKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: '未分配可用的API Key' },
      { status: 401 }
    );
  }

  const targetUrl = buildTargetUrl(request, path);

  const headers = new Headers(request.headers);
  for (const h of HOP_BY_HOP_HEADERS) {
    headers.delete(h);
  }
  headers.set('Authorization', `Bearer ${apiKey}`);

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD'
    ? undefined
    : await request.arrayBuffer();

  const response = await fetch(targetUrl, {
    method,
    headers,
    body,
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
};

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}
