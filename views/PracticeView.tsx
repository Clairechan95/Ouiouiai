
import React, { useState, useEffect, useRef } from 'react';
import { PenTool, Play, Pause, Save, Trash2, Clock, Download, FileText, Music, Sparkles, Info } from 'lucide-react';
import { generateClozeStoryStream } from '../services/geminiService';
import { useAppContext } from '../App';
import { ClozeStory, SavedStory, StorySegment } from '../types';
import AudioPlayer from '../components/AudioPlayer';

const PracticeView: React.FC = () => {
  const { notebook, currentLevel, savedStories, saveStory, deleteStory } = useAppContext();
  const [activeTab, setActiveTab] = useState<'create' | 'saved'>('create');
  
  // 状态
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [themeSearch, setThemeSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [clozeData, setClozeData] = useState<ClozeStory | null>(null);
  const [streamFinished, setStreamFinished] = useState(false);
  const [userInputs, setUserInputs] = useState<{[key: string]: string}>({}); 
  const [showResults, setShowResults] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const allThemes = Array.from(new Set(notebook.flatMap(item => item.themes)));
  const filteredItems = selectedThemes.length === 0
    ? notebook
    : notebook.filter(item => item.themes.some(t => selectedThemes.includes(t)));

  const toggleTheme = (t: string) => {
    setSelectedThemes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  // 停止播放函数
  const stopGlobalSpeech = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  // 播放全文逻辑 (使用 Web Speech API)
  const playFullStory = () => {
    if (isPlaying) {
      stopGlobalSpeech();
      return;
    }

    if (!clozeData) return;
    const fullText = clozeData.segments
      .map(seg => seg.french.replace(/\{\{(.*?)\}\}/g, '$1')) 
      .join(' ');

    const utterance = new SpeechSynthesisUtterance(fullText);
    const voices = window.speechSynthesis.getVoices();
    const frenchVoice = voices.find(v => v.lang.startsWith('fr'));
    if (frenchVoice) utterance.voice = frenchVoice;
    utterance.lang = 'fr-FR';
    utterance.rate = 0.85;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  // --- 导出逻辑 ---
  const downloadTranscript = () => {
    if (!clozeData) return;
    const content = `TITLE: ${clozeData.title}\n\n` + 
      clozeData.segments.map(s => {
        const cleanFrench = s.french.replace(/\{\{(.*?)\}\}/g, '$1');
        return `[法语] ${cleanFrench}\n[中文] ${s.chinese}\n`;
      }).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OuiOui_Study_${clozeData.title}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    if (filteredItems.length === 0) return;
    stopGlobalSpeech();
    setLoading(true);
    setClozeData({ title: "创作中...", segments: [] });
    setStreamFinished(false);
    setShowResults(false);
    setUserInputs({});
    
    try {
      const shuffled = [...filteredItems].sort(() => 0.5 - Math.random());
      const selectedWords = shuffled.slice(0, 8).map(i => i.text);
      const themeLabel = selectedThemes.length === 0 ? '综合' : selectedThemes.join('、');
      const stream = generateClozeStoryStream(selectedWords, themeLabel, currentLevel);
      
      let finalTitle = "未命名故事";
      const newSegments: StorySegment[] = [];
      let idCounter = 1;

      for await (const line of stream) {
        if (line.startsWith('TITLE:')) {
          finalTitle = line.replace('TITLE:', '').trim();
          setClozeData(prev => ({ ...prev!, title: finalTitle }));
        } else if (line.includes('|||')) {
          const [french, chinese] = line.split('|||');
          newSegments.push({ id: (idCounter++).toString(), french: french.trim(), chinese: chinese.trim() });
          setClozeData(prev => ({ ...prev!, segments: [...newSegments] }));
        }
      }
      setStreamFinished(true);
    } catch (e) {
      showToast("生成中断，请检查 API 配置或网络");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStory = () => {
    if (clozeData && clozeData.segments.length > 0) {
      saveStory({
        id: Date.now().toString(),
        createdAt: Date.now(),
        theme: selectedThemes.length === 0 ? '综合' : selectedThemes.join('、'),
        title: clozeData.title,
        data: clozeData
      });
      showToast("已保存 ✓");
    }
  };

  const renderSegment = (segment: StorySegment) => {
    const parts = segment.french.split(/(\{\{.*?\}\})/g);
    let clozeCount = 0;
    const cleanText = segment.french.replace(/\{\{(.*?)\}\}/g, '$1');
    
    return (
      <div key={segment.id} className="p-6 rounded-[2rem] border bg-white border-gray-100 mb-6 shadow-sm">
        <div className="flex gap-4">
          <AudioPlayer text={cleanText} className="shrink-0 bg-indigo-50 text-indigo-500 w-12 h-12" />
          <div className="space-y-4 flex-1 min-w-0">
            <div className="text-base sm:text-xl leading-relaxed text-gray-800 font-medium flex flex-wrap items-baseline gap-y-1">
              {parts.map((part, idx) => {
                const match = part.match(/\{\{(.*?)\}\}/);
                if (match) {
                  const answer = match[1];
                  const inputKey = `${segment.id}-${clozeCount++}`;
                  const userAnswer = userInputs[inputKey] || '';
                  const isCorrect = userAnswer.toLowerCase().trim() === answer.toLowerCase().trim();

                  return (
                    <span key={idx} className="mx-1">
                      {!showResults ? (
                        <input
                          type="text"
                          value={userAnswer}
                          onChange={(e) => setUserInputs(prev => ({...prev, [inputKey]: e.target.value}))}
                          className="border-b-2 border-primary/20 bg-primary/5 text-center text-primary font-bold w-20 sm:w-28 px-2 py-1 outline-none focus:border-primary rounded-t-xl text-sm sm:text-base"
                        />
                      ) : (
                        <span className={`px-2 py-1 rounded-xl border text-base font-bold ${isCorrect ? 'bg-green-100 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                          {isCorrect ? answer : `${userAnswer || '-'} → ${answer}`}
                        </span>
                      )}
                    </span>
                  );
                }
                return <span key={idx}>{part}</span>;
              })}
            </div>
            <div className="text-gray-400 text-base italic border-l-4 border-gray-100 pl-4">{segment.chinese}</div>
          </div>
        </div>
      </div>
    );
  };

  if (activeTab === 'saved') {
    return (
      <div className="p-6 pb-24 min-h-full bg-background">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black text-gray-800">历史实验室</h1>
          <button onClick={() => setActiveTab('create')} className="text-sm font-bold bg-white border border-gray-200 px-6 py-3 rounded-2xl text-gray-600 hover:bg-gray-50">返回生成</button>
        </header>
        {savedStories.filter(s => !s.type || s.type === 'cloze').length === 0 ? (
          <div className="text-center py-32 text-gray-300">
            <Clock className="w-20 h-20 mx-auto mb-6 opacity-20" />
            <p className="text-lg font-bold">暂时没有保存的故事</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {savedStories.filter(s => !s.type || s.type === 'cloze').map(story => (
              <div key={story.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 hover:shadow-2xl transition-all group">
                <div className="flex justify-between items-start mb-6">
                   <div className="bg-primary/10 text-primary text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest">{story.theme}</div>
                   <button onClick={() => deleteStory(story.id)} className="text-gray-200 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-5 h-5" /></button>
                </div>
                <h3 className="font-black text-gray-800 text-2xl mb-6 leading-tight line-clamp-2">{story.title}</h3>
                <button onClick={() => { setClozeData(story.data); setActiveTab('create'); setStreamFinished(true); }} className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-transform">重新挑战</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 pb-32 min-h-full bg-background">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-bold px-6 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}
      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-200"><PenTool className="w-6 h-6 text-white" /></div>
           <h1 className="text-3xl font-black text-gray-800">听力实验室</h1>
        </div>
        <button onClick={() => setActiveTab('saved')} className="p-4 bg-white border border-gray-100 rounded-3xl text-gray-400 hover:text-primary transition-all shadow-sm relative group">
           <Clock className="w-7 h-7 group-hover:scale-110 transition-transform" />
           {savedStories.filter(s => !s.type || s.type === 'cloze').length > 0 && <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />}
        </button>
      </header>

      {!clozeData && !loading && (
        <div className="bg-white rounded-[3rem] p-10 shadow-2xl shadow-primary/5 border border-gray-100 max-w-2xl mx-auto">
           <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mb-8">
             <Sparkles className="w-10 h-10 text-primary animate-pulse" />
           </div>
           <h2 className="text-3xl font-black mb-4 text-gray-800">DeepSeek 创意听写</h2>
           <p className="text-gray-500 mb-10 text-lg leading-relaxed">系统将提取您的生词库，由 DeepSeek 实时创作法语短文。包含本地语音朗读、填空挑战与动态解析。</p>
           
           <div className="space-y-8">
             <div>
               <div className="flex items-center justify-between mb-4">
                 <label className="text-xs font-black text-gray-300 uppercase tracking-widest">选择今日挑战主题</label>
                 {selectedThemes.length > 0 && (
                   <button onClick={() => setSelectedThemes([])} className="text-xs font-bold text-primary/60 hover:text-primary transition-colors">
                     已选 {selectedThemes.length} 个 · 清除
                   </button>
                 )}
               </div>
               {allThemes.length > 6 && (
                 <div className="relative mb-4">
                   <input
                     type="text"
                     value={themeSearch}
                     onChange={e => setThemeSearch(e.target.value)}
                     placeholder="搜索主题..."
                     className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
                   />
                   {themeSearch && (
                     <button onClick={() => setThemeSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>
                   )}
                 </div>
               )}
               <div className="flex gap-3 flex-wrap">
                 {!themeSearch && (
                   <button onClick={() => setSelectedThemes([])} className={`px-5 py-3 rounded-2xl text-sm font-black transition-all ${selectedThemes.length === 0 ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-105' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                     全部词库 ({notebook.length})
                   </button>
                 )}
                 {allThemes.filter(t => t.toLowerCase().includes(themeSearch.toLowerCase())).map(t => {
                   const isSelected = selectedThemes.includes(t);
                   const count = notebook.filter(item => item.themes.includes(t)).length;
                   return (
                     <button key={t} onClick={() => toggleTheme(t)} className={`px-5 py-3 rounded-2xl text-sm font-black transition-all ${isSelected ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-105' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                       {t} <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-300'}`}>({count})</span>
                     </button>
                   );
                 })}
                 {themeSearch && allThemes.filter(t => t.toLowerCase().includes(themeSearch.toLowerCase())).length === 0 && (
                   <p className="text-sm text-gray-300 py-2">没有匹配的主题</p>
                 )}
               </div>
               {selectedThemes.length > 0 && (
                 <p className="text-xs text-gray-400 mt-3">已筛选 {filteredItems.length} 个词汇</p>
               )}
             </div>
             <button onClick={handleGenerate} disabled={filteredItems.length < 3} className="w-full bg-primary text-white py-6 rounded-3xl font-black text-xl shadow-2xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-30">立即生成挑战</button>
             {filteredItems.length < 3 && <div className="flex items-center gap-3 text-sm text-amber-500 bg-amber-50 p-4 rounded-2xl"><Info className="w-5 h-5" /><span>请先收藏至少 3 个单词。</span></div>}
           </div>
        </div>
      )}

      {clozeData && (
        <div className="max-w-4xl mx-auto">
           <div className="sticky top-6 z-30 mb-10">
              <div className="bg-gray-900 rounded-[2.5rem] p-8 shadow-2xl text-white">
                 <div className="flex items-center justify-between gap-4 mb-8">
                    <div className="flex-1 min-w-0">
                       <h2 className="font-black text-xl sm:text-2xl truncate">{clozeData.title}</h2>
                       <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest">Local Voice Engine • ${currentLevel}</p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                       <button onClick={downloadTranscript} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors flex-shrink-0" title="下载文稿"><FileText className="w-5 h-5" /></button>
                       <button onClick={handleSaveStory} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors flex-shrink-0" title="保存故事"><Save className="w-5 h-5" /></button>
                    </div>
                 </div>
                 <div className="flex items-center gap-6">
                     <button onClick={playFullStory} className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shrink-0 shadow-2xl shadow-primary/50 hover:scale-105 active:scale-95 transition-all">
                        {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
                     </button>
                     <p className="text-gray-400 text-sm font-medium">点击播放全文 (使用本地法语引擎)</p>
                 </div>
              </div>
           </div>

           <div className="space-y-2 mb-12">
               {clozeData.segments.map(seg => renderSegment(seg))}
               {loading && <div className="text-center py-20"><div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div><p className="text-gray-400 font-black">AI 正在斟酌遣词造句...</p></div>}
           </div>

           {streamFinished && (
               <div className="grid grid-cols-2 gap-6">
                    {!showResults ? (
                    <button onClick={() => setShowResults(true)} className="col-span-2 bg-green-500 text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-green-100 active:scale-95 transition-all">完成挑战并核对</button>
                    ) : (
                    <>
                      <button onClick={() => { setClozeData(null); setStreamFinished(false); stopGlobalSpeech(); }} className="bg-white border-2 border-gray-100 text-gray-800 py-5 rounded-[2rem] font-black active:scale-95 transition-all">重新生成</button>
                      <button onClick={() => { setShowResults(false); setUserInputs({}); }} className="bg-indigo-50 text-indigo-600 py-5 rounded-[2rem] font-black active:scale-95 transition-all">清除重练</button>
                    </>
                    )}
               </div>
           )}
        </div>
      )}
    </div>
  );
};

export default PracticeView;
