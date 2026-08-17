import {
  enforceRateLimit,
  handleOptions,
  jsonResponse,
  readJsonBody,
  validateSameOrigin,
} from '../../server/apiSecurity.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return handleOptions(request);

  const source = validateSameOrigin(request);
  if (!source.ok) return source.response;

  if (request.method !== 'POST') {
    return jsonResponse({ error: { message: 'Method not allowed' } }, 405, source.origin);
  }

  const parsed = await readJsonBody(request, 4096);
  if (!parsed.ok) {
    return jsonResponse({ error: { message: parsed.error } }, parsed.status, source.origin);
  }

  const word = String(parsed.value.word || '').trim().slice(0, 100);
  const imageKeyword = String(parsed.value.imageKeyword || '').trim().slice(0, 160);
  if (!word) {
    return jsonResponse({ error: { message: '缺少图片关键词。' } }, 400, source.origin);
  }

  const rate = await enforceRateLimit({
    env,
    request,
    category: 'images',
    perSession: Number(env.IMAGE_SESSION_LIMIT || 5),
    perIp: Number(env.IMAGE_IP_LIMIT || 20),
    perDay: Number(env.IMAGE_DAILY_LIMIT || 300),
  });
  if (!rate.ok) {
    return jsonResponse({ error: { message: rate.message } }, rate.status, source.origin);
  }

  const apiKey = env.SILICON_FLOW_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: { message: '图片服务正在进行安全维护。' } }, 503, source.origin);
  }

  const keyword = imageKeyword || word;
  const prompt = `${keyword}, soft watercolor illustration, educational dictionary art, clean white background, vibrant colors, highly detailed, no text, no letters`;

  let upstream;
  try {
    upstream = await fetch('https://api.siliconflow.cn/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-dev',
        prompt,
        image_size: '1024x1024',
        n: 2,
        num_inference_steps: 25,
      }),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'image_upstream_error',
      message: error instanceof Error ? error.message : String(error),
    }));
    return jsonResponse({ error: { message: '图片服务连接失败。' } }, 502, source.origin);
  }

  const result = await upstream.json().catch(() => null);
  if (!upstream.ok || !result) {
    return jsonResponse({ error: { message: `图片生成失败：${upstream.status}` } }, 502, source.origin);
  }

  const images = Array.isArray(result.images)
    ? result.images
      .map((item) => (typeof item?.url === 'string' ? { url: item.url } : null))
      .filter(Boolean)
      .slice(0, 2)
    : [];

  console.log(JSON.stringify({
    event: 'image_request',
    status: upstream.status,
    imageCount: images.length,
    cfRay: request.headers.get('CF-Ray'),
  }));

  return jsonResponse({ images }, 200, source.origin);
}
