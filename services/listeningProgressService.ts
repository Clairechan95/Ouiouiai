import { supabase } from './supabaseClient';

export type ListeningCourseId = 'se-presenter' | 'pourquoi-francais' | 'demander-son-chemin';
export type ListeningRecordStatus = 'in_progress' | 'completed';

export interface ListeningScore {
  label: string;
  score: number;
  total: number;
}

export interface ListeningLearningArchive {
  courseTitle: string;
  completedAt: string;
  scores: ListeningScore[];
  errors: string[];
  strategies: string[];
  personalExpression?: string;
  supports?: string[];
  vocabularyHelp?: string[];
}

export interface ListeningProgressRecord<T extends Record<string, unknown> = Record<string, unknown>> {
  courseId: ListeningCourseId;
  contentVersion: number;
  status: ListeningRecordStatus;
  currentStep: number;
  maxStep: number;
  progressState: T;
  learningArchive: ListeningLearningArchive | null;
  completedAt: string | null;
  updatedAt: string;
}

interface CloudListeningRow {
  course_id: ListeningCourseId;
  content_version: number;
  status: ListeningRecordStatus;
  current_step: number;
  max_step: number;
  progress_state: Record<string, unknown>;
  learning_archive: ListeningLearningArchive | null;
  completed_at: string | null;
  updated_at: string;
}

const STORAGE_PREFIX = 'ouioui_listening_records_v1';
const cloudTimers = new Map<string, number>();

const storageKey = (userId?: string | null) => `${STORAGE_PREFIX}:${userId || 'guest'}`;

const readLocalMap = (userId?: string | null): Partial<Record<ListeningCourseId, ListeningProgressRecord>> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const rowToRecord = (row: CloudListeningRow): ListeningProgressRecord => ({
  courseId: row.course_id,
  contentVersion: row.content_version,
  status: row.status,
  currentStep: row.current_step,
  maxStep: row.max_step,
  progressState: row.progress_state ?? {},
  learningArchive: row.learning_archive,
  completedAt: row.completed_at,
  updatedAt: row.updated_at,
});

export const loadLocalListeningRecord = <T extends Record<string, unknown>>(
  courseId: ListeningCourseId,
  userId?: string | null,
): ListeningProgressRecord<T> | null => {
  const record = readLocalMap(userId)[courseId];
  if (!record || record.courseId !== courseId || !record.progressState) return null;
  return record as ListeningProgressRecord<T>;
};

export const listLocalListeningRecords = (userId?: string | null): ListeningProgressRecord[] =>
  Object.values(readLocalMap(userId))
    .filter((record): record is ListeningProgressRecord => Boolean(record?.courseId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export const saveLocalListeningRecord = (
  record: ListeningProgressRecord,
  userId?: string | null,
) => {
  try {
    const records = readLocalMap(userId);
    records[record.courseId] = record;
    localStorage.setItem(storageKey(userId), JSON.stringify(records));
    window.dispatchEvent(new CustomEvent('ouioui:listening-record-updated', { detail: record.courseId }));
  } catch {}
};

const getOwnedSession = async (expectedUserId: string) => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id === expectedUserId ? data.session : null;
};

export const fetchCloudListeningRecord = async (
  courseId: ListeningCourseId,
  userId: string,
): Promise<ListeningProgressRecord | null> => {
  const session = await getOwnedSession(userId);
  if (!session) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const { data, error } = await supabase
      .from('listening_learning_records')
      .select('course_id, content_version, status, current_step, max_step, progress_state, learning_archive, completed_at, updated_at')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .abortSignal(controller.signal)
      .maybeSingle();
    if (error || !data) return null;
    return rowToRecord(data as CloudListeningRow);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
};

export const fetchCloudListeningRecords = async (userId: string): Promise<ListeningProgressRecord[]> => {
  const session = await getOwnedSession(userId);
  if (!session) return [];
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const { data, error } = await supabase
      .from('listening_learning_records')
      .select('course_id, content_version, status, current_step, max_step, progress_state, learning_archive, completed_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .abortSignal(controller.signal);
    if (error) return [];
    return (data ?? []).map((row) => rowToRecord(row as CloudListeningRow));
  } catch {
    return [];
  } finally {
    window.clearTimeout(timeout);
  }
};

export const upsertCloudListeningRecord = async (
  record: ListeningProgressRecord,
  userId: string,
) => {
  const session = await getOwnedSession(userId);
  if (!session) return;
  await supabase.from('listening_learning_records').upsert({
    user_id: userId,
    course_id: record.courseId,
    content_version: record.contentVersion,
    status: record.status,
    current_step: record.currentStep,
    max_step: record.maxStep,
    progress_state: record.progressState,
    learning_archive: record.learningArchive,
    completed_at: record.completedAt,
    updated_at: record.updatedAt,
  }, { onConflict: 'user_id,course_id' });
};

export const scheduleListeningRecordSync = (
  record: ListeningProgressRecord,
  userId?: string | null,
) => {
  saveLocalListeningRecord(record, userId);
  if (!userId || !navigator.onLine) return;
  const key = `${userId}:${record.courseId}`;
  const existing = cloudTimers.get(key);
  if (existing) window.clearTimeout(existing);
  cloudTimers.set(key, window.setTimeout(() => {
    cloudTimers.delete(key);
    void upsertCloudListeningRecord(record, userId).catch(() => {});
  }, 700));
};

export const mergeListeningRecords = (
  localRecords: ListeningProgressRecord[],
  cloudRecords: ListeningProgressRecord[],
) => {
  const merged = new Map<ListeningCourseId, ListeningProgressRecord>();
  [...localRecords, ...cloudRecords].forEach((record) => {
    const existing = merged.get(record.courseId);
    if (!existing || record.updatedAt > existing.updatedAt) merged.set(record.courseId, record);
  });
  return Array.from(merged.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};
