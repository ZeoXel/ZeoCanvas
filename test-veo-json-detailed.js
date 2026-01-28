const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function testVeoWithJSON() {
  console.log('=== Testing Veo 3.1 with JSON (detailed) ===\n');
  
  const body = {
    model: 'veo3.1',
    prompt: '一只可爱的小猫在草地上玩耍',
    aspect_ratio: '16:9',
    duration: 5,
  };
  
  console.log('Request body:', JSON.stringify(body, null, 2));
  
  try {
    const response = await fetch(`${BASE_URL}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    console.log('\nResponse status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('\nResponse body (raw):', text);
    
    try {
      const data = JSON.parse(text);
      console.log('\nResponse body (parsed):', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Failed to parse as JSON');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testVeoWithJSON();
