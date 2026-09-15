-- Apply after 0003. Only the new analytics objects are affected.
begin;

revoke all on public.learner_profiles, public.classes, public.class_memberships,
  public.learning_sessions, public.learning_events from public, anon, authenticated;
grant select on public.learner_profiles, public.classes, public.class_memberships,
  public.learning_sessions, public.learning_events to authenticated;
grant insert, update, delete on public.classes to authenticated;
-- Membership identity is created only by the invite RPC, not arbitrary teacher inserts.
grant update (status, research_id) on public.class_memberships to authenticated;

create or replace function public.teacher_owns_class(requested_class_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_is_teacher() and exists (
    select 1 from public.classes
    where id = requested_class_id and teacher_id = auth.uid() and is_active
  );
$$;

create or replace function public.teacher_can_view_user(requested_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_is_teacher() and exists (
    select 1 from public.classes c
    join public.class_memberships m on m.class_id = c.id
    where c.teacher_id = auth.uid() and c.is_active
      and m.user_id = requested_user_id and m.status = 'active'
  );
$$;

-- A stable pseudonym is assigned once, including for existing profiles.
alter table public.learner_profiles alter column research_id
  set default ('FLE-' || replace(gen_random_uuid()::text, '-', ''));
update public.learner_profiles set research_id = 'FLE-' || replace(gen_random_uuid()::text, '-', '')
  where research_id is null;

do $$
begin
  if to_regprocedure('public.ingest_learning_batch_internal(jsonb,jsonb)') is null then
    alter function public.ingest_learning_batch(jsonb, jsonb) rename to ingest_learning_batch_internal;
  end if;
end;
$$;
revoke all on function public.ingest_learning_batch_internal(jsonb, jsonb) from public, anon, authenticated;

create or replace function public.ingest_learning_batch(requested_session jsonb, requested_events jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  sid uuid;
  item jsonb;
  existing public.learning_sessions;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(requested_session) is distinct from 'object'
     or jsonb_typeof(requested_events) is distinct from 'array' then
    raise exception 'Invalid batch shape';
  end if;
  if (requested_session ->> 'user_id')::uuid is distinct from owner_id then
    raise exception 'Session identity mismatch';
  end if;
  if jsonb_array_length(requested_events) not between 1 and 50
     or octet_length(requested_events::text) > 131072 then
    raise exception 'Invalid batch size';
  end if;
  sid := (requested_session ->> 'id')::uuid;
  select * into existing from public.learning_sessions where id = sid;
  if found and (existing.user_id <> owner_id
     or existing.site is distinct from requested_session ->> 'site'
     or existing.client_instance_id is distinct from requested_session ->> 'client_instance_id'
     or existing.started_at is distinct from (requested_session ->> 'started_at')::timestamptz) then
    raise exception 'Session ownership or metadata mismatch';
  end if;
  for item in select value from jsonb_array_elements(requested_events) loop
    if jsonb_typeof(item) is distinct from 'object'
       or (item ->> 'user_id')::uuid is distinct from owner_id
       or (item ->> 'session_id')::uuid is distinct from sid then
      raise exception 'Event identity mismatch';
    end if;
    if (item ->> 'occurred_at')::timestamptz < now() - interval '7 days'
       or (item ->> 'occurred_at')::timestamptz > now() + interval '5 minutes' then
      raise exception 'Event time outside upload window';
    end if;
    if exists (select 1 from public.learning_events e where e.id = (item ->> 'id')::uuid
      and (e.user_id <> owner_id or e.session_id <> sid)) then
      raise exception 'Event identity collision';
    end if;
  end loop;
  return public.ingest_learning_batch_internal(requested_session, requested_events);
end;
$$;
revoke all on function public.ingest_learning_batch(jsonb, jsonb) from public, anon;
grant execute on function public.ingest_learning_batch(jsonb, jsonb) to authenticated;
revoke all on function public.handle_new_ouioui_user(), public.touch_updated_at() from public, anon, authenticated;
commit;
