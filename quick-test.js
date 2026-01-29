#!/usr/bin/env node

const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function quickTest() {
  console.log('=== 快速测试网关状态 ===\n');

  // Test Veo
  console.log('1. 测试 Veo (v2 端点):');
  try {
    const response = await fetch(`${BASE_URL}/v2/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'veo3.1',
        prompt: '测试',
        images: [],
        aspect_ratio: '16:9',
      }),
    });
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Result: ${data.task_id ? '✅ 成功' : '❌ 失败'}`);
    if (data.task_id) console.log(`   Task ID: ${data.task_id}`);
  } catch (e) {
    console.log(`   ❌ 错误: ${e.message}`);
  }

  console.log('\n2. 测试 Seedance (v1 端点):');
  try {
    const response = await fetch(`${BASE_URL}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'doubao-seedance-1-5-pro-251215',
        prompt: '测试',
      }),
    });
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Result: ${data.task_id ? '✅ 成功' : '❌ 失败'}`);
    if (data.task_id) {
      console.log(`   Task ID: ${data.task_id}`);
    } else {
      console.log(`   Error: ${data.code || data.error}`);
    }
  } catch (e) {
    console.log(`   ❌ 错误: ${e.message}`);
  }
}

quickTest();
