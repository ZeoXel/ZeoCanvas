const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function testVeoV2() {
  console.log('=== Testing Veo with /v2/videos/generations (correct endpoint) ===\n');
  
  const body = {
    model: 'veo3.1',
    prompt: '一只可爱的小猫在草地上玩耍',
    images: [],  // 文生视频，不需要图片
    aspect_ratio: '16:9',
  };
  
  console.log('Request body:', JSON.stringify(body, null, 2));
  
  try {
    const response = await fetch(`${BASE_URL}/v2/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    console.log('\nResponse status:', response.status);
    
    const text = await response.text();
    console.log('Response body:', text);
    
    try {
      const data = JSON.parse(text);
      console.log('\nParsed response:', JSON.stringify(data, null, 2));
      
      if (data.task_id || data.data?.task_id) {
        console.log('\n✅ SUCCESS! Task created');
      }
    } catch (e) {
      console.log('Failed to parse as JSON');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testVeoV2();
