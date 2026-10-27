import { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export interface LearnerProfile {
  user_id: string;
  role: 'student' | 'teacher';
  display_name: string | null;
  research_id: string | null;
}

export interface OuiOuiClass {
  id: string;
  name: string;
  invite_code?: string;
  teacher_id: string;
}

export interface ClassMembership {
  class_id: string;
  student_number: string | null;
  research_id: string | null;
  status: 'active' | 'inactive';
  joined_at: string;
  classes: OuiOuiClass | OuiOuiClass[] | null;
}

export interface AccountContext {
  profile: LearnerProfile | null;
  memberships: ClassMembership[];
  teachingClasses: OuiOuiClass[];
}

export interface ManagedClassLearner {
  class_id: string;
  user_id: string;
  display_name: string | null;
  student_number: string | null;
  research_id: string | null;
  status: 'active' | 'inactive';
}

const firstRpcRow = <T>(data: T | T[] | null): T => {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('操作没有返回结果');
  return row;
};

export const fetchAccountContext = async (userId: string): Promise<AccountContext> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
  const [profileResult, membershipsResult, teachingResult] = await Promise.all([
    supabase
      .from('learner_profiles')
      .select('user_id, role, display_name, research_id')
      .eq('user_id', userId)
      .abortSignal(controller.signal).maybeSingle(),
    supabase
      .from('class_memberships')
      .select('class_id, student_number, research_id, status, joined_at, classes(id, name, teacher_id)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false }).abortSignal(controller.signal),
    supabase
      .from('classes')
      .select('id, name, invite_code, teacher_id')
      .eq('teacher_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }).abortSignal(controller.signal),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (membershipsResult.error) throw membershipsResult.error;
  if (teachingResult.error) throw teachingResult.error;

  return {
    profile: profileResult.data as LearnerProfile | null,
    memberships: (membershipsResult.data ?? []) as unknown as ClassMembership[],
    teachingClasses: (teachingResult.data ?? []) as OuiOuiClass[],
  };
  } finally { clearTimeout(timeout); }
};

export const updateMyProfile = async (displayName: string): Promise<LearnerProfile> => {
  const { data, error } = await supabase.rpc('update_my_learner_profile', {
    requested_display_name: displayName,
  });
  if (error) throw error;
  return data as LearnerProfile;
};

export const createTeacherClass = async (name: string): Promise<OuiOuiClass> => {
  const { data, error } = await supabase.rpc('create_teacher_class', { requested_name: name });
  if (error) throw error;
  return firstRpcRow(data as OuiOuiClass | OuiOuiClass[] | null);
};

export const renameTeacherClass = async (classId: string, name: string): Promise<OuiOuiClass> => {
  const { data, error } = await supabase.rpc('rename_teacher_class', {
    requested_class_id: classId,
    requested_name: name,
  });
  if (error) throw error;
  return firstRpcRow(data as OuiOuiClass | OuiOuiClass[] | null);
};

export const regenerateClassInvite = async (classId: string): Promise<OuiOuiClass> => {
  const { data, error } = await supabase.rpc('regenerate_class_invite', { requested_class_id: classId });
  if (error) throw error;
  return firstRpcRow(data as OuiOuiClass | OuiOuiClass[] | null);
};

export const addRegisteredLearnerToClass = async (
  classId: string,
  email: string,
  displayName: string,
  studentNumber: string,
): Promise<ManagedClassLearner> => {
  const { data, error } = await supabase.rpc('add_registered_learner_to_class', {
    requested_class_id: classId,
    requested_email: email,
    requested_display_name: displayName || null,
    requested_student_number: studentNumber || null,
  });
  if (error) throw error;
  return firstRpcRow(data as ManagedClassLearner | ManagedClassLearner[] | null);
};

export const updateClassLearner = async (
  classId: string,
  userId: string,
  displayName: string,
  studentNumber: string,
): Promise<ManagedClassLearner> => {
  const { data, error } = await supabase.rpc('update_class_learner', {
    requested_class_id: classId,
    requested_user_id: userId,
    requested_display_name: displayName,
    requested_student_number: studentNumber,
  });
  if (error) throw error;
  return firstRpcRow(data as ManagedClassLearner | ManagedClassLearner[] | null);
};

export const removeLearnerFromClass = async (classId: string, userId: string): Promise<void> => {
  const { error } = await supabase.rpc('remove_learner_from_class', {
    requested_class_id: classId,
    requested_user_id: userId,
  });
  if (error) throw error;
};

export const joinClassByInvite = async (
  inviteCode: string,
  displayName: string,
  studentNumber: string,
  expectedUserId?: string,
) => {
  const { data: authData } = await supabase.auth.getSession();
  if (!authData.session || (expectedUserId && authData.session.user.id !== expectedUserId)) throw new Error('Authentication changed');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
  const { data, error } = await supabase.rpc('join_class_by_invite', {
    requested_invite_code: inviteCode,
    requested_display_name: displayName || null,
    requested_student_number: studentNumber || null,
  }).setHeader('Authorization', `Bearer ${authData.session.access_token}`).abortSignal(controller.signal);
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
  } finally { clearTimeout(timeout); }
};

export const completePendingEnrollment = async (user: User) => {
  const inviteCode = String(user.user_metadata?.pending_invite_code ?? '').trim();
  if (!inviteCode) return { attempted: false, joined: false };

  const displayName = String(user.user_metadata?.display_name ?? '').trim();
  const studentNumber = String(user.user_metadata?.pending_student_number ?? '').trim();

  try {
    // Successful enrollment is memoized per account. An old request never edits a new user's metadata.
    const marker = `ouioui_enrolled:${user.id}:${inviteCode}`;
    try { if (localStorage.getItem(marker)) return { attempted: false, joined: true }; } catch {}
    await joinClassByInvite(inviteCode, displayName, studentNumber, user.id);
    try { localStorage.setItem(marker, '1'); } catch {}
    return { attempted: true, joined: true };
  } catch (error) {
    console.warn('Pending class enrollment could not be completed:', error);
    return { attempted: true, joined: false };
  }
};
