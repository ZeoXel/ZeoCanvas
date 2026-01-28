#!/usr/bin/env node

const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function testSeedance() {
  console.log('=== 测试 Seedance (火山引擎视频生成) ===\n');

  // Test 1: 基本的 Seedance 请求
  console.log('Test 1: Seedance 基本请求');
  try {
    const response = await fetch(`${BASE_URL}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'doubao-seedance-1-5-pro-251215',
        prompt: '一只可爱的小猫在草地上玩耍',
        duration: 4,
        aspect_ratio: '16:9',
      }),
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text);

    try {
      const data = JSON.parse(text);
      if (data.task_id) {
        console.log('\n✅ 成功创建任务！Task ID:', data.task_id);
        return data.task_id;
      } else if (data.error || data.code) {
        console.log('\n❌ 错误:', data.message || data.error || data.code);
      }
    } catch (e) {
      console.log('无法解析 JSON 响应');
    }
  } catch (error) {
    console.error('\n❌ 请求失败:', error.message);
  }

  console.log('\n---\n');

  // Test 2: 尝试不同的参数组合
  console.log('Test 2: Seedance 简化请求（只有必需参数）');
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
      }),
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));

    try {
      const data = JSON.parse(text);
      if (data.task_id) {
        console.log('\n✅ 成功！');
      }
    } catch (e) {}
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
  }

  console.log('\n---\n');

  // Test 3: 检查模型列表
  console.log('Test 3: 检查可用模型列表');
  try {
    const response = await fetch(`${BASE_URL}/v1/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    const data = await response.json();
    const seedanceModels = data.data.filter(m =>
      m.id.includes('seedance') || m.id.includes('seedream')
    );

    console.log('找到的 Seedance/Seedream 模型:');
    seedanceModels.forEach(m => {
      console.log(`  - ${m.id}`);
    });

    if (seedanceModels.length === 0) {
      console.log('  ❌ 没有找到 Seedance 相关模型');
    }
  } catch (error) {
    console.error('❌ 获取模型列表失败:', error.message);
  }
}

testSeedance();
