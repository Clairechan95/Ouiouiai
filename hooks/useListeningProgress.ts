import { useEffect, useRef, useState } from 'react';
import {
  fetchCloudListeningRecord,
  ListeningCourseId,
  ListeningLearningArchive,
  ListeningProgressRecord,
  loadLocalListeningRecord,
  saveLocalListeningRecord,
  scheduleListeningRecordSync,
  upsertCloudListeningRecord,
} from '../services/listeningProgressService';

interface ListeningProgressOptions<T extends Record<string, unknown>> {
  courseId: ListeningCourseId;
  userId?: string | null;
  contentVersion?: number;
  currentStep: number;
  maxStep: number;
  progressState: T;
  learningArchive: ListeningLearningArchive | null;
  onRestore: (record: ListeningProgressRecord<T>) => void;
}

export const useListeningProgress = <T extends Record<string, unknown>>({
  courseId,
  userId,
  contentVersion = 1,
  currentStep,
  maxStep,
  progressState,
  learningArchive,
  onRestore,
}: ListeningProgressOptions<T>) => {
  const [cloudChecked, setCloudChecked] = useState(!userId);
  const restoreRef = useRef(onRestore);
  const initialLocalRef = useRef(loadLocalListeningRecord<T>(courseId, userId));
  restoreRef.current = onRestore;

  useEffect(() => {
    let cancelled = false;
    setCloudChecked(!userId);
    if (!userId) return;

    void fetchCloudListeningRecord(courseId, userId).then((cloudRecord) => {
      if (cancelled) return;
      const localRecord = loadLocalListeningRecord<T>(courseId, userId);
      if (cloudRecord && (!localRecord || cloudRecord.updatedAt > localRecord.updatedAt)) {
        saveLocalListeningRecord(cloudRecord, userId);
        restoreRef.current(cloudRecord as ListeningProgressRecord<T>);
      } else if (localRecord) {
        void upsertCloudListeningRecord(localRecord, userId).catch(() => {});
      }
    }).finally(() => {
      if (!cancelled) window.setTimeout(() => setCloudChecked(true), 0);
    });

    return () => { cancelled = true; };
  }, [courseId, userId]);

  useEffect(() => {
    if (!cloudChecked) return;
    const timer = window.setTimeout(() => {
      const existing = loadLocalListeningRecord(courseId, userId);
      const completedAt = learningArchive?.completedAt ?? existing?.completedAt ?? null;
      scheduleListeningRecordSync({
        courseId,
        contentVersion,
        status: learningArchive ? 'completed' : 'in_progress',
        currentStep,
        maxStep,
        progressState,
        learningArchive,
        completedAt,
        updatedAt: new Date().toISOString(),
      }, userId);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [cloudChecked, contentVersion, courseId, currentStep, learningArchive, maxStep, progressState, userId]);

  return initialLocalRef.current;
};
