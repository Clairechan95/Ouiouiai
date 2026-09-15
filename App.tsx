
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import Layout from './components/Layout';
import SearchView from './views/SearchView';
import ResultView from './views/ResultView';
import NotebookView from './views/NotebookView';
import PracticeView from './views/PracticeView';
import ConjugationView from './views/ConjugationView';
import WrongAnswerView from './views/WrongAnswerView';
import AuthView from './views/AuthView';
import { WordEntry, NotebookItem, CEFRLevel, SavedStory, WrongAnswer } from './types';
import { storage } from './services/storageService';
import { supabase } from './services/supabaseClient';
import * as cloud from './services/cloudStorageService';
import { AccountContext, completePendingEnrollment, fetchAccountContext } from './services/classService';
import {
  endLearningSession,
  resetLearningAnalytics,
  startLearningAnalytics,
  trackLearningEvent,
} from './services/learningAnalyticsService';

const ListeningLessonView = React.lazy(() => import('./views/ListeningLessonView'));
const ListeningHomeView = React.lazy(() => import('./views/ListeningHomeView'));
const ListeningReasonsView = React.lazy(() => import('./views/ListeningReasonsView'));
const AccountView = React.lazy(() => import('./views/AccountView'));
const TeacherDashboardView = React.lazy(() => import('./views/TeacherDashboardView'));

interface AppState {
  user: User | null;
  authLoading: boolean;
  accountContext: AccountContext | null;
  accountLoading: boolean;
  accountError: string;
  refreshAccountContext: () => Promise<void>;
  notebook: NotebookItem[];
  addToNotebook: (word: WordEntry) => void;
  removeFromNotebook: (id: string) => void;
  updateNotebookImages: (id: string, imageUrls: string[]) => void;
  savedStories: SavedStory[];
  saveStory: (story: SavedStory) => void;
  deleteStory: (id: string) => void;
  currentLevel: CEFRLevel;
  setLevel: (level: CEFRLevel) => void;
  recentSearches: string[];
  addRecentSearch: (text: string) => void;
  wrongAnswers: WrongAnswer[];
  addWrongAnswers: (items: WrongAnswer[]) => void;
  removeWrongAnswer: (id: string) => void;
  toggleMastered: (id: string) => void;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accountContext, setAccountContext] = useState<AccountContext | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState('');
  const accountUserRef = React.useRef<string | null>(null);
  accountUserRef.current = user?.id ?? null;
  const cloudDataLoadedRef = React.useRef(false);
  const [notebook, setNotebook] = useState<NotebookItem[]>(storage.getNotebook());
  const [savedStories, setSavedStories] = useState<SavedStory[]>(storage.getStories());
  const [currentLevel, setLevel] = useState<CEFRLevel>(CEFRLevel.BEGINNER);
  const [recentSearches, setRecentSearches] = useState<string[]>(storage.getRecent());
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>(storage.getWrongAnswers());

  const refreshAccountContext = async () => {
    if (!user) {
      setAccountContext(null);
      return;
    }
    setAccountLoading(true);
    setAccountError('');
    try {
      const context = await fetchAccountContext(user.id);
      if (accountUserRef.current === user.id) setAccountContext(context);
    } catch (error) {
      if (accountUserRef.current === user.id) setAccountError('账号信息暂时无法读取，请重试');
    } finally {
      if (accountUserRef.current === user.id) setAccountLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setAccountContext(null);
    setAccountError('');
    if (!user) {
      resetLearningAnalytics();
      setAccountLoading(false);
      return;
    }
    const signedInUser = user;
    setAccountLoading(true);
    startLearningAnalytics(signedInUser.id);
    // Supabase calls run outside the auth callback's lock.
    void (async () => {
      await completePendingEnrollment(signedInUser);
      if (cancelled) return;
      const context = await fetchAccountContext(signedInUser.id);
      if (!cancelled) setAccountContext(context);
    })().catch(() => {
      if (!cancelled) setAccountError('账号信息暂时无法读取，请重试');
    }).finally(() => { if (!cancelled) setAccountLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // 本地持久化
  useEffect(() => storage.saveNotebook(notebook), [notebook]);
  useEffect(() => storage.saveStories(savedStories), [savedStories]);
  useEffect(() => storage.saveRecent(recentSearches), [recentSearches]);
  useEffect(() => storage.saveWrongAnswers(wrongAnswers), [wrongAnswers]);

  // 登录后从云端加载数据，合并本地数据（只执行一次）
  const loadCloudData = async () => {
    if (cloudDataLoadedRef.current) return;
    cloudDataLoadedRef.current = true;
    const [cloudNotebook, cloudWrong, cloudStories] = await Promise.all([
      cloud.fetchNotebook(),
      cloud.fetchWrongAnswers(),
      cloud.fetchStories(),
    ]);

    // 生词本：云端为主，本地有云端没有的则上传
    if (cloudNotebook.length > 0) {
      setNotebook(cloudNotebook);
      storage.saveNotebook(cloudNotebook);
    } else {
      const local = storage.getNotebook();
      if (local.length > 0) cloud.uploadNotebook(local);
    }

    // 错题本：合并（云端 + 本地去重）
    if (cloudWrong.length > 0) {
      const localIds = new Set(cloudWrong.map(w => w.id));
      const localOnly = storage.getWrongAnswers().filter(w => !localIds.has(w.id));
      const merged = [...cloudWrong, ...localOnly];
      setWrongAnswers(merged);
      storage.saveWrongAnswers(merged);
      if (localOnly.length > 0) cloud.insertWrongAnswers(localOnly);
    } else {
      const local = storage.getWrongAnswers();
      if (local.length > 0) cloud.insertWrongAnswers(local);
    }

    // 故事：合并
    if (cloudStories.length > 0) {
      const localIds = new Set(cloudStories.map(s => s.id));
      const localOnly = storage.getStories().filter(s => !localIds.has(s.id));
      const merged = [...cloudStories, ...localOnly];
      setSavedStories(merged);
      storage.saveStories(merged);
      if (localOnly.length > 0) localOnly.forEach(s => cloud.upsertStory(s));
    } else {
      const local = storage.getStories();
      if (local.length > 0) local.forEach(s => cloud.upsertStory(s));
    }
  };

  // 监听 Supabase 登录状态
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const signedInUser = data.session?.user ?? null;
      if (signedInUser) startLearningAnalytics(signedInUser.id);
      setUser(signedInUser);
      setAuthLoading(false);
      if (signedInUser) {
        window.setTimeout(() => { void loadCloudData(); }, 0);
      }
    }).catch(() => { setAuthLoading(false); });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      if (newUser) startLearningAnalytics(newUser.id);
      setUser(newUser);
      if (_event === 'INITIAL_SESSION') setAuthLoading(false);
      if (_event === 'SIGNED_IN' && newUser) {
        window.setTimeout(() => { if (accountUserRef.current === newUser.id) void loadCloudData(); }, 0);
      }
      if (_event === 'SIGNED_OUT') {
        cloudDataLoadedRef.current = false;
        setAccountContext(null);
        resetLearningAnalytics();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // ─── 生词本操作 ──────────────────────────────────────────────────────────

  const addToNotebook = (word: WordEntry) => {
    const normalizedText = word.text.trim().toLocaleLowerCase('fr-FR');
    if (notebook.find(item => item.id === word.id || item.text.trim().toLocaleLowerCase('fr-FR') === normalizedText)) return;
    const item: NotebookItem = { ...word, masteryLevel: 0 };
    setNotebook(prev => [...prev, item]);
    if (user) cloud.upsertNotebookItem(item);
    trackLearningEvent('word_saved', 'notebook', {
      targetId: normalizedText,
      properties: { source: 'word_result' },
    });
  };

  const removeFromNotebook = (id: string) => {
    const removed = notebook.find(item => item.id === id);
    setNotebook(prev => prev.filter(item => item.id !== id));
    if (user) cloud.deleteNotebookItem(id);
    trackLearningEvent('word_removed', 'notebook', {
      targetId: removed?.text.trim().toLocaleLowerCase('fr-FR') || id,
    });
  };

  const updateNotebookImages = (id: string, imageUrls: string[]) => {
    setNotebook(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, imageUrls };
      if (user) cloud.upsertNotebookItem(updated);
      return updated;
    }));
  };

  // ─── 故事操作 ────────────────────────────────────────────────────────────

  const saveStory = (story: SavedStory) => {
    if (savedStories.find(s => s.id === story.id)) return;
    setSavedStories(prev => [story, ...prev]);
    if (user) cloud.upsertStory(story);
  };

  const deleteStory = (id: string) => {
    setSavedStories(prev => prev.filter(s => s.id !== id));
    if (user) cloud.deleteStory(id);
  };

  // ─── 错题本操作 ──────────────────────────────────────────────────────────

  const addWrongAnswers = (items: WrongAnswer[]) => {
    setWrongAnswers(prev => [...items, ...prev]);
    if (user) cloud.insertWrongAnswers(items);
  };

  const removeWrongAnswer = (id: string) => {
    setWrongAnswers(prev => prev.filter(w => w.id !== id));
    if (user) cloud.deleteWrongAnswer(id);
  };

  const toggleMastered = (id: string) => {
    setWrongAnswers(prev => prev.map(w => {
      if (w.id !== id) return w;
      const updated = { ...w, mastered: !w.mastered };
      if (user) cloud.updateWrongAnswer(updated);
      return updated;
    }));
  };

  // ─── 其他 ────────────────────────────────────────────────────────────────

  const addRecentSearch = (text: string) => {
    setRecentSearches(prev => {
      const newSet = new Set([text, ...prev]);
      return Array.from(newSet).slice(0, 8);
    });
  };

  const signOut = async () => {
    endLearningSession('logout');
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AppContext.Provider value={{
      user, authLoading, accountContext, accountLoading, accountError, refreshAccountContext,
      notebook, addToNotebook, removeFromNotebook, updateNotebookImages,
      savedStories, saveStory, deleteStory,
      currentLevel, setLevel,
      recentSearches, addRecentSearch,
      wrongAnswers, addWrongAnswers, removeWrongAnswer, toggleMastered,
      signOut,
    }}>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<SearchView />} />
            <Route path="/result/:query" element={<ResultView />} />
            <Route path="/notebook" element={<NotebookView />} />
            <Route path="/practice" element={<PracticeView />} />
            <Route path="/conjugation" element={<ConjugationView />} />
            <Route path="/wrong-answers" element={<WrongAnswerView />} />
            <Route path="/auth" element={<AuthView />} />
            <Route
              path="/account"
              element={(
                <React.Suspense fallback={<div className="py-20 text-center text-gray-400">正在加载账号...</div>}>
                  <AccountView />
                </React.Suspense>
              )}
            />
            <Route
              path="/teacher"
              element={(
                <React.Suspense fallback={<div className="py-20 text-center text-gray-400">正在加载教师端...</div>}>
                  <TeacherDashboardView />
                </React.Suspense>
              )}
            />
            <Route
              path="/listening"
              element={(
                <React.Suspense fallback={<div className="py-20 text-center text-gray-400">正在准备听力课程...</div>}>
                  <ListeningHomeView />
                </React.Suspense>
              )}
            />
            <Route
              path="/listening/se-presenter"
              element={(
                <React.Suspense fallback={<div className="py-20 text-center text-gray-400">正在准备听力课程...</div>}>
                  <ListeningLessonView />
                </React.Suspense>
              )}
            />
            <Route
              path="/listening/pourquoi-francais"
              element={(
                <React.Suspense fallback={<div className="py-20 text-center text-gray-400">正在准备听力课程...</div>}>
                  <ListeningReasonsView />
                </React.Suspense>
              )}
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </HashRouter>
    </AppContext.Provider>
  );
};

export default App;
