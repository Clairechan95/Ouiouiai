import {
  corsHeaders,
  enforceRateLimit,
  handleOptions,
  jsonResponse,
  readJsonBody,
  validateSameOrigin,
} from '../../server/apiSecurity.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const voiceMap = (env) => ({
  female: env.MINIMAX_FRENCH_FEMALE_VOICE_ID || 'French_Female_News Anchor',
  male: env.MINIMAX_FRENCH_MALE_VOICE_ID || 'French_Male_Speech_New',
});

const hashText = async (text) => {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const hexToBytes = (hex) => {
  const normalized = hex.trim();
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
};

const buildMiniMaxUrl = (env) => {
  const baseUrl = env.MINIMAX_TTS_ENDPOINT || 'https://api.minimaxi.com/v1/t2a_v2';
  const groupId = env.MINIMAX_GROUP_ID;
  const url = new URL(baseUrl);
  url.searchParams.set('GroupId', groupId);
  return url.toString();
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return handleOptions(request);

  const source = validateSameOrigin(request);
  if (!source.ok) return source.response;

  if (request.method !== 'POST') {
    return jsonResponse({ error: { message: 'Method not allowed' } }, 405, source.origin);
  }

  const parsed = await readJsonBody(request, 8192);
  if (!parsed.ok) {
    return jsonResponse({ error: { message: parsed.error } }, parsed.status, source.origin);
  }
  const payload = parsed.value;

  const text = String(payload.text || '').trim();
  if (!text) {
    return jsonResponse({ error: { message: '缺少要朗读的文本。' } }, 400, source.origin);
  }

  if (text.length > 3000) {
    return jsonResponse({ error: { message: '朗读文本过长，请拆分后重试。' } }, 400, source.origin);
  }

  const voice = payload.voice === 'male' ? 'male' : 'female';
  const rate = clamp(Number(payload.rate) || 0.85, 0.5, 2);
  const model = env.MINIMAX_TTS_MODEL || 'speech-02-turbo';
  const voiceId = voiceMap(env)[voice];
  const cacheHash = await hashText(`${model}|${voiceId}|${rate}|${text}`);
  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = `/api/tts-cache/${cacheHash}.mp3`;
  cacheUrl.search = '';
  const cacheRequest = new Request(cacheUrl.toString(), { method: 'GET' });
  const cache = caches.default;

  const cached = await cache.match(cacheRequest);
  if (cached) {
    const headers = new Headers(cached.headers);
    Object.entries(corsHeaders(source.origin)).forEach(([key, value]) => headers.set(key, value));
    headers.set('X-TTS-Cache', 'HIT');
    return new Response(cached.body, { status: 200, headers });
  }

  const apiKey = env.MINIMAX_API_KEY;
  if (!apiKey) {
    return jsonResponse({
      error: {
        message: 'MiniMax API Key 未配置，请在 Cloudflare Pages 环境变量中添加 MINIMAX_API_KEY。',
      },
    }, 503, source.origin);
  }

  if (!env.MINIMAX_GROUP_ID) {
    return jsonResponse({
      error: {
        message: 'MiniMax Group ID 未配置，请在 Cloudflare Pages 环境变量中添加 MINIMAX_GROUP_ID。',
      },
    }, 503, source.origin);
  }

  const gate = await enforceRateLimit({
    env,
    request,
    category: 'tts',
    perSession: Number(env.TTS_SESSION_LIMIT || 20),
    perIp: Number(env.TTS_IP_LIMIT || 100),
    perDay: Number(env.TTS_DAILY_LIMIT || 10000),
  });
  if (!gate.ok) {
    return jsonResponse({ error: { message: gate.message } }, gate.status, source.origin);
  }

  let upstream;
  try {
    upstream = await fetch(buildMiniMaxUrl(env), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        text,
        stream: false,
        language_boost: 'French',
        output_format: 'hex',
        voice_setting: {
          voice_id: voiceId,
          speed: rate,
          vol: 1,
          pitch: 0,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
          channel: 1,
        },
        subtitle_enable: false,
      }),
    });
  } catch (error) {
    return jsonResponse({
      error: {
        message: 'MiniMax 语音服务连接失败，请稍后重试。',
        detail: error instanceof Error ? error.message : String(error),
      },
    }, 502, source.origin);
  }

  const result = await upstream.json().catch(() => null);
  if (!upstream.ok || !result || result.base_resp?.status_code !== 0 || !result.data?.audio) {
    return jsonResponse({
      error: {
        message: result?.base_resp?.status_msg || `MiniMax 语音合成失败：${upstream.status}`,
        trace_id: result?.trace_id,
      },
    }, upstream.ok ? 502 : upstream.status, source.origin);
  }

  const audioBytes = hexToBytes(result.data.audio);
  const response = new Response(audioBytes, {
    status: 200,
    headers: {
      ...corsHeaders(source.origin),
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=2592000',
      'X-TTS-Cache': 'MISS',
      'X-TTS-Voice': voice,
    },
  });

  context.waitUntil(cache.put(cacheRequest, response.clone()));
  return response;
}
