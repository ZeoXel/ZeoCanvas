const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function testProvider(name, body) {
  console.log(`\n=== Testing ${name} ===`);
  
  try {
    const response = await fetch(`${BASE_URL}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 300));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function runTests() {
  await testProvider('Vidu (viduq2-turbo)', {
    model: 'viduq2-turbo',
    mode: 'text2video',
    prompt: '测试视频',
    duration: 4,
  });

  await testProvider('Seedance', {
    model: 'doubao-seedance-1-5-pro-251215',
    prompt: '测试视频',
    duration: 4,
  });

  await testProvider('Veo (veo3.1)', {
    model: 'veo3.1',
    prompt: '测试视频',
    aspect_ratio: '16:9',
  });
}

runTests();
