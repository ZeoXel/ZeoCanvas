const API_KEY = 'sk-evZ7Ao43Tgq8Ouv7Va7Z7IPKLviYPBVFNHzD6EncgLfTB4mw';
const BASE_URL = 'https://api.lsaigc.com';

async function testVariation(name, body, contentType) {
  console.log(`\n=== ${name} ===`);
  try {
    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const response = await fetch(`${BASE_URL}/v1/video/generations`, {
      method: 'POST',
      headers,
      body,
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function runTests() {
  // Test with different field names
  const formData1 = new FormData();
  formData1.append('model_name', 'veo3.1');
  formData1.append('prompt', '测试');
  await testVariation('FormData with model_name', formData1);

  const formData2 = new FormData();
  formData2.append('model_id', 'veo3.1');
  formData2.append('prompt', '测试');
  await testVariation('FormData with model_id', formData2);

  const formData3 = new FormData();
  formData3.append('model', 'veo3.1');
  formData3.append('prompt', '测试');
  formData3.append('provider', 'veo');
  await testVariation('FormData with provider', formData3);
}

runTests();
