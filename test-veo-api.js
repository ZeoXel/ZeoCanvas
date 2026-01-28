#!/usr/bin/env node

const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function testVeoAPI() {
  console.log('=== Testing Veo API ===\n');

  // Test 1: JSON format (current implementation)
  console.log('Test 1: JSON format');
  try {
    const response = await fetch(`${BASE_URL}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'veo3.1',
        prompt: '测试视频生成',
        aspect_ratio: '16:9',
        duration: 5,
      }),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n---\n');

  // Test 2: FormData format
  console.log('Test 2: FormData format');
  try {
    const formData = new FormData();
    formData.append('model', 'veo3.1');
    formData.append('prompt', '测试视频生成');
    formData.append('aspect_ratio', '16:9');
    formData.append('duration', '5');

    const response = await fetch(`${BASE_URL}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testVeoAPI();
