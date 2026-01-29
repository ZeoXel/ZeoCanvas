#!/usr/bin/env node

const API_KEY = 'sk-rwWwXIZd2E57RvoE5KeVAguWvFiIuXdz9QBbfNJeUUZklhOT';
const BASE_URL = 'http://localhost:3000';

async function testSeedanceQuery() {
  console.log('=== 测试 Seedance 任务查询 ===\n');

  const taskId = 'cgt-20260128183647-cdmq2';

  console.log(`查询任务: ${taskId}\n`);

  try {
    const response = await fetch(`${BASE_URL}/v1/video/generations/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.status) {
      console.log(`\n任务状态: ${data.status}`);
      if (data.url) {
        console.log(`视频 URL: ${data.url}`);
      }
    }
  } catch (error) {
    console.error('错误:', error.message);
  }
}

testSeedanceQuery();
