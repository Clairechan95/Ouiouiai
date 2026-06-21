
import { supabase } from './supabaseClient';
import { NotebookItem, WrongAnswer, SavedStory } from '../types';

// ─── 生词本 ────────────────────────────────────────────────────────────────

export const fetchNotebook = async (): Promise<NotebookItem[]> => {
  const { data, error } = await supabase
    .from('user_notebooks')
    .select('data')
    .order('created_at', { ascending: true });
  if (error) return [];
  return data.map((row: any) => row.data as NotebookItem);
};

export const upsertNotebookItem = (item: NotebookItem) => {
  supabase.from('user_notebooks')
    .upsert({ id: item.id, data: item }, { onConflict: 'id' })
    .then(() => {});
};

export const deleteNotebookItem = (id: string) => {
  supabase.from('user_notebooks').delete().eq('id', id).then(() => {});
};

export const uploadNotebook = (items: NotebookItem[]) => {
  if (items.length === 0) return;
  const rows = items.map(item => ({ id: item.id, data: item }));
  supabase.from('user_notebooks')
    .upsert(rows, { onConflict: 'id' })
    .then(() => {});
};

// ─── 错题本 ────────────────────────────────────────────────────────────────

export const fetchWrongAnswers = async (): Promise<WrongAnswer[]> => {
  const { data, error } = await supabase
    .from('user_wrong_answers')
    .select('data')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data.map((row: any) => row.data as WrongAnswer);
};

export const insertWrongAnswers = (items: WrongAnswer[]) => {
  if (items.length === 0) return;
  const rows = items.map(item => ({ id: item.id, data: item }));
  supabase.from('user_wrong_answers')
    .upsert(rows, { onConflict: 'id' })
    .then(() => {});
};

export const updateWrongAnswer = (item: WrongAnswer) => {
  supabase.from('user_wrong_answers')
    .update({ data: item })
    .eq('id', item.id)
    .then(() => {});
};

export const deleteWrongAnswer = (id: string) => {
  supabase.from('user_wrong_answers').delete().eq('id', id).then(() => {});
};

// ─── 保存的故事 ────────────────────────────────────────────────────────────

export const fetchStories = async (): Promise<SavedStory[]> => {
  const { data, error } = await supabase
    .from('user_saved_stories')
    .select('data')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data.map((row: any) => row.data as SavedStory);
};

export const upsertStory = (story: SavedStory) => {
  supabase.from('user_saved_stories')
    .upsert({ id: story.id, data: story }, { onConflict: 'id' })
    .then(() => {});
};

export const deleteStory = (id: string) => {
  supabase.from('user_saved_stories').delete().eq('id', id).then(() => {});
};
