#!/usr/bin/env node

const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function testVeoWithNewGateway() {
  console.log('=== 测试 Veo (使用更新后的网关) ===\n');

  // Test 1: 使用 v2 端点（根据文档）
  console.log('Test 1: v2/videos/generations 端点');
  try {
    const response = await fetch(`${BASE_URL}/v2/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'veo3.1',
        prompt: '一只可爱的小猫在草地上玩耍',
        images: [],
        aspect_ratio: '16:9',
      }),
    });

    console.log('Status:', response.status);
    const text = await response.text();

    if (text.includes('<!doctype html>')) {
      console.log('❌ 返回 HTML 页面（端点不存在）\n');
    } else {
      console.log('Response:', text.substring(0, 500));
      try {
        const data = JSON.parse(text);
        if (data.task_id) {
          console.log('✅ 成功创建任务！Task ID:', data.task_id, '\n');
        }
      } catch (e) {}
    }
  } catch (error) {
    console.error('❌ 错误:', error.message, '\n');
  }

  // Test 2: 使用 v1 端点
  console.log('Test 2: v1/video/generations 端点');
  try {
    const response = await fetch(`${BASE_URL}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'veo3.1',
        prompt: '一只可爱的小猫在草地上玩耍',
        images: [],
        aspect_ratio: '16:9',
      }),
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));

    try {
      const data = JSON.parse(text);
      if (data.task_id) {
        console.log('✅ 成功创建任务！Task ID:', data.task_id, '\n');
      } else if (data.error) {
        console.log('❌ 错误:', data.error.message || data.error, '\n');
      }
    } catch (e) {}
  } catch (error) {
    console.error('❌ 错误:', error.message, '\n');
  }

  // Test 3: 测试 Vidu（应该正常工作）
  console.log('Test 3: Vidu (对照组)');
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

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 300));

    try {
      const data = JSON.parse(text);
      if (data.task_id) {
        console.log('✅ Vidu 正常工作！\n');
      } else if (data.error || data.code) {
        console.log('❌ Vidu 错误:', data.message || data.error, '\n');
      }
    } catch (e) {}
  } catch (error) {
    console.error('❌ 错误:', error.message, '\n');
  }
}

testVeoWithNewGateway();
