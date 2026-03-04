
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import SearchView from './views/SearchView';
import ResultView from './views/ResultView';
import NotebookView from './views/NotebookView';
import PracticeView from './views/PracticeView';
import ConjugationView from './views/ConjugationView';
import { WordEntry, NotebookItem, CEFRLevel, SavedStory } from './types';
import { storage } from './services/storageService';

interface AppState {
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
}

const AppContext = createContext<AppState | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};

const App: React.FC = () => {
  const [notebook, setNotebook] = useState<NotebookItem[]>(storage.getNotebook());
  const [savedStories, setSavedStories] = useState<SavedStory[]>(storage.getStories());
  const [currentLevel, setLevel] = useState<CEFRLevel>(CEFRLevel.BEGINNER);
  const [recentSearches, setRecentSearches] = useState<string[]>(storage.getRecent());

  useEffect(() => storage.saveNotebook(notebook), [notebook]);
  useEffect(() => storage.saveStories(savedStories), [savedStories]);
  useEffect(() => storage.saveRecent(recentSearches), [recentSearches]);

  const addToNotebook = (word: WordEntry) => {
    if (!notebook.find(item => item.id === word.id)) {
      setNotebook([...notebook, { ...word, masteryLevel: 0 }]);
    }
  };

  const removeFromNotebook = (id: string) => {
    setNotebook(notebook.filter(item => item.id !== id));
  };

  const updateNotebookImages = (id: string, imageUrls: string[]) => {
    setNotebook(prev => prev.map(item => item.id === id ? { ...item, imageUrls } : item));
  };

  const saveStory = (story: SavedStory) => {
    if (!savedStories.find(s => s.id === story.id)) {
      setSavedStories([story, ...savedStories]);
    }
  };

  const deleteStory = (id: string) => {
    setSavedStories(savedStories.filter(s => s.id !== id));
  };

  const addRecentSearch = (text: string) => {
    setRecentSearches(prev => {
      const newSet = new Set([text, ...prev]);
      return Array.from(newSet).slice(0, 8);
    });
  };

  return (
    <AppContext.Provider value={{ 
      notebook, addToNotebook, removeFromNotebook, updateNotebookImages,
      savedStories, saveStory, deleteStory,
      currentLevel, setLevel,
      recentSearches, addRecentSearch
    }}>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<SearchView />} />
            <Route path="/result/:query" element={<ResultView />} />
            <Route path="/notebook" element={<NotebookView />} />
            <Route path="/practice" element={<PracticeView />} />
            <Route path="/conjugation" element={<ConjugationView />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </HashRouter>
    </AppContext.Provider>
  );
};

export default App;
