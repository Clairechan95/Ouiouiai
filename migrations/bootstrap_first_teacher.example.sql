-- Run this manually in the Supabase SQL editor after 0002_teacher_analytics_phase1.sql.
-- Replace both placeholders before running. Do not commit a filled-in copy.

do $$
declare
  teacher_user_id uuid;
begin
  select id into teacher_user_id
  from auth.users
  where lower(email) = lower('TEACHER_EMAIL_HERE')
  limit 1;

  if teacher_user_id is null then
    raise exception 'Teacher account not found. Register and verify the email first.';
  end if;

  insert into public.learner_profiles (user_id, role)
  values (teacher_user_id, 'teacher')
  on conflict (user_id) do update set role = 'teacher';

  insert into public.classes (name, teacher_id)
  values ('CLASS_NAME_HERE', teacher_user_id)
  on conflict (teacher_id, name) do update set is_active = true;
end;
$$;

select c.name, c.invite_code, u.email as teacher_email
from public.classes c
join auth.users u on u.id = c.teacher_id
where lower(u.email) = lower('TEACHER_EMAIL_HERE')
  and c.name = 'CLASS_NAME_HERE';
