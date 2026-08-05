
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, Clock, Globe, Zap, Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { lookupWord } from '../services/geminiService';
import { WordEntry } from '../types';
import { useAppContext } from '../App';
import { CEFRLevel } from '../types';
import { storage } from '../services/storageService';

const SearchView: React.FC = () => {
  const [input, setInput] = useState('');
  const navigate = useNavigate();
  const { recentSearches, currentLevel, setLevel, addToNotebook } = useAppContext();

  // Batch import state
  const [showBatch, setShowBatch] = useState(false);
  const [batchInput, setBatchInput] = useState('');
  interface BatchItem { word: string; status: 'pending' | 'loading' | 'done' | 'error'; }
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [importRunning, setImportRunning] = useState(false);
  const [importDone, setImportDone] = useState(false);

  // 法语文本自动更正函数
  const autoCorrectFrenchText = (text: string): string => {
    if (!text || typeof text !== 'string') return text;
    
    // 移除多余空格
    let corrected = text.trim().replace(/\s+/g, ' ');
    
    // 定义法语常见专有名词列表（包含更多法语特定名词）
    const frenchProperNouns: Record<string, string> = {
      'notre dame': 'Notre Dame',
      'paris': 'Paris',
      'france': 'France',
      'lyon': 'Lyon',
      'marseille': 'Marseille',
      'bordeaux': 'Bordeaux',
      'louvre': 'Louvre',
      'eiffel tower': 'Eiffel Tower',
      'tour eiffel': 'Tour Eiffel',
      'arc de triomphe': 'Arc de Triomphe',
      'montmartre': 'Montmartre',
      'cannes': 'Cannes',
      'nice': 'Nice',
      'riviera': 'Riviera',
      'alsace': 'Alsace',
      'normandie': 'Normandie',
      'champs-élysées': 'Champs-Élysées',
      'champs elysees': 'Champs-Élysées',
      'mont blanc': 'Mont Blanc',
      'sacre-coeur': 'Sacre-Coeur',
      'sacre coeur': 'Sacre-Coeur',
      'versailles': 'Versailles',
      'strasbourg': 'Strasbourg',
      'nantes': 'Nantes',
      'toulouse': 'Toulouse',
      'rennes': 'Rennes',
      'dijon': 'Dijon',
      'amiens': 'Amiens',
      'avignon': 'Avignon',
      'carcassonne': 'Carcassonne',
      'montpellier': 'Montpellier',
      'nimes': 'Nîmes',
      'aix-en-provence': 'Aix-en-Provence',
      'provence': 'Provence',
      'corsica': 'Corse',
      'bretagne': 'Bretagne',
      'lorraine': 'Lorraine',
      'poitou-charentes': 'Poitou-Charentes',
      'aquitaine': 'Aquitaine',
      'limousin': 'Limousin',
      'auvergne': 'Auvergne',
      'rhone-alpes': 'Rhône-Alpes',
      'franche-comte': 'Franche-Comté',
      'bourgogne': 'Bourgogne',
      'champagne-ardenne': 'Champagne-Ardenne',
      'picardie': 'Picardie',
      'haute-normandie': 'Haute-Normandie',
      'basse-normandie': 'Basse-Normandie',
      'ile-de-france': 'Île-de-France',
      'martinique': 'Martinique',
      'guadeloupe': 'Guadeloupe',
      'reunion': 'Réunion',
      'mayotte': 'Mayotte',
      'saint barthelemy': 'Saint-Barthélemy',
      'saint martin': 'Saint-Martin',
      'french guiana': 'Guyane française',
      'new caledonia': 'Nouvelle-Calédonie',
      'wallis and futuna': 'Wallis-et-Futuna',
      'french polynesia': 'Polynésie française'
    };
    
    // 特殊处理：将小写的专有名词替换为正确拼写
    // 先处理包含空格的短语，然后处理单个单词
    // 按长度排序，确保较长的短语优先匹配
    const sortedNouns = Object.entries(frenchProperNouns).sort((a, b) => b[0].length - a[0].length);
    
    for (const [lowercaseNoun, correctNoun] of sortedNouns) {
      // 创建更灵活的匹配模式，不依赖单词边界
      const escapedNoun = lowercaseNoun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedNoun})`, 'gi');
      corrected = corrected.replace(regex, correctNoun);
    }
    
    // 处理标题大小写：每个单词首字母大写，除了某些冠词、介词和连词
    const lowercaseWords = ['de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'pour', 'par', 'avec', 'sans', 'sur', 'sous', 'en', 'dans', 'chez', 'vers', 'contre', 'entre', 'après', 'avant', 'depuis', 'durant', 'selon', 'malgré'];
    
    // 保存原始的单词数组，用于处理特殊情况
    const words = corrected.split(' ');
    
    corrected = words.map((word, index) => {
      // 如果是专有名词（已经被替换过），跳过处理
      const isProperNoun = sortedNouns.some(([_, correctNoun]) => 
        correctNoun.includes(word) || word.includes(correctNoun)
      );
      
      if (isProperNoun) {
        return word;
      }
      
      // 移除标点符号以便检查
      const wordWithoutPunctuation = word.replace(/[.,!?;:(){}[\]"'“”‘’«»]/g, '');
      
      // 如果是第一个单词，或者不是小写单词列表中的词，首字母大写
      if (index === 0 || !lowercaseWords.includes(wordWithoutPunctuation.toLowerCase())) {
        // 处理包含标点符号的情况
        const firstChar = word.charAt(0).toUpperCase();
        const rest = word.slice(1).toLowerCase();
        return firstChar + rest;
      }
      // 否则保持小写
      return word.toLowerCase();
    }).join(' ');
    
    // 特殊处理：修正法语特殊字符
    const specialCharsMap: Record<string, string> = {
      'oe': 'œ',
      'ae': 'æ',
      'aix-en-provence': 'Aix-en-Provence',
      'ile-de-france': 'Île-de-France',
      'haute-normandie': 'Haute-Normandie',
      'basse-normandie': 'Basse-Normandie',
      'rhone-alpes': 'Rhône-Alpes',
      'franche-comte': 'Franche-Comté',
      'champagne-ardenne': 'Champagne-Ardenne',
      'poitou-charentes': 'Poitou-Charentes',
      'ile': 'Île',
      'nimes': 'Nîmes',
      'saint': 'Saint',
      'ste': 'Ste',
      'sainte': 'Sainte',
      'st': 'St',
      'saint-barthelemy': 'Saint-Barthélemy',
      'saint-martin': 'Saint-Martin'
    };
    
    for (const [incorrect, correct] of Object.entries(specialCharsMap)) {
      const regex = new RegExp(`(${incorrect})`, 'gi');
      corrected = corrected.replace(regex, correct);
    }
    
    return corrected;
  };

  const parseBatchWords = (text: string): string[] =>
    text.split(/[\n,，;；]+/).map(w => w.trim()).filter(w => w.length > 0)
      .filter((w, i, arr) => arr.indexOf(w) === i);

  const runBatchImport = async () => {
    const words = parseBatchWords(batchInput);
    if (words.length === 0) return;
    setBatchItems(words.map(w => ({ word: w, status: 'pending' })));
    setImportRunning(true);
    setImportDone(false);

    for (let i = 0; i < words.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 800)); // avoid rate limiting
      setBatchItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'loading' } : item));
      let success = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) await new Promise(r => setTimeout(r, 2000)); // retry delay
          const result: WordEntry = await lookupWord(words[i], currentLevel);
          storage.saveWordToCache(result);
          addToNotebook(result);
          setBatchItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done' } : item));
          success = true;
          break;
        } catch {}
      }
      if (!success) {
        setBatchItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error' } : item));
      }
    }
    setImportRunning(false);
    setImportDone(true);
  };

  const closeBatch = () => {
    if (importRunning) return;
    setShowBatch(false);
    setBatchInput('');
    setBatchItems([]);
    setImportDone(false);
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    // 应用自动更正
    const correctedInput = autoCorrectFrenchText(input.trim());
    navigate(`/result/${encodeURIComponent(correctedInput)}`);
  };

  return (
    <div className="min-h-full flex flex-col p-6 md:p-12 pt-12 md:pt-24 relative overflow-hidden bg-background">
      {/* Decorative Elements */}
      <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-primary/5 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-[-100px] left-[-30px] w-80 h-80 bg-secondary/5 rounded-full blur-3xl opacity-50" />

      {/* Header Section */}
      <div className="relative z-10 mb-10 text-center md:text-left">
        <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
          <div className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 border border-green-100">
            <Zap className="w-3 h-3 fill-current" />
            <span>DeepSeek-V3 Engine Ready</span>
          </div>
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-gray-800 mb-4 font-sans tracking-tight">
          Bonjour! <span className="inline-block animate-bounce">👋</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-md">输入法语或中文，由 AI 深度解析其用法、变位与语境。</p>
      </div>

      {/* Search Bar Wrapper */}
      <div className="max-w-3xl w-full mx-auto md:mx-0">
        <form onSubmit={handleSearch} className="relative z-10 mb-10 group">
          <div className="relative flex items-center shadow-2xl shadow-primary/10 rounded-3xl overflow-hidden transition-transform focus-within:scale-[1.02]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入法语或中文..."
              className="w-full p-6 pl-14 md:p-8 md:pl-16 rounded-3xl bg-white border-2 border-transparent focus:border-primary/20 outline-none text-xl text-gray-700 placeholder:text-gray-300"
            />
            <Search className="absolute left-6 md:left-7 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6 group-focus-within:text-primary transition-colors" />
            <button 
              type="submit"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary/90 text-white px-6 py-3 md:py-4 rounded-2xl flex items-center gap-2 font-bold transition-all active:scale-95"
            >
              <span className="hidden md:inline">查询</span>
              <Sparkles className="w-5 h-5" />
            </button>
          </div>
        </form>

        {/* Batch import button */}
        <div className="flex justify-end -mt-6 mb-8">
          <button
            onClick={() => setShowBatch(true)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary font-bold transition-colors"
          >
            <Upload className="w-4 h-4" />
            批量导入词汇
          </button>
        </div>

        {/* Level Selector */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4 text-sm text-gray-400 font-bold uppercase tracking-wider">
            <Globe className="w-4 h-4" />
            <span>设定您的法语级别 (AI将据此调整解析深度)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.values(CEFRLevel).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevel(lvl)}
                className={`py-4 px-2 rounded-2xl border-2 font-bold transition-all text-sm md:text-base ${
                  currentLevel === lvl 
                  ? 'bg-primary text-white border-primary shadow-xl shadow-primary/20 -translate-y-1' 
                  : 'bg-white text-gray-400 border-gray-50 hover:border-primary/30 hover:text-primary shadow-sm'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-400 font-bold uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              <span>最近探索</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {recentSearches.map((term, idx) => {
                const cached = storage.getCachedWord(term);
                return (
                  <button
                    key={idx}
                    onClick={() => navigate(`/result/${encodeURIComponent(term)}`)}
                    className="relative px-5 py-3 bg-white rounded-2xl border border-gray-100 text-gray-600 hover:bg-primary hover:text-white hover:border-primary transition-all text-sm font-medium shadow-sm group"
                  >
                    {term}
                    {cached && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
                        <Zap className="w-2 h-2 text-white fill-current" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Batch import modal */}
      {showBatch && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="font-black text-xl text-gray-800">批量导入词汇</h3>
                <p className="text-sm text-gray-400 mt-0.5">每行一个词，或用逗号/分号分隔，AI 自动解析并存入词库</p>
              </div>
              <button onClick={closeBatch} disabled={importRunning} className="p-2 hover:bg-gray-100 rounded-2xl transition-colors text-gray-400 disabled:opacity-30">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {batchItems.length === 0 ? (
                <textarea
                  value={batchInput}
                  onChange={e => setBatchInput(e.target.value)}
                  placeholder={"amour\nmaison, soleil\nêtre, avoir, aller"}
                  rows={7}
                  className="w-full p-4 bg-gray-50 rounded-2xl text-gray-700 outline-none resize-none font-mono text-sm border border-gray-100 focus:border-primary/30 leading-relaxed"
                />
              ) : (
                <>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${(batchItems.filter(b => b.status === 'done' || b.status === 'error').length / batchItems.length) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 font-bold text-right">
                    {batchItems.filter(b => b.status === 'done').length} / {batchItems.length} 完成
                  </p>

                  {/* Word list */}
                  <div className="space-y-2">
                    {batchItems.map((item, i) => (
                      <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${item.status === 'loading' ? 'bg-primary/5 border border-primary/10' : 'bg-gray-50'}`}>
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          {item.status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-300" />}
                          {item.status === 'loading' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                          {item.status === 'done' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                          {item.status === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                        </div>
                        <span className={`font-bold text-sm flex-1 ${item.status === 'error' ? 'text-red-400' : item.status === 'done' ? 'text-gray-800' : 'text-gray-500'}`}>
                          {item.word}
                        </span>
                        {item.status === 'loading' && <span className="text-xs text-primary font-bold">AI 解析中...</span>}
                        {item.status === 'done' && <span className="text-xs text-green-500 font-bold">已存入词库</span>}
                        {item.status === 'error' && <span className="text-xs text-red-400 font-bold">查询失败</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {importDone && (
                <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-center">
                  <p className="font-black text-green-700 mb-1">
                    🎉 导入完成
                  </p>
                  <p className="text-sm text-green-600 mb-4">
                    {batchItems.filter(b => b.status === 'done').length} 个词汇已加入词库
                    {batchItems.filter(b => b.status === 'error').length > 0 && `，${batchItems.filter(b => b.status === 'error').length} 个失败`}
                  </p>
                  <button
                    onClick={() => { closeBatch(); navigate('/notebook'); }}
                    className="bg-primary text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg shadow-primary/20"
                  >
                    前往词库查看 →
                  </button>
                </div>
              )}
            </div>

            {/* Footer: start button */}
            {batchItems.length === 0 && (
              <div className="p-6 border-t border-gray-100">
                <button
                  onClick={runBatchImport}
                  disabled={parseBatchWords(batchInput).length === 0}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-black disabled:opacity-40 flex items-center justify-center gap-2 shadow-xl shadow-primary/20 active:scale-95 transition-all"
                >
                  <Upload className="w-5 h-5" />
                  {parseBatchWords(batchInput).length > 0
                    ? `开始导入 ${parseBatchWords(batchInput).length} 个词汇`
                    : '请输入词汇'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchView;
