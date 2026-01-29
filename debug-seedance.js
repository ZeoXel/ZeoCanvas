#!/usr/bin/env node

const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function debugSeedance() {
  console.log('=== 调试 Seedance 请求 ===\n');

  const requestBody = {
    model: 'doubao-seedance-1-5-pro-251215',
    prompt: '测试视频',
    duration: 4,
  };

  console.log('请求体:', JSON.stringify(requestBody, null, 2));
  console.log('API Key:', API_KEY.substring(0, 20) + '...');
  console.log('URL:', `${BASE_URL}/v1/video/generations`);
  console.log('\n发送请求...\n');

  try {
    const response = await fetch(`${BASE_URL}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('响应状态:', response.status, response.statusText);
    console.log('\n响应头:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    const text = await response.text();
    console.log('\n响应体:');
    console.log(text);

    try {
      const data = JSON.parse(text);
      console.log('\n解析后的响应:');
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('无法解析为 JSON');
    }
  } catch (error) {
    console.error('\n请求失败:', error.message);
    console.error(error.stack);
  }
}

debugSeedance();
