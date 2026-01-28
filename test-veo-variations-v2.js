const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function testEndpoint(endpoint, body, description) {
  console.log(`\n=== ${description} ===`);
  console.log(`Endpoint: ${endpoint}`);
  console.log('Body:', JSON.stringify(body, null, 2));
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    console.log('Status:', response.status);
    const text = await response.text();
    
    if (text.includes('<!doctype html>')) {
      console.log('Response: HTML page (endpoint not found)');
    } else {
      console.log('Response:', text.substring(0, 500));
      try {
        const data = JSON.parse(text);
        if (data.task_id || data.data?.task_id) {
          console.log('✅ SUCCESS!');
        }
      } catch (e) {}
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function runTests() {
  // Test 1: v2 endpoint with images array
  await testEndpoint('/v2/videos/generations', {
    model: 'veo3.1',
    prompt: '一只可爱的小猫',
    images: [],
    aspect_ratio: '16:9',
  }, 'v2 endpoint with empty images array');

  // Test 2: v2 endpoint with images as required field with dummy value
  await testEndpoint('/v2/videos/generations', {
    model: 'veo3.1',
    prompt: '一只可爱的小猫',
    images: [''],
    aspect_ratio: '16:9',
  }, 'v2 endpoint with dummy image');

  // Test 3: v1 endpoint with correct format
  await testEndpoint('/v1/videos/generations', {
    model: 'veo3.1',
    prompt: '一只可爱的小猫',
    aspect_ratio: '16:9',
  }, 'v1 endpoint (alternative)');
}

runTests();
