#!/usr/bin/env node

const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function debugRequest() {
  console.log('=== 调试 Seedance 请求详情 ===\n');

  const requestBody = {
    model: 'doubao-seedance-1-5-pro-251215',
    prompt: '一只可爱的小猫',
    duration: 4,
    aspect_ratio: '16:9',
  };

  console.log('请求详情:');
  console.log('  URL:', `${BASE_URL}/v1/video/generations`);
  console.log('  Method: POST');
  console.log('  Body:', JSON.stringify(requestBody, null, 2));
  console.log('\n发送请求...\n');

  try {
    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'User-Agent': 'Seedance-Test/1.0',
      },
      body: JSON.stringify(requestBody),
    });
    const endTime = Date.now();

    console.log('响应详情:');
    console.log('  Status:', response.status, response.statusText);
    console.log('  Time:', endTime - startTime, 'ms');
    console.log('\n响应头:');

    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
      if (key.startsWith('x-')) {
        console.log(`  ${key}: ${value}`);
      }
    });

    const text = await response.text();
    console.log('\n响应体:');
    console.log(text);

    try {
      const data = JSON.parse(text);
      if (data.code === 'fail_to_fetch_task') {
        console.log('\n❌ 错误分析:');
        console.log('  - 错误代码: fail_to_fetch_task');
        console.log('  - 这个错误通常表示:');
        console.log('    1. 适配器未找到 (GetTaskAdaptor 返回 nil)');
        console.log('    2. 或者上游 API 返回非 200 状态');
        console.log('  - Channel Type 应该是: 56 (Seedance)');
        console.log('  - 请检查网关是否真的加载了最新代码');
      }
    } catch (e) {}
  } catch (error) {
    console.error('\n请求失败:', error.message);
  }
}

debugRequest();
