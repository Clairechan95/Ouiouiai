
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { Repeat, BookOpen, Trash2, ArrowLeft, ChevronLeft, ChevronRight, Download, Search, Languages } from 'lucide-react';
import AudioPlayer from '../components/AudioPlayer';
import NotebookQuiz from '../components/NotebookQuiz';

// 法语普通词汇应首字母小写（专有名词除外）
const lcFirst = (text: string, pos?: string): string => {
  if (!text) return text;
  const p = (pos || '').toLowerCase();
  if (p.includes('prop') || p.includes('n.p')) return text; // 专有名词保留
  return text.charAt(0).toLowerCase() + text.slice(1);
};

// 从词性字符串提取阴阳性冠词标签（支持省音：元音或哑音h开头）
const getGenderBadge = (pos?: string, word?: string) => {
  if (!pos) return null;
  const p = pos.toLowerCase();
  const hasMasc = p.includes('n.m');
  const hasFem = p.includes('n.f');
  if (!hasMasc && !hasFem) return null;
  const needsElision = word ? /^[aâàæeéèêëiîïoôœuûüh]/i.test(word) : false;
  if (hasMasc && hasFem) return { article: needsElision ? "l'" : 'le/la', cls: 'bg-purple-50 text-purple-600 border border-purple-100' };
  if (hasMasc) return { article: needsElision ? "l'" : 'le', cls: 'bg-blue-50 text-blue-600 border border-blue-100' };
  if (hasFem) return { article: needsElision ? "l'" : 'la', cls: 'bg-rose-50 text-rose-600 border border-rose-100' };
  return null;
};

const NotebookView: React.FC = () => {
  const { notebook, removeFromNotebook } = useAppContext();
  const routeNavigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'flashcard' | 'quiz'>('list');
  const [selectedTheme, setSelectedTheme] = useState<string>('All');

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const touchStartX = useRef<number>(0);

  const allThemes = Array.from(new Set(notebook.flatMap(item => item.themes)));
  const filteredItems = selectedTheme === 'All' ? notebook : notebook.filter(item => item.themes.includes(selectedTheme));

  const navigateCard = (dir: 1 | -1) => {
    setIsFlipped(false);
    setTimeout(() => setCurrentCardIndex(prev => (prev + dir + filteredItems.length) % filteredItems.length), 180);
  };

  const openWordLookup = (word: string) => {
    routeNavigate(`/result/${encodeURIComponent(word.trim())}`);
  };

  // 键盘左右键导航
  useEffect(() => {
    if (viewMode !== 'flashcard') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') navigateCard(1);
      else if (e.key === 'ArrowLeft') navigateCard(-1);
      else if (e.key === ' ' || e.key === 'Enter') setIsFlipped(f => !f);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewMode, filteredItems.length]);

  // --- 导出逻辑 ---
  const exportToCSV = () => {
    if (notebook.length === 0) return;
    
    // CSV 表头（图片列使用 Anki 支持的 <img src> HTML 语法）
    const headers = ["法语单词", "词性", "音标", "图片", "中文释义", "法文释义", "例句(FR)", "例句(CN)", "主题标签"];

    const rows = notebook.map(item => [
      item.text,
      item.pos || "",
      item.ipa || "",
      item.imageUrls?.[0] ? `<img src="${item.imageUrls[0]}">` : "",
      item.chineseDefinition,
      item.frenchDefinition.replace(/,/g, "，"),
      item.examples?.[0]?.french.replace(/,/g, "，") || "",
      item.examples?.[0]?.chinese.replace(/,/g, "，") || "",
      item.themes.join(";")
    ]);

    // 关键：添加 UTF-8 BOM (\uFEFF) 确保 Excel 中文不乱码
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `OuiOui_Lexicon_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (notebook.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-20 text-center min-h-[70vh]">
        <div className="w-32 h-32 bg-gray-50 rounded-[3rem] flex items-center justify-center mb-8">
          <BookOpen className="w-16 h-16 text-gray-200" />
        </div>
        <h2 className="text-3xl font-black text-gray-800 mb-4">您的笔记本还是空的</h2>
        <p className="text-gray-400 max-w-xs mx-auto">在查词结果中点击收藏按钮，将难点单词收入囊中进行深度复习。</p>
      </div>
    );
  }

  if (viewMode === 'quiz' && filteredItems.length >= 2) {
    return <NotebookQuiz items={filteredItems} onExit={() => setViewMode('list')} />;
  }

  if (viewMode === 'flashcard' && filteredItems.length > 0) {
    const card = filteredItems[currentCardIndex];
    return (
      <div className="h-full flex flex-col px-4 py-6 bg-slate-50 min-h-[85vh]">
        {/* 顶栏 */}
        <div className="flex items-center justify-between max-w-2xl mx-auto w-full mb-8">
          <button onClick={() => setViewMode('list')} className="flex items-center gap-2 text-gray-400 hover:text-primary font-black transition-colors">
            <ArrowLeft className="w-5 h-5" /> 返回
          </button>
          <span className="text-gray-300 font-black tracking-widest text-lg">
            {currentCardIndex + 1} <span className="text-gray-200">/</span> {filteredItems.length}
          </span>
          <div className="w-16" />{/* 占位，保持居中 */}
        </div>

        {/* 词卡 + 左右箭头 */}
        <div className="flex-1 flex items-center gap-3 sm:gap-6 max-w-3xl mx-auto w-full">
          {/* 左箭头 */}
          <button
            onClick={() => navigateCard(-1)}
            className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center text-gray-400 hover:text-primary hover:shadow-xl hover:border-primary/20 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>

          {/* 词卡主体 */}
          <div
            className="flex-1 relative aspect-[3/4] cursor-pointer"
            onClick={() => setIsFlipped(f => !f)}
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              const dx = e.changedTouches[0].clientX - touchStartX.current;
              if (Math.abs(dx) > 50) navigateCard(dx < 0 ? 1 : -1);
              else setIsFlipped(f => !f);
            }}
          >
            <div
              className="relative w-full h-full duration-700 transition-transform"
              style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              {/* 正面 */}
              <div className="absolute inset-0 bg-white rounded-[3rem] shadow-2xl p-6 sm:p-10 flex flex-col items-center justify-center border border-gray-100" style={{ backfaceVisibility: 'hidden' }}>
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-6">点击翻转 · 左右滑动切换</span>
                {card.imageUrls?.[0] ? (
                  <img src={card.imageUrls[0]} alt="visual" className="w-28 h-28 sm:w-44 sm:h-44 object-cover rounded-[2rem] mb-5 shadow-xl shadow-primary/10" />
                ) : (
                  <div className="w-28 h-28 sm:w-44 sm:h-44 bg-indigo-50 rounded-[2rem] mb-5 flex items-center justify-center text-primary/40"><BookOpen className="w-10 h-10 sm:w-16 sm:h-16" /></div>
                )}
                <div className="flex flex-col items-center mb-4">
                  {(() => { const g = getGenderBadge(card.pos, card.text); return g ? <span className={`text-sm font-black px-3 py-1 rounded-full mb-2 ${g.cls}`}>{g.article}</span> : null; })()}
                  <h2 className="text-3xl sm:text-5xl font-black text-gray-800 text-center">{lcFirst(card.text, card.pos)}</h2>
                </div>
                <div className="flex items-center gap-3 sm:gap-5 flex-wrap justify-center">
                  <AudioPlayer text={card.text} className="bg-primary/10 text-primary w-11 h-11 sm:w-14 sm:h-14" />
                  <p className="text-gray-400 font-mono text-sm sm:text-lg italic">{card.ipa}</p>
                </div>
              </div>
              {/* 背面 */}
              <div className="absolute inset-0 bg-primary text-white rounded-[3rem] shadow-2xl p-6 sm:p-10 flex flex-col items-center justify-center overflow-hidden" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <h3 className="text-2xl sm:text-4xl font-black mb-3 sm:mb-5 text-center leading-tight">{card.chineseDefinition}</h3>
                <p className="text-white/85 text-center mb-4 sm:mb-7 text-sm sm:text-lg font-medium leading-relaxed">{card.frenchDefinition}</p>
                <div className="bg-white/10 p-4 sm:p-6 rounded-[1.5rem] w-full border border-white/10">
                  <p className="font-bold text-center text-sm sm:text-lg mb-2 leading-relaxed italic">"{card.examples[0]?.french}"</p>
                  <p className="text-white/75 text-center text-xs sm:text-sm font-medium">{card.examples[0]?.chinese}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 右箭头 */}
          <button
            onClick={() => navigateCard(1)}
            className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center text-gray-400 hover:text-primary hover:shadow-xl hover:border-primary/20 active:scale-90 transition-all"
          >
            <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        </div>

        {/* 进度点 */}
        <div className="flex justify-center gap-1.5 pt-6 pb-2 max-w-xs mx-auto w-full overflow-hidden">
          {filteredItems.length <= 20 && filteredItems.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIsFlipped(false); setCurrentCardIndex(i); }}
              className={`h-1.5 rounded-full transition-all ${i === currentCardIndex ? 'w-6 bg-primary' : 'w-1.5 bg-gray-200 hover:bg-gray-300'}`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-12 pb-32 bg-background min-h-full">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-8 mb-12 sm:mb-16">
          <div>
            <h1 className="text-3xl sm:text-5xl font-black text-gray-800 mb-3 sm:mb-4">法语私人词库</h1>
            <p className="text-gray-500 text-base sm:text-xl font-medium">Accumulez vos progrès, pas à pas.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button 
              onClick={exportToCSV}
              className="bg-white border-2 border-gray-100 text-gray-600 px-6 sm:px-8 py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black shadow-sm flex items-center justify-center gap-3 hover:bg-gray-50 active:scale-95 transition-all w-full sm:w-auto"
            >
              <Download className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
              <span>导出 CSV (Anki)</span>
            </button>
            <button
              onClick={() => setViewMode('quiz')}
              disabled={filteredItems.length < 2}
              title={filteredItems.length < 2 ? '至少需要 2 个单词才能开始选择复习' : '开始双向选择复习'}
              className="bg-primary text-white px-8 py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all w-full sm:w-auto disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:hover:scale-100"
            >
              <Languages className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>开始选择复习</span>
            </button>
            <button 
              onClick={() => setViewMode('flashcard')} 
              className="bg-white border-2 border-primary/10 text-primary px-8 py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black flex items-center justify-center gap-3 hover:bg-indigo-50 active:scale-95 transition-all w-full sm:w-auto"
            >
              <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>开启闪卡复习</span>
            </button>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-6 sm:pb-8 no-scrollbar mb-8 sm:mb-10 sticky top-0 bg-background/90 backdrop-blur-xl pt-4 z-20">
          <button
            onClick={() => setSelectedTheme('All')}
            className={`px-6 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm sm:text-base font-black whitespace-nowrap transition-all ${selectedTheme === 'All' ? 'bg-gray-900 text-white shadow-xl' : 'bg-white text-gray-400 border border-gray-100'}`}
          >
            Tout
          </button>
          {allThemes.map(t => (
            <button
              key={t}
              onClick={() => setSelectedTheme(t)}
              className={`px-6 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm sm:text-base font-black whitespace-nowrap transition-all ${selectedTheme === t ? 'bg-primary text-white shadow-xl' : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20 hover:text-primary'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredItems.map((item) => (
            <div key={item.id} className="group bg-white border border-gray-100 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 flex flex-col gap-5 sm:gap-6 hover:shadow-2xl hover:shadow-primary/5 transition-all hover:-translate-y-2 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openWordLookup(item.text)}
                      className="group/word inline-flex items-center gap-2 text-left text-gray-800 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-lg transition-colors"
                      aria-label={`查询 ${item.text}`}
                      title={`查询 ${item.text}`}
                    >
                      <span className="font-black text-2xl sm:text-3xl group-hover/word:underline decoration-2 underline-offset-4">
                        {lcFirst(item.text, item.pos)}
                      </span>
                      <Search className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300 group-hover/word:text-primary transition-colors" />
                    </button>
                    <AudioPlayer text={item.text} className="w-10 h-10 p-2 text-gray-300 hover:text-primary transition-colors" />
                    {(() => { const g = getGenderBadge(item.pos, item.text); return g ? <span className={`text-xs font-black px-2 py-0.5 rounded-full ${g.cls}`}>{g.article}</span> : null; })()}
                  </div>
                  {item.ipa && <p className="text-gray-400 font-mono text-sm mb-1">{item.ipa}</p>}
                  <p className="text-primary font-black text-lg sm:text-xl">{item.chineseDefinition}</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeFromNotebook(item.id); }}
                  className="text-gray-300 hover:text-red-500 p-2 transition-colors"
                >
                  <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
              <p className="text-gray-500 text-sm sm:text-base line-clamp-2 leading-relaxed font-medium">{item.frenchDefinition}</p>
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                {item.themes.map(t => <span key={t} className="text-[10px] font-black text-primary/70 uppercase tracking-tighter">#{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
  );
};

export default NotebookView;
