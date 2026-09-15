import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';

function harness({ blockedStorage = false, local = new Map(), tab = new Map() } = {}) {
  let now = Date.now(), authUser = 'student-a', failUpload = false;
  const timers = new Map(), uploads = [];
  const storage = values => ({
    getItem: key => { if (blockedStorage) throw Error('blocked'); return values.get(key) ?? null; },
    setItem: (key, value) => { if (blockedStorage) throw Error('blocked'); values.set(key, value); },
    removeItem: key => values.delete(key),
  });
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: authUser }, access_token: `token-${authUser}` } } }) },
    rpc: (_name, payload) => {
      const headers = {};
      return {
        setHeader(key, value) { headers[key] = value; return this; },
        abortSignal() { return this; },
        then(resolve) { uploads.push({ payload: structuredClone(payload), headers }); return Promise.resolve({ error: failUpload ? Error('offline') : null }).then(resolve); },
      };
    },
  };
  const module = { exports: {} };
  const context = {
    exports: module.exports, module,
    require: () => ({ supabase }),
    localStorage: storage(local), sessionStorage: storage(tab),
    navigator: { onLine: true }, document: { visibilityState: 'visible', addEventListener() {} },
    window: { innerWidth: 390, location: { hostname: 'ouiouiai.com' }, addEventListener() {},
      setTimeout(fn, delay) { const id = randomUUID(); timers.set(id, { fn, delay }); return id; },
      clearTimeout(id) { timers.delete(id); } },
    crypto: { randomUUID }, AbortController,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
  };
  const source = fs.readFileSync(new URL('../services/learningAnalyticsService.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { api: module.exports, uploads, timers, local, tab, advance: n => now += n, auth: id => authUser = id, fail: value => failUpload = value };
}

test('analytics does not block learning when browser storage is denied', async () => {
  const h = harness({ blockedStorage: true });
  assert.doesNotThrow(() => h.api.startLearningAnalytics('student-a'));
  assert.doesNotThrow(() => h.api.trackLearningEvent('word_saved', 'notebook'));
  await h.api.flushLearningEvents();
  assert.equal(h.uploads[0].payload.requested_events.length, 2);
});

test('analytics keeps offline events, retries, drains batches and pins the user token', async () => {
  const h = harness();
  h.api.startLearningAnalytics('student-a');
  for (let n = 0; n < 75; n++) h.api.trackLearningEvent('word_saved', 'notebook');
  h.fail(true);
  await h.api.flushLearningEvents();
  const firstIds = h.uploads[0].payload.requested_events.map(event => event.id);
  h.fail(false);
  await h.api.flushLearningEvents();
  assert.deepEqual(h.uploads[1].payload.requested_events.map(event => event.id), firstIds);
  await h.api.flushLearningEvents();
  assert.equal(h.uploads[2].payload.requested_events.length, 26);
  assert.equal(h.uploads[1].headers.Authorization, 'Bearer token-student-a');
  assert.equal(h.uploads[1].payload.requested_session.active_seconds, 0);
});

test('logout is synchronous and old events cannot be uploaded using a new account', async () => {
  const h = harness();
  h.api.startLearningAnalytics('student-a');
  const owner = h.api.captureLearningIdentity();
  assert.equal(h.api.endLearningSession('logout'), undefined);
  h.api.startLearningAnalytics('student-b');
  h.auth('student-b');
  h.api.trackLearningEvent('lookup_succeeded', 'search', { ownerUserId: owner });
  await h.api.flushLearningEvents();
  assert.equal(h.uploads.length, 1);
  assert.ok(h.uploads[0].payload.requested_events.every(event => event.user_id === 'student-b'));
  assert.ok(h.uploads[0].payload.requested_events.every(event => event.event_type !== 'lookup_succeeded'));
});

test('30 minutes of inactivity starts a new session without inventing active time', async () => {
  const h = harness();
  h.api.startLearningAnalytics('student-a');
  h.api.trackLearningEvent('word_saved', 'notebook');
  h.advance(31 * 60 * 1000);
  h.api.trackLearningEvent('word_saved', 'notebook');
  await h.api.flushLearningEvents();
  assert.equal(h.uploads.length, 2);
  assert.notEqual(h.uploads[0].payload.requested_session.id, h.uploads[1].payload.requested_session.id);
  assert.ok(h.uploads.every(upload => upload.payload.requested_session.active_seconds === 0));
});

test('reload restores the session without duplicate start events', async () => {
  const first = harness();
  first.api.startLearningAnalytics('student-a');
  await first.api.flushLearningEvents();
  const next = harness({ local: first.local, tab: first.tab });
  next.api.startLearningAnalytics('student-a');
  next.api.trackLearningEvent('word_saved', 'notebook');
  await next.api.flushLearningEvents();
  assert.equal(next.uploads[0].payload.requested_session.id, first.uploads[0].payload.requested_session.id);
  assert.equal(next.uploads[0].payload.requested_events.filter(event => event.event_type === 'session_started').length, 0);
});
