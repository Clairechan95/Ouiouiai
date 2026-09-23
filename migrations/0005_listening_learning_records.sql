-- Resumable listening-course progress and completed learning portfolios.
-- This migration is additive and does not alter existing learning-event data.

begin;

create table if not exists public.listening_learning_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null check (char_length(course_id) between 1 and 80),
  content_version smallint not null default 1 check (content_version > 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  current_step smallint not null default 0 check (current_step between 0 and 5),
  max_step smallint not null default 0 check (max_step between 0 and 5),
  progress_state jsonb not null default '{}'::jsonb,
  learning_archive jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id),
  check (jsonb_typeof(progress_state) = 'object'),
  check (learning_archive is null or jsonb_typeof(learning_archive) = 'object'),
  check (octet_length(progress_state::text) <= 131072),
  check (learning_archive is null or octet_length(learning_archive::text) <= 65536)
);

create index if not exists idx_listening_records_user_updated
  on public.listening_learning_records (user_id, updated_at desc);

alter table public.listening_learning_records enable row level security;

drop policy if exists listening_records_select on public.listening_learning_records;
create policy listening_records_select on public.listening_learning_records
for select to authenticated
using (user_id = auth.uid() or public.teacher_can_view_user(user_id));

drop policy if exists listening_records_insert on public.listening_learning_records;
create policy listening_records_insert on public.listening_learning_records
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists listening_records_update on public.listening_learning_records;
create policy listening_records_update on public.listening_learning_records
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists listening_records_delete on public.listening_learning_records;
create policy listening_records_delete on public.listening_learning_records
for delete to authenticated
using (user_id = auth.uid());

revoke all on public.listening_learning_records from public, anon, authenticated;
grant select, insert, update, delete on public.listening_learning_records to authenticated;

commit;
