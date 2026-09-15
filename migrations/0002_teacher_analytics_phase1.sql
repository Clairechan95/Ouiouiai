-- OuiOui AI teacher analytics, phase 1.
-- This migration only adds new objects. Existing learning data tables are untouched.

create extension if not exists pgcrypto;

create table if not exists public.learner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'teacher')),
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  research_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default upper(encode(gen_random_bytes(5), 'hex')),
  teacher_id uuid not null references auth.users(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (teacher_id, name)
);

create table if not exists public.class_memberships (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  student_number text check (student_number is null or char_length(student_number) <= 40),
  research_id text check (research_id is null or char_length(research_id) <= 40),
  status text not null default 'active' check (status in ('active', 'inactive')),
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id),
  unique (class_id, research_id)
);

create table if not exists public.learning_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  visitor_id text check (visitor_id is null or char_length(visitor_id) <= 100),
  site text not null check (site in ('domestic', 'backup', 'local')),
  client_instance_id text not null check (char_length(client_instance_id) between 1 and 100),
  device_category text check (device_category in ('mobile', 'tablet', 'desktop', 'unknown')),
  started_at timestamptz not null,
  last_active_at timestamptz not null,
  ended_at timestamptz,
  active_seconds integer not null default 0 check (active_seconds between 0 and 86400),
  end_reason text check (
    end_reason is null or end_reason in ('idle', 'hidden', 'logout', 'account_changed', 'closed', 'unknown')
  ),
  created_at timestamptz not null default now(),
  check (last_active_at >= started_at),
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.learning_events (
  id uuid primary key,
  session_id uuid not null references public.learning_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'session_started', 'activity_interval', 'session_ended',
      'lookup_requested', 'lookup_succeeded', 'lookup_failed',
      'word_saved', 'word_removed',
      'practice_started', 'practice_submitted', 'practice_completed',
      'lesson_started', 'lesson_completed',
      'media_error', 'request_timeout'
    )
  ),
  module text not null check (
    module in ('system', 'search', 'notebook', 'review', 'conjugation', 'dictation', 'listening')
  ),
  target_id text check (target_id is null or char_length(target_id) <= 160),
  attempt_id uuid,
  sequence_no integer not null check (sequence_no >= 0),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  properties jsonb not null default '{}'::jsonb,
  schema_version smallint not null default 1 check (schema_version > 0),
  environment text not null default 'production' check (environment in ('production', 'test')),
  check (jsonb_typeof(properties) = 'object'),
  check (octet_length(properties::text) <= 16384)
);

create index if not exists idx_class_memberships_user
  on public.class_memberships (user_id, status);

create index if not exists idx_learning_sessions_user_started
  on public.learning_sessions (user_id, started_at desc);

create index if not exists idx_learning_events_user_occurred
  on public.learning_events (user_id, occurred_at desc);

create index if not exists idx_learning_events_session_occurred
  on public.learning_events (session_id, occurred_at, sequence_no);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists learner_profiles_touch_updated_at on public.learner_profiles;
create trigger learner_profiles_touch_updated_at
before update on public.learner_profiles
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_ouioui_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.learner_profiles (user_id, display_name)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_ouioui_profile on auth.users;
create trigger on_auth_user_created_create_ouioui_profile
after insert on auth.users
for each row execute function public.handle_new_ouioui_user();

insert into public.learner_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.current_user_is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.learner_profiles
    where user_id = auth.uid() and role = 'teacher'
  );
$$;

create or replace function public.teacher_owns_class(requested_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes
    where id = requested_class_id and teacher_id = auth.uid()
  );
$$;

create or replace function public.user_is_class_member(requested_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_memberships
    where class_id = requested_class_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.teacher_can_view_user(requested_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    join public.class_memberships cm on cm.class_id = c.id
    where c.teacher_id = auth.uid()
      and cm.user_id = requested_user_id
  );
$$;

create or replace function public.update_my_learner_profile(requested_display_name text)
returns public.learner_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.learner_profiles;
  cleaned_name text := nullif(left(trim(coalesce(requested_display_name, '')), 60), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.learner_profiles (user_id, display_name)
  values (auth.uid(), cleaned_name)
  on conflict (user_id) do update set display_name = excluded.display_name
  returning * into result;

  return result;
end;
$$;

create or replace function public.join_class_by_invite(
  requested_invite_code text,
  requested_display_name text default null,
  requested_student_number text default null
)
returns table (class_id uuid, class_name text, joined_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_class public.classes;
  cleaned_code text := upper(trim(coalesce(requested_invite_code, '')));
  cleaned_name text := nullif(left(trim(coalesce(requested_display_name, '')), 60), '');
  cleaned_student_number text := nullif(left(trim(coalesce(requested_student_number, '')), 40), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into matched_class
  from public.classes
  where invite_code = cleaned_code and is_active = true;

  if not found then
    raise exception 'Invalid class invite code';
  end if;

  insert into public.learner_profiles (user_id, display_name)
  values (auth.uid(), cleaned_name)
  on conflict (user_id) do update
    set display_name = coalesce(excluded.display_name, public.learner_profiles.display_name);

  insert into public.class_memberships (class_id, user_id, student_number, status)
  values (matched_class.id, auth.uid(), cleaned_student_number, 'active')
  on conflict on constraint class_memberships_pkey do update
    set student_number = coalesce(excluded.student_number, public.class_memberships.student_number),
        status = 'active'
  returning class_memberships.joined_at into joined_at;

  class_id := matched_class.id;
  class_name := matched_class.name;
  return next;
end;
$$;

alter table public.learner_profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_memberships enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.learning_events enable row level security;

drop policy if exists learner_profiles_select on public.learner_profiles;
create policy learner_profiles_select on public.learner_profiles
for select to authenticated
using (user_id = auth.uid() or public.teacher_can_view_user(user_id));

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
for select to authenticated
using (teacher_id = auth.uid() or public.user_is_class_member(id));

drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes
for insert to authenticated
with check (teacher_id = auth.uid() and public.current_user_is_teacher());

drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes
for update to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid() and public.current_user_is_teacher());

drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes
for delete to authenticated
using (teacher_id = auth.uid() and public.current_user_is_teacher());

drop policy if exists class_memberships_select on public.class_memberships;
create policy class_memberships_select on public.class_memberships
for select to authenticated
using (user_id = auth.uid() or public.teacher_owns_class(class_id));

drop policy if exists class_memberships_insert_by_teacher on public.class_memberships;
create policy class_memberships_insert_by_teacher on public.class_memberships
for insert to authenticated
with check (public.teacher_owns_class(class_id));

drop policy if exists class_memberships_update_by_teacher on public.class_memberships;
create policy class_memberships_update_by_teacher on public.class_memberships
for update to authenticated
using (public.teacher_owns_class(class_id))
with check (public.teacher_owns_class(class_id));

drop policy if exists class_memberships_delete_by_teacher on public.class_memberships;
create policy class_memberships_delete_by_teacher on public.class_memberships
for delete to authenticated
using (public.teacher_owns_class(class_id));

drop policy if exists learning_sessions_select on public.learning_sessions;
create policy learning_sessions_select on public.learning_sessions
for select to authenticated
using (user_id = auth.uid() or public.teacher_can_view_user(user_id));

drop policy if exists learning_sessions_insert on public.learning_sessions;
create policy learning_sessions_insert on public.learning_sessions
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists learning_sessions_update on public.learning_sessions;
create policy learning_sessions_update on public.learning_sessions
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists learning_events_select on public.learning_events;
create policy learning_events_select on public.learning_events
for select to authenticated
using (user_id = auth.uid() or public.teacher_can_view_user(user_id));

drop policy if exists learning_events_insert on public.learning_events;
create policy learning_events_insert on public.learning_events
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.learning_sessions s
    where s.id = learning_events.session_id and s.user_id = auth.uid()
  )
);

revoke all on public.learner_profiles from anon;
revoke all on public.classes from anon;
revoke all on public.class_memberships from anon;
revoke all on public.learning_sessions from anon;
revoke all on public.learning_events from anon;

grant select on public.learner_profiles to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.class_memberships to authenticated;
grant select, insert, update on public.learning_sessions to authenticated;
grant select, insert on public.learning_events to authenticated;

revoke all on function public.current_user_is_teacher() from public;
revoke all on function public.teacher_owns_class(uuid) from public;
revoke all on function public.user_is_class_member(uuid) from public;
revoke all on function public.teacher_can_view_user(uuid) from public;
revoke all on function public.update_my_learner_profile(text) from public;
revoke all on function public.join_class_by_invite(text, text, text) from public;

grant execute on function public.current_user_is_teacher() to authenticated;
grant execute on function public.teacher_owns_class(uuid) to authenticated;
grant execute on function public.user_is_class_member(uuid) to authenticated;
grant execute on function public.teacher_can_view_user(uuid) to authenticated;
grant execute on function public.update_my_learner_profile(text) to authenticated;
grant execute on function public.join_class_by_invite(text, text, text) to authenticated;
