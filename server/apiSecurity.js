const SESSION_PATTERN = /^[a-zA-Z0-9_-]{12,96}$/;

const RATE_SQL = `
  INSERT INTO ai_rate_limits (scope, bucket, count, expires_at)
  VALUES (?, ?, 1, ?)
  ON CONFLICT(scope, bucket)
  DO UPDATE SET count = count + 1, expires_at = excluded.expires_at
  RETURNING count
`;

const sha256 = async (value) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const requestOrigin = (request) => {
  const value = request.headers.get('Origin');
  if (!value) return null;

  try {
    const origin = new URL(value);
    const target = new URL(request.url);
    return origin.origin === target.origin ? origin.origin : null;
  } catch {
    return null;
  }
};

export const corsHeaders = (origin) => ({
  ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-OuiOui-Task,X-OuiOui-Session',
});

export const jsonResponse = (body, status = 200, origin = null, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });

export const validateSameOrigin = (request) => {
  const origin = requestOrigin(request);
  if (!origin) {
    return {
      ok: false,
      response: jsonResponse({ error: { message: '请求来源无效。' } }, 403),
    };
  }
  return { ok: true, origin };
};

export const handleOptions = (request) => {
  const validation = validateSameOrigin(request);
  if (!validation.ok) return validation.response;
  return new Response(null, { status: 204, headers: corsHeaders(validation.origin) });
};

export const readJsonBody = async (request, maxBytes = 65536) => {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > maxBytes) {
    return { ok: false, error: '请求内容过长。', status: 413 };
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { ok: false, error: '请求内容过长。', status: 413 };
  }

  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, error: '请求格式错误。', status: 400 };
  }
};

const resultCount = (result) => Number(result?.results?.[0]?.count || 0);

export const enforceRateLimit = async ({
  env,
  request,
  category,
  perSession,
  perIp,
  perDay,
}) => {
  if (!env.AI_GATE_DB) {
    return {
      ok: false,
      status: 503,
      message: '安全计数服务尚未配置，付费功能暂时停用。',
    };
  }

  if (!env.AI_GATEWAY_SALT) {
    return {
      ok: false,
      status: 503,
      message: '安全校验服务尚未配置，付费功能暂时停用。',
    };
  }

  const session = request.headers.get('X-OuiOui-Session') || '';
  if (!SESSION_PATTERN.test(session)) {
    return { ok: false, status: 400, message: '客户端会话无效，请刷新页面后重试。' };
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256(`${env.AI_GATEWAY_SALT}:${ip}`);
  const now = Date.now();
  const minuteBucket = Math.floor(now / 60000);
  const dayBucket = Math.floor(now / 86400000);

  try {
    const results = await env.AI_GATE_DB.batch([
      env.AI_GATE_DB.prepare(RATE_SQL)
        .bind(`${category}:session:${session}`, minuteBucket, now + 120000),
      env.AI_GATE_DB.prepare(RATE_SQL)
        .bind(`${category}:ip:${ipHash}`, minuteBucket, now + 120000),
      env.AI_GATE_DB.prepare(RATE_SQL)
        .bind(`${category}:global`, dayBucket, now + 172800000),
    ]);

    const sessionCount = resultCount(results[0]);
    const ipCount = resultCount(results[1]);
    const dayCount = resultCount(results[2]);

    if (sessionCount > perSession || ipCount > perIp || dayCount > perDay) {
      console.warn(JSON.stringify({
        event: 'api_rate_limited',
        category,
        sessionCount,
        ipCount,
        dayCount,
      }));
      return { ok: false, status: 429, message: '请求较频繁，请稍后再试。' };
    }

    return { ok: true, sessionCount, ipCount, dayCount };
  } catch (error) {
    console.error(JSON.stringify({
      event: 'api_rate_limit_error',
      category,
      message: error instanceof Error ? error.message : String(error),
    }));
    return { ok: false, status: 503, message: '安全计数服务暂时不可用，请稍后重试。' };
  }
};
