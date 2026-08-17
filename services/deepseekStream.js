const contentFromSseLine = (line) => {
  if (!line.startsWith('data:')) return undefined;

  const payload = line.slice(5).trim();
  if (!payload || payload === '[DONE]') return undefined;

  try {
    const event = JSON.parse(payload);
    return event.choices?.[0]?.delta?.content || '';
  } catch {
    return undefined;
  }
};

export const extractDeepSeekSseText = (text) => text
  .split(/\r?\n/)
  .map(contentFromSseLine)
  .filter((content) => typeof content === 'string')
  .join('');

export async function* readDeepSeekStream(response) {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let pending = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() || '';

      for (const rawLine of lines) {
        const content = contentFromSseLine(rawLine.replace(/\r$/, ''));
        if (content) yield content;
      }
    }

    pending += decoder.decode();
    const finalContent = contentFromSseLine(pending.replace(/\r$/, ''));
    if (finalContent) yield finalContent;
  } finally {
    reader.releaseLock();
  }
}
