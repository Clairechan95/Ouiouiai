import { supabase } from './supabaseClient';
import { LearnerProfile, OuiOuiClass } from './classService';

export interface TeacherMembership {
  class_id: string;
  user_id: string;
  student_number: string | null;
  research_id: string | null;
  status: 'active' | 'inactive';
  joined_at: string;
}

export interface TeacherSession {
  id: string;
  user_id: string;
  site: 'domestic' | 'backup' | 'local';
  device_category: 'mobile' | 'tablet' | 'desktop' | 'unknown' | null;
  started_at: string;
  last_active_at: string;
  ended_at: string | null;
  active_seconds: number;
  end_reason: string | null;
}

export interface TeacherEvent {
  id: string;
  session_id: string;
  user_id: string;
  event_type: string;
  module: string;
  target_id: string | null;
  occurred_at: string;
  properties: Record<string, unknown>;
}

export interface TeacherClassData {
  classInfo: OuiOuiClass;
  memberships: TeacherMembership[];
  profiles: LearnerProfile[];
  sessions: TeacherSession[];
  events: TeacherEvent[];
}

async function readPages<T>(query: (offset: number) => any): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await query(rows.length);
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
    if (rows.length > 50000) throw new Error('记录较多，请缩短统计范围后重试');
  }
}

export const fetchTeacherClassData = async (
  classInfo: OuiOuiClass,
  fromIso: string,
  signal?: AbortSignal,
): Promise<TeacherClassData> => {
  const throughIso = new Date().toISOString();
  const memberships = await readPages<TeacherMembership>(offset => supabase
    .from('class_memberships')
    .select('class_id, user_id, student_number, research_id, status, joined_at')
    .eq('class_id', classInfo.id)
    .eq('status', 'active')
    .order('user_id').range(offset, offset + 499).abortSignal(signal));
  const userIds = memberships.map((membership) => membership.user_id);

  if (userIds.length === 0) {
    return { classInfo, memberships, profiles: [], sessions: [], events: [] };
  }

  const profiles: LearnerProfile[] = [], sessions: TeacherSession[] = [], events: TeacherEvent[] = [];
  for (let offset = 0; offset < userIds.length; offset += 50) {
    const users = userIds.slice(offset, offset + 50);
    const [profileRows, sessionRows, eventRows] = await Promise.all([
    readPages<LearnerProfile>(page => supabase
      .from('learner_profiles')
      .select('user_id, role, display_name, research_id')
      .in('user_id', users).order('user_id').range(page, page + 499).abortSignal(signal)),
    readPages<TeacherSession>(page => supabase
      .from('learning_sessions')
      .select('id, user_id, site, device_category, started_at, last_active_at, ended_at, active_seconds, end_reason')
      .in('user_id', users)
      .neq('site', 'local').gte('last_active_at', fromIso).lte('started_at', throughIso)
      .order('started_at', { ascending: false }).order('id')
      .range(page, page + 499).abortSignal(signal)),
    readPages<TeacherEvent>(page => supabase
      .from('learning_events')
      .select('id, session_id, user_id, event_type, module, target_id, occurred_at, properties')
      .in('user_id', users).eq('environment', 'production')
      .gte('occurred_at', fromIso)
      .lte('occurred_at', throughIso)
      .order('occurred_at', { ascending: false }).order('id')
      .range(page, page + 499).abortSignal(signal)),
  ]);
    profiles.push(...profileRows);
    sessions.push(...sessionRows);
    events.push(...eventRows);
  }
  sessions.sort((a, b) => b.started_at.localeCompare(a.started_at));
  events.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  return {
    classInfo,
    memberships,
    profiles, sessions, events,
  };
};
