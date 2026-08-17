const SESSION_KEY = 'ouioui_session_id';
const SESSION_PATTERN = /^[a-zA-Z0-9_-]{12,96}$/;

const createSessionId = (): string => {
  const webCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID().replace(/-/g, '');
  }

  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(18);
    webCrypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
};

export const getApiSessionId = (): string => {
  const existing = window.localStorage.getItem(SESSION_KEY) || '';
  if (SESSION_PATTERN.test(existing)) return existing;

  const sessionId = createSessionId();
  window.localStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
};

export const paidApiHeaders = (task: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  'X-OuiOui-Task': task,
  'X-OuiOui-Session': getApiSessionId(),
});
