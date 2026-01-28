const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function testVeoFormData() {
  console.log('=== Testing Veo with FormData (like updated code) ===\n');
  
  const formData = new FormData();
  formData.append('prompt', '一只可爱的小猫在草地上玩耍');
  formData.append('model', 'veo3.1');
  formData.append('aspect_ratio', '16:9');
  formData.append('duration', '5');
  
  console.log('Request fields:');
  for (const [key, value] of formData.entries()) {
    console.log(`  ${key}: ${value}`);
  }
  
  try {
    const response = await fetch(`${BASE_URL}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: formData,
    });

    console.log('\nResponse status:', response.status);
    
    const text = await response.text();
    console.log('Response body:', text);
    
    try {
      const data = JSON.parse(text);
      console.log('\nParsed response:', JSON.stringify(data, null, 2));
      
      if (data.task_id) {
        console.log('\n✅ SUCCESS! Task ID:', data.task_id);
      } else if (data.error) {
        console.log('\n❌ ERROR:', data.error.message);
      }
    } catch (e) {
      console.log('Failed to parse as JSON');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testVeoFormData();
