// 测试 Silicon Flow API 连接
const SILICON_FLOW_API_KEY = 'sk-mtwbtmpradyvpbngtddqpapkcuyqproksepfbizwybeyqmpl';
const API_URL = 'https://api.siliconflow.cn/v1/images/generations';

async function testSiliconFlowAPI() {
  console.log('正在测试 Silicon Flow API 连接...');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICON_FLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: 'stable-diffusion-xl',
        prompt: '测试图片生成',
        width: 512,
        height: 512,
        n: 1,
        response_format: 'url'
      })
    });
    
    console.log('HTTP 状态码:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API 错误:', errorData);
      return false;
    }
    
    const data = await response.json();
    console.log('✅ API 调用成功！');
    console.log('响应内容:', data);
    return true;
  } catch (error) {
    console.error('❌ API 调用失败:', error.message);
    return false;
  }
}

testSiliconFlowAPI();