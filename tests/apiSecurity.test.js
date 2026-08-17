import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest as deepseekHandler } from '../functions/api/deepseek/[[path]].js';

class FakeD1 {
  constructor() {
    this.counts = new Map();
  }

  prepare() {
    return {
      bind: (scope, bucket) => ({ scope, bucket }),
    };
  }

  async batch(statements) {
    return statements.map(({ scope, bucket }) => {
      const key = `${scope}:${bucket}`;
      const count = (this.counts.get(key) || 0) + 1;
      this.counts.set(key, count);
      return { success: true, results: [{ count }] };
    });
  }
}

const makeRequest = ({ origin = 'https://ouiouiai.pages.dev', task = 'lookup' } = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    'X-OuiOui-Task': task,
    'X-OuiOui-Session': 'testsession1234567890',
    'CF-Connecting-IP': '203.0.113.10',
  };
  if (origin) headers.Origin = origin;

  return new Request('https://ouiouiai.pages.dev/api/deepseek/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'attacker-selected-model',
      thinking: { type: 'enabled' },
      messages: [{ role: 'user', content: 'bonjour' }],
      max_tokens: 999999,
      temperature: 99,
      stream: false,
      tools: [{ type: 'function' }],
    }),
  });
};

const makeContext = (request, overrides = {}) => ({
  request,
  params: { path: ['v1', 'chat', 'completions'] },
  env: {
    AI_GATE_DB: new FakeD1(),
    AI_GATEWAY_SALT: 'unit-test-salt',
    DEEPSEEK_API_KEY: 'server-only-test-key',
    ...overrides,
  },
});

test('rejects requests that do not come from the same origin', async () => {
  const response = await deepseekHandler(makeContext(makeRequest({ origin: null })));
  assert.equal(response.status, 403);
});

test('rejects arbitrary upstream paths', async () => {
  const context = makeContext(makeRequest());
  context.params.path = ['v1', 'models'];
  const response = await deepseekHandler(context);
  assert.equal(response.status, 404);
});

test('pins model and task limits instead of forwarding arbitrary payload fields', async () => {
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (_url, init) => {
    forwarded = JSON.parse(init.body);
    return Response.json({ choices: [{ message: { content: '{}' } }] });
  };

  try {
    const response = await deepseekHandler(makeContext(makeRequest()));
    assert.equal(response.status, 200);
    assert.equal(forwarded.model, 'deepseek-v4-flash');
    assert.deepEqual(forwarded.thinking, { type: 'disabled' });
    assert.equal(forwarded.max_tokens, 1600);
    assert.equal(forwarded.temperature, 1);
    assert.equal('tools' in forwarded, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('enforces session limits before calling the paid upstream', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ choices: [{ message: { content: '{}' } }] });
  };

  const env = {
    AI_GATE_DB: new FakeD1(),
    AI_GATEWAY_SALT: 'unit-test-salt',
    DEEPSEEK_API_KEY: 'server-only-test-key',
    DEEPSEEK_SESSION_LIMIT: '1',
  };

  try {
    const first = await deepseekHandler(makeContext(makeRequest(), env));
    const second = await deepseekHandler(makeContext(makeRequest(), env));
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
