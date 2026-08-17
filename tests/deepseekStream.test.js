import assert from 'node:assert/strict';
import test from 'node:test';
import { extractDeepSeekSseText, readDeepSeekStream } from '../services/deepseekStream.js';

const event = (content) => `data: ${JSON.stringify({
  choices: [{ delta: { content } }],
})}\n\n`;

test('preserves SSE events split across arbitrary network chunks', async () => {
  const encoded = new TextEncoder().encode(`${event('Bon')}${event('jour enchanté')}data: [DONE]\n\n`);
  const splitPoints = [7, 19, 42, 67, encoded.length];
  let start = 0;

  const response = new Response(new ReadableStream({
    start(controller) {
      for (const end of splitPoints) {
        controller.enqueue(encoded.slice(start, end));
        start = end;
      }
      controller.close();
    },
  }));

  let result = '';
  for await (const content of readDeepSeekStream(response)) result += content;
  assert.equal(result, 'Bonjour enchanté');
});

test('extracts content from a complete SSE response', () => {
  const raw = `${event('{"correctText":"bonjour",')}${event('"pos":"interj."}')}data: [DONE]\n\n`;
  assert.equal(extractDeepSeekSseText(raw), '{"correctText":"bonjour","pos":"interj."}');
});
