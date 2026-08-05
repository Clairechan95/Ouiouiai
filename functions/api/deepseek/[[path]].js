const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: { message: 'Method not allowed' } }, 405);
  }

  const apiKey = env.DEEPSEEK_API_KEY || env.API_KEY || env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({
      error: {
        message: 'DeepSeek API 密钥未配置，请在 Cloudflare Pages 环境变量中添加 DEEPSEEK_API_KEY。',
      },
    }, 500);
  }

  const pathParam = params.path;
  const upstreamPath = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '');
  const upstreamUrl = `https://api.deepseek.com/${upstreamPath}`;

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: request.body,
    });
  } catch (error) {
    return json({
      error: {
        message: 'DeepSeek 代理请求失败，请稍后重试。',
        detail: error instanceof Error ? error.message : String(error),
      },
    }, 502);
  }

  const headers = new Headers(upstream.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cache-Control', 'no-store');
  headers.delete('Content-Encoding');
  headers.delete('Content-Length');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
