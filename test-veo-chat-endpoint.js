const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function testVeoChatEndpoint() {
  console.log('=== Testing Veo via /v1/chat/completions ===\n');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'veo3.1',
        messages: [{
          role: 'user',
          content: '一只可爱的小猫在草地上玩耍'
        }],
        // 视频参数
        aspect_ratio: '16:9',
        duration: 5,
      }),
    });

    console.log('Response status:', response.status);
    const text = await response.text();
    console.log('Response:', text);
    
    try {
      const data = JSON.parse(text);
      console.log('\nParsed:', JSON.stringify(data, null, 2));
    } catch (e) {}
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testVeoChatEndpoint();
