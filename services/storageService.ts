
import { WordEntry, SavedStory } from '../types';

const KEYS = {
  NOTEBOOK: 'oui_notebook',
  CACHE_WORDS: 'oui_cache_words',
  SAVED_STORIES: 'oui_saved_stories',
  RECENT_SEARCHES: 'oui_recent_searches'
};

export const storage = {
  // 单词缓存逻辑 (类似本地数据库)
  getCachedWord: (text: string): WordEntry | null => {
    const cache = JSON.parse(localStorage.getItem(KEYS.CACHE_WORDS) || '{}');
    return cache[text.toLowerCase()] || null;
  },
  
  saveWordToCache: (word: WordEntry) => {
    const cache = JSON.parse(localStorage.getItem(KEYS.CACHE_WORDS) || '{}');
    cache[word.text.toLowerCase()] = word;
    localStorage.setItem(KEYS.CACHE_WORDS, JSON.stringify(cache));
  },

  // 生词本逻辑
  getNotebook: (): any[] => JSON.parse(localStorage.getItem(KEYS.NOTEBOOK) || '[]'),
  saveNotebook: (items: any[]) => localStorage.setItem(KEYS.NOTEBOOK, JSON.stringify(items)),

  // 故事存储
  getStories: (): SavedStory[] => JSON.parse(localStorage.getItem(KEYS.SAVED_STORIES) || '[]'),
  saveStories: (stories: SavedStory[]) => localStorage.setItem(KEYS.SAVED_STORIES, JSON.stringify(stories)),

  // 最近搜索
  getRecent: (): string[] => JSON.parse(localStorage.getItem(KEYS.RECENT_SEARCHES) || '[]'),
  saveRecent: (list: string[]) => localStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(list))
};
