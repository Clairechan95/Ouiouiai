// 测试 DeepSeek API 连接
const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_BASE_URL = 'https://api.deepseek.com/v1';

async function testDeepSeekAPI() {
  console.log('正在测试 DeepSeek API 连接...');

  if (!API_KEY) {
    throw new Error('请先设置 DEEPSEEK_API_KEY 环境变量');
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{
          role: 'user',
          content: '请简单介绍一下你自己'
        }],
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ API 连接成功！');
    console.log('响应内容:', data.choices[0].message.content);
    return true;
  } catch (error) {
    console.error('❌ API 连接失败:', error.message);
    return false;
  }
}

testDeepSeekAPI();
