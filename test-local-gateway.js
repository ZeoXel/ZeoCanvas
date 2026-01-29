#!/usr/bin/env node

const API_KEY = 'sk-rwWwXIZd2E57RvoE5KeVAguWvFiIuXdz9QBbfNJeUUZklhOT';
const BASE_URL = 'http://localhost:3000';

async function testLocal() {
  console.log('=== 测试本地网关 (localhost:3000) ===\n');

  // Test 1: Veo
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
        prompt: '测试视频',
        images: [],
        aspect_ratio: '16:9',
      }),
    });
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    if (data.task_id) {
      console.log(`   ✅ 成功! Task ID: ${data.task_id}`);
    } else {
      console.log(`   ❌ 失败: ${JSON.stringify(data)}`);
    }
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
        prompt: '测试视频',
        duration: 4,
      }),
    });
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    if (data.task_id) {
      console.log(`   ✅ 成功! Task ID: ${data.task_id}`);
    } else {
      console.log(`   ❌ 失败: ${JSON.stringify(data)}`);
    }
  } catch (e) {
    console.log(`   ❌ 错误: ${e.message}`);
  }

  console.log('\n3. 测试 Vidu (对照组):');
  try {
    const response = await fetch(`${BASE_URL}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'viduq2-turbo',
        mode: 'text2video',
        prompt: '测试视频',
        duration: 4,
      }),
    });
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    if (data.task_id) {
      console.log(`   ✅ 成功! Task ID: ${data.task_id}`);
    } else {
      console.log(`   ❌ 失败: ${JSON.stringify(data).substring(0, 200)}`);
    }
  } catch (e) {
    console.log(`   ❌ 错误: ${e.message}`);
  }
}

testLocal();
