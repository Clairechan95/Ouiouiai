import {
  corsHeaders,
  enforceRateLimit,
  handleOptions,
  jsonResponse,
  readJsonBody,
  validateSameOrigin,
} from '../../../server/apiSecurity.js';

const TASK_LIMITS = {
  lookup: 1600,
  conjugations: 1000,
  extended_conjugations: 1500,
  collocations: 1200,
  chat: 800,
  cloze_story: 1800,
  conjugation_story: 1800,
  practice_summary: 300,
  error_hint: 100,
};

const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const validateMessages = (messages) => {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 24) return false;
  let totalLength = 0;

  for (const message of messages) {
    if (!message || !ALLOWED_ROLES.has(message.role) || typeof message.content !== 'string') {
      return false;
    }
    totalLength += message.content.length;
  }

  return totalLength <= 40000;
};

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === 'OPTIONS') return handleOptions(request);

  const source = validateSameOrigin(request);
  if (!source.ok) return source.response;

  if (request.method !== 'POST') {
    return jsonResponse({ error: { message: 'Method not allowed' } }, 405, source.origin);
  }

  const pathParam = params.path;
  const upstreamPath = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '');
  if (upstreamPath !== 'v1/chat/completions') {
    return jsonResponse({ error: { message: 'API path not allowed' } }, 404, source.origin);
  }

  const task = request.headers.get('X-OuiOui-Task') || '';
  const tokenLimit = TASK_LIMITS[task];
  if (!tokenLimit) {
    return jsonResponse({ error: { message: '未知的学习任务。' } }, 400, source.origin);
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return jsonResponse({ error: { message: parsed.error } }, parsed.status, source.origin);
  }

  const payload = parsed.value;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonResponse({ error: { message: '请求格式错误。' } }, 400, source.origin);
  }
  if (!validateMessages(payload.messages)) {
    return jsonResponse({ error: { message: '对话内容无效或过长。' } }, 400, source.origin);
  }

  const rate = await enforceRateLimit({
    env,
    request,
    category: 'deepseek',
    perSession: Number(env.DEEPSEEK_SESSION_LIMIT || 20),
    perIp: Number(env.DEEPSEEK_IP_LIMIT || 90),
    perDay: Number(env.DEEPSEEK_DAILY_LIMIT || 3000),
  });
  if (!rate.ok) {
    return jsonResponse({ error: { message: rate.message } }, rate.status, source.origin, {
      'Retry-After': rate.status === 429 ? '60' : '10',
    });
  }

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return jsonResponse({
      error: { message: '查词服务正在进行安全维护，请稍后重试。' },
    }, 503, source.origin);
  }

  const maxTokens = clamp(Number(payload.max_tokens) || tokenLimit, 1, tokenLimit);
  const safePayload = {
    model: 'deepseek-v4-flash',
    thinking: { type: 'disabled' },
    messages: payload.messages.map(({ role, content }) => ({ role, content })),
    max_tokens: maxTokens,
    temperature: clamp(Number(payload.temperature) || 0.5, 0, 1),
    stream: payload.stream === true,
  };

  if (payload.response_format?.type === 'json_object') {
    safePayload.response_format = { type: 'json_object' };
  }

  const startedAt = Date.now();
  let upstream;
  try {
    upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(safePayload),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'deepseek_upstream_error',
      task,
      message: error instanceof Error ? error.message : String(error),
    }));
    return jsonResponse({ error: { message: '查词服务连接失败，请稍后重试。' } }, 502, source.origin);
  }

  console.log(JSON.stringify({
    event: 'deepseek_request',
    task,
    status: upstream.status,
    stream: safePayload.stream,
    durationMs: Date.now() - startedAt,
    cfRay: request.headers.get('CF-Ray'),
  }));

  const headers = new Headers(upstream.headers);
  Object.entries(corsHeaders(source.origin)).forEach(([key, value]) => headers.set(key, value));
  headers.set('Cache-Control', 'no-store');
  headers.set('X-OuiOui-Task', task);
  headers.delete('Content-Encoding');
  headers.delete('Content-Length');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
