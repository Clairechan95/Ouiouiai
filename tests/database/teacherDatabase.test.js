import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(process.env.OUIOUI_DB_TEST_RUNTIME || import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

test('teacher database: real PostgreSQL migrations, ownership and retry isolation', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated;
    `);
    for (const file of ['0002_teacher_analytics_phase1.sql', '0003_learning_event_ingest.sql', '0004_analytics_access_guards.sql', '0004_analytics_access_guards.sql']) {
      await db.exec(await readFile(new URL(`../../migrations/${file}`, import.meta.url), 'utf8'));
    }
    const [teacher, otherTeacher, student, otherStudent] = Array.from({ length: 4 }, randomUUID);
    for (const id of [teacher, otherTeacher, student, otherStudent]) {
      await db.query('insert into auth.users(id,email) values ($1,$2)', [id, `${id}@example.test`]);
    }
    await db.query("update learner_profiles set role='teacher' where user_id in ($1,$2)", [teacher, otherTeacher]);
    const classA = randomUUID(), classB = randomUUID();
    await db.query('insert into classes(id,name,teacher_id,invite_code) values ($1,$2,$3,$4),($5,$6,$7,$8)',
      [classA, 'Class A', teacher, 'TESTCODEA', classB, 'Class B', otherTeacher, 'TESTCODEB']);
    const login = async (id, role = 'authenticated') => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec(`set role ${role}`);
    };
    await login(student);
    await db.query('select * from join_class_by_invite($1,$2,$3)', ['TESTCODEA', 'Student A', '001']);
    await db.query('select * from join_class_by_invite($1,$2,$3)', ['TESTCODEA', 'Student A', '001']);
    assert.equal((await db.query('select * from class_memberships')).rows.length, 1);
    await assert.rejects(db.exec("update learner_profiles set role='teacher'"), /permission denied/);
    await assert.rejects(db.exec('truncate learning_events'), /permission denied/);
    await login(otherStudent);
    await db.query('select * from join_class_by_invite($1,$2,$3)', ['TESTCODEB', 'Student B', '002']);

    const now = new Date().toISOString();
    const session = { id: randomUUID(), user_id: student, site: 'domestic', client_instance_id: randomUUID(), started_at: now, last_active_at: now, active_seconds: 0 };
    const event = { id: randomUUID(), session_id: session.id, user_id: student, event_type: 'lookup_succeeded', module: 'search', sequence_no: 0, occurred_at: now, properties: { cache_hit: true } };
    const ingest = (s, events) => db.query('select ingest_learning_batch($1::jsonb,$2::jsonb) as n', [JSON.stringify(s), JSON.stringify(events)]);
    await assert.rejects(ingest(session, [event]), /identity mismatch/);
    await login(student);
    assert.equal((await ingest(session, [event])).rows[0].n, 1);
    assert.equal((await ingest(session, [event])).rows[0].n, 0);
    assert.equal((await db.query('select * from learning_events')).rows.length, 1);
    await assert.rejects(ingest(session, [{ ...event, user_id: otherStudent }]), /identity mismatch/);
    await assert.rejects(ingest({ ...session, site: 'backup' }, [event]), /metadata mismatch/);
    await assert.rejects(ingest(session, Array(51).fill(event)), /batch size/);
    await assert.rejects(db.query('select ingest_learning_batch_internal($1,$2)', [JSON.stringify(session), JSON.stringify([event])]), /permission denied/);
    await login(teacher);
    assert.equal((await db.query('select * from learning_events')).rows.length, 1);
    await assert.rejects(db.query('insert into class_memberships(class_id,user_id) values($1,$2)', [classA, otherStudent]), /permission denied/);
    await assert.rejects(db.query('update class_memberships set user_id=$1', [otherStudent]), /permission denied/);
    await login(otherTeacher);
    assert.equal((await db.query('select * from learning_events')).rows.length, 0);
    await login(teacher);
    await db.exec("update class_memberships set status='inactive'");
    assert.equal((await db.query('select * from learning_events')).rows.length, 0);
    await login('', 'anon');
    await assert.rejects(db.query('select * from learner_profiles'), /permission denied/);
    await assert.rejects(ingest(session, [event]), /permission denied/);
  } finally { await db.close(); }
});
