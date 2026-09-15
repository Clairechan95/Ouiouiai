import { supabase } from './supabaseClient';

export type LearningEventType =
  | 'session_started'
  | 'activity_interval'
  | 'session_ended'
  | 'lookup_requested'
  | 'lookup_succeeded'
  | 'lookup_failed'
  | 'word_saved'
  | 'word_removed'
  | 'practice_started'
  | 'practice_submitted'
  | 'practice_completed'
  | 'lesson_started'
  | 'lesson_completed'
  | 'media_error'
  | 'request_timeout';

export type LearningModule =
  | 'system'
  | 'search'
  | 'notebook'
  | 'review'
  | 'conjugation'
  | 'dictation'
  | 'listening';

interface SessionPayload {
  id: string;
  user_id: string;
  visitor_id: string | null;
  site: 'domestic' | 'backup' | 'local';
  client_instance_id: string;
  device_category: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  started_at: string;
  last_active_at: string;
  ended_at: string | null;
  active_seconds: number;
  end_reason: 'idle' | 'hidden' | 'logout' | 'account_changed' | 'closed' | 'unknown' | null;
}

interface EventPayload {
  id: string;
  session_id: string;
  user_id: string;
  event_type: LearningEventType;
  module: LearningModule;
  target_id: string | null;
  attempt_id: string | null;
  sequence_no: number;
  occurred_at: string;
  properties: Record<string, unknown>;
  schema_version: number;
  environment: 'production' | 'test';
}

interface AnalyticsQueue {
  sessions: SessionPayload[];
  events: EventPayload[];
}

interface TrackOptions {
  ownerUserId?: string | null;
  targetId?: string;
  attemptId?: string;
  properties?: Record<string, unknown>;
}

const QUEUE_KEY = 'ouioui_learning_analytics_queue_v1';
const CURRENT_SESSION_KEY = 'ouioui_learning_current_session_v1';
const CLIENT_INSTANCE_KEY = 'ouioui_client_instance_id';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const FLUSH_INTERVAL_MS = 15_000;
const MAX_QUEUED_EVENTS = 500;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

let activeUserId: string | null = null;
let currentSession: SessionPayload | null = null;
let sequenceNo = 0;
let lastActivityAt = 0;
let flushTimer: number | null = null;
let flushPromise: Promise<void> | null = null;
let listenersAttached = false;
let retryDelay = FLUSH_INTERVAL_MS;
let queueMemory: AnalyticsQueue = { sessions: [], events: [] };
let storageKey = QUEUE_KEY;

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = character === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
};

export const createLearningAttemptId = randomId;

const readQueue = (): AnalyticsQueue => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(parsed?.sessions) && Array.isArray(parsed?.events)) queueMemory = parsed;
  } catch {}
  return queueMemory;
};

const saveQueue = (queue: AnalyticsQueue) => {
  queue.events = queue.events.filter(event => Date.now() - Date.parse(event.occurred_at) < RETENTION_MS).slice(-MAX_QUEUED_EVENTS);
  const eventSessionIds = new Set(queue.events.map((event) => event.session_id));
  queue.sessions = queue.sessions.filter((session) => eventSessionIds.has(session.id));
  queueMemory = queue;
  try {
    localStorage.setItem(storageKey, JSON.stringify(queue));
  } catch {}
};

const getPersistentId = (key: string) => {
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const value = randomId();
    sessionStorage.setItem(key, value);
    return value;
  } catch { return randomId(); }
};

const getSite = (): SessionPayload['site'] => {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'ouiouiai.com' || hostname === 'www.ouiouiai.com') return 'domestic';
  if (hostname.endsWith('.pages.dev')) return 'backup';
  return 'local';
};

const getDeviceCategory = (): SessionPayload['device_category'] => {
  if (window.innerWidth < 768) return 'mobile';
  if (window.innerWidth < 1100) return 'tablet';
  return 'desktop';
};

const upsertQueuedSession = (queue: AnalyticsQueue, session: SessionPayload) => {
  const index = queue.sessions.findIndex((item) => item.id === session.id);
  if (index >= 0) queue.sessions[index] = { ...session };
  else queue.sessions.push({ ...session });
};

const persistCurrentSession = () => {
  try {
    if (currentSession) sessionStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify({ ...currentSession, sequence_no: sequenceNo }));
    else sessionStorage.removeItem(CURRENT_SESSION_KEY);
  } catch {}
};

const scheduleFlush = (immediate = false) => {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushLearningEvents();
  }, immediate ? 0 : retryDelay);
};

const createSession = (userId: string): SessionPayload => {
  const now = new Date().toISOString();
  return {
    id: randomId(),
    user_id: userId,
    visitor_id: null,
    site: getSite(),
    client_instance_id: getPersistentId(CLIENT_INSTANCE_KEY),
    device_category: getDeviceCategory(),
    started_at: now,
    last_active_at: now,
    ended_at: null,
    active_seconds: 0,
    end_reason: null,
  };
};

const restoreSession = (userId: string): SessionPayload | null => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CURRENT_SESSION_KEY) || 'null') as (SessionPayload & { sequence_no?: number }) | null;
    if (!stored || stored.user_id !== userId || stored.ended_at) return null;
    const age = Date.now() - new Date(stored.last_active_at).getTime();
    if (age < 0 || age > SESSION_TIMEOUT_MS || stored.site !== getSite()) return null;
    sequenceNo = stored.sequence_no ?? 0;
    return stored;
  } catch {
    return null;
  }
};

const appendEvent = (
  eventType: LearningEventType,
  module: LearningModule,
  options: TrackOptions = {},
) => {
  if (!activeUserId || !currentSession) return;
  if ('ownerUserId' in options && options.ownerUserId !== activeUserId) return;

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  if (eventType !== 'session_ended' && nowMs - Date.parse(currentSession.last_active_at) > SESSION_TIMEOUT_MS) {
    currentSession.ended_at = currentSession.last_active_at;
    currentSession.end_reason = 'idle';
    const oldQueue = readQueue();
    upsertQueuedSession(oldQueue, currentSession);
    saveQueue(oldQueue);
    currentSession = createSession(activeUserId);
    sequenceNo = 0;
    appendEvent('session_started', 'system');
  }
  // Event gaps are not evidence of active study time. Duration stays unknown in phase 1.
  lastActivityAt = nowMs;
  currentSession.last_active_at = now;

  const event: EventPayload = {
    id: randomId(),
    session_id: currentSession.id,
    user_id: activeUserId,
    event_type: eventType,
    module,
    target_id: options.targetId?.slice(0, 160) || null,
    attempt_id: options.attemptId || null,
    sequence_no: sequenceNo++,
    occurred_at: now,
    properties: options.properties ?? {},
    schema_version: 1,
    environment: getSite() === 'local' ? 'test' : 'production',
  };

  const queue = readQueue();
  upsertQueuedSession(queue, currentSession);
  queue.events.push(event);
  saveQueue(queue);
  persistCurrentSession();
  scheduleFlush(queue.events.filter((item) => item.user_id === activeUserId).length >= 10);
};

const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;
  window.addEventListener('online', () => scheduleFlush(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') scheduleFlush(true);
  });
};

export const startLearningAnalytics = (userId: string) => {
  if (activeUserId === userId && currentSession) return;

  if (activeUserId) endLearningSession('account_changed');
  activeUserId = userId;
  storageKey = `${QUEUE_KEY}:${getPersistentId(CLIENT_INSTANCE_KEY)}`;
  const restored = restoreSession(userId);
  currentSession = restored ?? createSession(userId);
  sequenceNo = readQueue().events
    .filter((event) => event.session_id === currentSession?.id)
    .reduce((max, event) => Math.max(max, event.sequence_no + 1), restored ? sequenceNo : 0);
  lastActivityAt = Date.now();
  persistCurrentSession();
  attachListeners();

  if (!restored) appendEvent('session_started', 'system');
  else scheduleFlush(true);
};

export const trackLearningEvent = (
  eventType: LearningEventType,
  module: LearningModule,
  options: TrackOptions = {},
) => { try { appendEvent(eventType, module, options); } catch {} };

export const captureLearningIdentity = () => activeUserId;

export const flushLearningEvents = async () => {
  if (flushPromise) return flushPromise;
  if (!activeUserId || !navigator.onLine) return;

  flushPromise = (async () => {
    const userId = activeUserId;
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session || authData.session.user.id !== userId || activeUserId !== userId) return;
    const accessToken = authData.session.access_token;
    const queue = readQueue();
    const sessions = queue.sessions.filter((session) => session.user_id === userId);

    for (const session of sessions) {
      if (activeUserId !== userId) break;
      const events = queue.events
        .filter((event) => event.user_id === userId && event.session_id === session.id)
        .slice(0, 50);
      if (events.length === 0) continue;

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      let result;
      try {
        result = await supabase.rpc('ingest_learning_batch', {
          requested_session: session,
          requested_events: events,
        }).setHeader('Authorization', `Bearer ${accessToken}`).abortSignal(controller.signal);
      } finally { window.clearTimeout(timeout); }
      if (result.error) throw result.error;
      retryDelay = FLUSH_INTERVAL_MS;

      const uploadedIds = new Set(events.map((event) => event.id));
      const latestQueue = readQueue();
      latestQueue.events = latestQueue.events.filter((event) => !uploadedIds.has(event.id));
      if (!latestQueue.events.some((event) => event.session_id === session.id)) {
        latestQueue.sessions = latestQueue.sessions.filter((item) => item.id !== session.id);
      }
      saveQueue(latestQueue);
    }
  })().catch(() => { retryDelay = Math.min(120000, retryDelay * 2); }).finally(() => {
    flushPromise = null;
    if (activeUserId && readQueue().events.some(event => event.user_id === activeUserId)) scheduleFlush();
  });

  return flushPromise;
};

export const endLearningSession = (
  reason: NonNullable<SessionPayload['end_reason']> = 'unknown',
) => {
  if (!currentSession) return;
  appendEvent('session_ended', 'system', { properties: { reason } });
  currentSession.ended_at = new Date().toISOString();
  currentSession.end_reason = reason;

  const queue = readQueue();
  upsertQueuedSession(queue, currentSession);
  saveQueue(queue);
  persistCurrentSession();
  currentSession = null;
  activeUserId = null;
  lastActivityAt = 0;
  persistCurrentSession();
  if (flushTimer !== null) window.clearTimeout(flushTimer);
  flushTimer = null;
};

export const resetLearningAnalytics = () => {
  endLearningSession('account_changed');
};
