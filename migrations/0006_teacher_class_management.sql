-- Teacher-managed classes and memberships.
-- Apply after 0005. Existing classes, members and learning records are preserved.
begin;

alter table public.class_memberships
  add column if not exists display_name_override text
  check (display_name_override is null or char_length(display_name_override) between 1 and 60);

create or replace function public.create_teacher_class(requested_name text)
returns table (id uuid, name text, invite_code text, teacher_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_name text := nullif(left(trim(coalesce(requested_name, '')), 80), '');
  created_class public.classes;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.current_user_is_teacher() then raise exception 'Teacher role required'; end if;
  if cleaned_name is null then raise exception 'Class name required'; end if;

  insert into public.classes (name, teacher_id)
  values (cleaned_name, auth.uid())
  returning * into created_class;

  return query select created_class.id, created_class.name, created_class.invite_code, created_class.teacher_id;
exception
  when unique_violation then raise exception 'Class name already exists';
end;
$$;

create or replace function public.rename_teacher_class(requested_class_id uuid, requested_name text)
returns table (id uuid, name text, invite_code text, teacher_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_name text := nullif(left(trim(coalesce(requested_name, '')), 80), '');
  changed_class public.classes;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.teacher_owns_class(requested_class_id) then raise exception 'Class management denied'; end if;
  if cleaned_name is null then raise exception 'Class name required'; end if;

  update public.classes
  set name = cleaned_name
  where classes.id = requested_class_id
  returning * into changed_class;

  return query select changed_class.id, changed_class.name, changed_class.invite_code, changed_class.teacher_id;
exception
  when unique_violation then raise exception 'Class name already exists';
end;
$$;

create or replace function public.regenerate_class_invite(requested_class_id uuid)
returns table (id uuid, name text, invite_code text, teacher_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_class public.classes;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.teacher_owns_class(requested_class_id) then raise exception 'Class management denied'; end if;

  loop
    begin
      update public.classes
      set invite_code = upper(encode(gen_random_bytes(5), 'hex'))
      where classes.id = requested_class_id
      returning * into changed_class;
      exit;
    exception when unique_violation then
      -- A collision is extremely unlikely; retry without exposing another class's code.
    end;
  end loop;

  return query select changed_class.id, changed_class.name, changed_class.invite_code, changed_class.teacher_id;
end;
$$;

create or replace function public.add_registered_learner_to_class(
  requested_class_id uuid,
  requested_email text,
  requested_display_name text default null,
  requested_student_number text default null
)
returns table (
  class_id uuid,
  user_id uuid,
  display_name text,
  student_number text,
  research_id text,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_email text := lower(trim(coalesce(requested_email, '')));
  cleaned_name text := nullif(left(trim(coalesce(requested_display_name, '')), 60), '');
  cleaned_student_number text := nullif(left(trim(coalesce(requested_student_number, '')), 40), '');
  matched_user_id uuid;
  matched_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.teacher_owns_class(requested_class_id) then raise exception 'Class management denied'; end if;
  if cleaned_email = '' then raise exception 'Registered email required'; end if;

  select users.id into matched_user_id
  from auth.users as users
  where lower(users.email) = cleaned_email
  limit 1;

  if matched_user_id is null then raise exception 'Registered account not found'; end if;

  select profiles.role into matched_role
  from public.learner_profiles as profiles
  where profiles.user_id = matched_user_id;
  if matched_role = 'teacher' then raise exception 'Teacher account cannot be added as learner'; end if;

  insert into public.learner_profiles (user_id)
  values (matched_user_id)
  on conflict on constraint learner_profiles_pkey do nothing;

  insert into public.class_memberships (class_id, user_id, display_name_override, student_number, status)
  values (requested_class_id, matched_user_id, cleaned_name, cleaned_student_number, 'active')
  on conflict on constraint class_memberships_pkey do update
    set display_name_override = coalesce(excluded.display_name_override, public.class_memberships.display_name_override),
        student_number = coalesce(excluded.student_number, public.class_memberships.student_number),
        status = 'active',
        joined_at = case
          when public.class_memberships.status = 'inactive' then now()
          else public.class_memberships.joined_at
        end;

  return query
  select memberships.class_id, memberships.user_id, coalesce(memberships.display_name_override, profiles.display_name),
    memberships.student_number, coalesce(memberships.research_id, profiles.research_id), memberships.status
  from public.class_memberships as memberships
  join public.learner_profiles as profiles on profiles.user_id = memberships.user_id
  where memberships.class_id = requested_class_id and memberships.user_id = matched_user_id;
end;
$$;

create or replace function public.update_class_learner(
  requested_class_id uuid,
  requested_user_id uuid,
  requested_display_name text,
  requested_student_number text
)
returns table (
  class_id uuid,
  user_id uuid,
  display_name text,
  student_number text,
  research_id text,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_name text := nullif(left(trim(coalesce(requested_display_name, '')), 60), '');
  cleaned_student_number text := nullif(left(trim(coalesce(requested_student_number, '')), 40), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.teacher_owns_class(requested_class_id) then raise exception 'Class management denied'; end if;
  if not exists (
    select 1 from public.class_memberships as memberships
    where memberships.class_id = requested_class_id
      and memberships.user_id = requested_user_id
      and memberships.status = 'active'
  ) then raise exception 'Active learner not found in class'; end if;

  update public.class_memberships as memberships
  set display_name_override = cleaned_name,
      student_number = cleaned_student_number
  where memberships.class_id = requested_class_id and memberships.user_id = requested_user_id;

  return query
  select memberships.class_id, memberships.user_id, coalesce(memberships.display_name_override, profiles.display_name),
    memberships.student_number, coalesce(memberships.research_id, profiles.research_id), memberships.status
  from public.class_memberships as memberships
  join public.learner_profiles as profiles on profiles.user_id = memberships.user_id
  where memberships.class_id = requested_class_id and memberships.user_id = requested_user_id;
end;
$$;

create or replace function public.remove_learner_from_class(requested_class_id uuid, requested_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_rows integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.teacher_owns_class(requested_class_id) then raise exception 'Class management denied'; end if;

  update public.class_memberships as memberships
  set status = 'inactive'
  where memberships.class_id = requested_class_id
    and memberships.user_id = requested_user_id
    and memberships.status = 'active';
  get diagnostics changed_rows = row_count;

  if changed_rows = 0 then raise exception 'Active learner not found in class'; end if;
  return true;
end;
$$;

revoke all on function public.create_teacher_class(text) from public, anon;
revoke all on function public.rename_teacher_class(uuid, text) from public, anon;
revoke all on function public.regenerate_class_invite(uuid) from public, anon;
revoke all on function public.add_registered_learner_to_class(uuid, text, text, text) from public, anon;
revoke all on function public.update_class_learner(uuid, uuid, text, text) from public, anon;
revoke all on function public.remove_learner_from_class(uuid, uuid) from public, anon;

grant execute on function public.create_teacher_class(text) to authenticated;
grant execute on function public.rename_teacher_class(uuid, text) to authenticated;
grant execute on function public.regenerate_class_invite(uuid) to authenticated;
grant execute on function public.add_registered_learner_to_class(uuid, text, text, text) to authenticated;
grant execute on function public.update_class_learner(uuid, uuid, text, text) to authenticated;
grant execute on function public.remove_learner_from_class(uuid, uuid) to authenticated;

commit;
