-- Authenticated, idempotent batch ingestion for phase-1 learning analytics.

create or replace function public.ingest_learning_batch(
  requested_session jsonb,
  requested_events jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  requested_session_id uuid;
  event_item jsonb;
  inserted_count integer := 0;
  row_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(requested_session) <> 'object' then
    raise exception 'Session payload must be an object';
  end if;

  if jsonb_typeof(requested_events) <> 'array' then
    raise exception 'Events payload must be an array';
  end if;

  if jsonb_array_length(requested_events) > 50 then
    raise exception 'A batch cannot contain more than 50 events';
  end if;

  requested_session_id := (requested_session ->> 'id')::uuid;

  insert into public.learning_sessions (
    id,
    user_id,
    visitor_id,
    site,
    client_instance_id,
    device_category,
    started_at,
    last_active_at,
    ended_at,
    active_seconds,
    end_reason
  ) values (
    requested_session_id,
    current_user_id,
    nullif(requested_session ->> 'visitor_id', ''),
    requested_session ->> 'site',
    requested_session ->> 'client_instance_id',
    coalesce(nullif(requested_session ->> 'device_category', ''), 'unknown'),
    (requested_session ->> 'started_at')::timestamptz,
    (requested_session ->> 'last_active_at')::timestamptz,
    case
      when nullif(requested_session ->> 'ended_at', '') is null then null
      else (requested_session ->> 'ended_at')::timestamptz
    end,
    coalesce((requested_session ->> 'active_seconds')::integer, 0),
    nullif(requested_session ->> 'end_reason', '')
  )
  on conflict (id) do update set
    last_active_at = greatest(public.learning_sessions.last_active_at, excluded.last_active_at),
    ended_at = coalesce(excluded.ended_at, public.learning_sessions.ended_at),
    active_seconds = greatest(public.learning_sessions.active_seconds, excluded.active_seconds),
    end_reason = coalesce(excluded.end_reason, public.learning_sessions.end_reason)
  where public.learning_sessions.user_id = current_user_id;

  if not exists (
    select 1
    from public.learning_sessions
    where id = requested_session_id and user_id = current_user_id
  ) then
    raise exception 'Session does not belong to the authenticated user';
  end if;

  for event_item in select value from jsonb_array_elements(requested_events)
  loop
    insert into public.learning_events (
      id,
      session_id,
      user_id,
      event_type,
      module,
      target_id,
      attempt_id,
      sequence_no,
      occurred_at,
      properties,
      schema_version,
      environment
    ) values (
      (event_item ->> 'id')::uuid,
      requested_session_id,
      current_user_id,
      event_item ->> 'event_type',
      event_item ->> 'module',
      nullif(event_item ->> 'target_id', ''),
      case
        when nullif(event_item ->> 'attempt_id', '') is null then null
        else (event_item ->> 'attempt_id')::uuid
      end,
      (event_item ->> 'sequence_no')::integer,
      (event_item ->> 'occurred_at')::timestamptz,
      coalesce(event_item -> 'properties', '{}'::jsonb),
      coalesce((event_item ->> 'schema_version')::smallint, 1),
      coalesce(nullif(event_item ->> 'environment', ''), 'production')
    )
    on conflict (id) do nothing;

    get diagnostics row_count = row_count;
    inserted_count := inserted_count + row_count;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.ingest_learning_batch(jsonb, jsonb) from public;
grant execute on function public.ingest_learning_batch(jsonb, jsonb) to authenticated;
