const SUPABASE_URL = "https://zjjqclfmrxxfkynfmtha.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqanFjbGZtcnh4Zmt5bmZtdGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjI1NjcsImV4cCI6MjA4ODIzODU2N30.KL22O1-mvMWcdmnA74jTVSyxEcdgvBkG3PELsUWJSIo";

const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// 获取或生成匿名用户 ID（存在 localStorage 里）
export const getSessionId = (): string => {
  const key = 'ouioui_session_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
};

// 记录查词
export const logWordLookup = (word: string, pos?: string) => {
  fetch(`${SUPABASE_URL}/rest/v1/word_lookups`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ word, pos: pos || null, session_id: getSessionId() })
  }).catch(() => {});
};

// 记录功能使用（story_generate / conjugation_generate）
export const logFeatureEvent = (eventType: 'story_generate' | 'conjugation_generate') => {
  fetch(`${SUPABASE_URL}/rest/v1/feature_events`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ event_type: eventType, session_id: getSessionId() })
  }).catch(() => {});
};
