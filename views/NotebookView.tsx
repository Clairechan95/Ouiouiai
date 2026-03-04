
import React, { useState } from 'react';
import { useAppContext } from '../App';
import { Repeat, ArrowRight, BookOpen, Trash2, ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import AudioPlayer from '../components/AudioPlayer';

const NotebookView: React.FC = () => {
  const { notebook, removeFromNotebook } = useAppContext();
  const [viewMode, setViewMode] = useState<'list' | 'flashcard'>('list');
  const [selectedTheme, setSelectedTheme] = useState<string>('All');

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const allThemes = Array.from(new Set(notebook.flatMap(item => item.themes)));
  const filteredItems = selectedTheme === 'All' ? notebook : notebook.filter(item => item.themes.includes(selectedTheme));

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
        setCurrentCardIndex((prev) => (prev + 1) % filteredItems.length);
    }, 200);
  };

  // --- 导出逻辑 ---
  const exportToCSV = () => {
    if (notebook.length === 0) return;
    
    // CSV 表头
    const headers = ["法语单词", "词性", "音标", "中文释义", "法文释义", "例句(FR)", "例句(CN)", "主题标签"];
    
    const rows = notebook.map(item => [
      item.text,
      item.pos || "",
      item.ipa || "",
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

  if (viewMode === 'flashcard' && filteredItems.length > 0) {
    const card = filteredItems[currentCardIndex];
    return (
      <div className="h-full flex flex-col p-6 bg-slate-50 min-h-[85vh]">
        <button onClick={() => setViewMode('list')} className="self-start flex items-center gap-3 text-gray-400 hover:text-primary font-black mb-10 transition-colors">
          <ArrowLeft className="w-6 h-6" /> 返回列表
        </button>
        
        <div className="flex-1 flex items-center justify-center max-w-2xl mx-auto w-full">
          <div className="relative w-full aspect-[3/4] cursor-pointer group" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`card-inner relative w-full h-full duration-700 transition-transform`} style={{transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'}}>
                {/* 正面 */}
                <div className="card-front absolute inset-0 bg-white rounded-[4rem] shadow-2xl p-6 sm:p-12 flex flex-col items-center justify-center border border-gray-100" style={{backfaceVisibility: 'hidden'}}>
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 sm:mb-12">Cliquez pour retourner</span>
                  {card.imageUrls?.[0] ? (
                    <img src={card.imageUrls[0]} alt="visual" className="w-32 h-32 sm:w-56 sm:h-56 object-cover rounded-[2rem] sm:rounded-[3rem] mb-6 sm:mb-10 shadow-2xl shadow-primary/10" />
                  ) : (
                    <div className="w-32 h-32 sm:w-56 sm:h-56 bg-indigo-50 rounded-[2rem] sm:rounded-[3rem] mb-6 sm:mb-10 flex items-center justify-center text-primary/50"><BookOpen className="w-12 h-12 sm:w-20 sm:h-20" /></div>
                  )}
                  <h2 className="text-3xl sm:text-5xl font-black text-gray-800 text-center mb-4 sm:mb-6">{card.text}</h2>
                  <div className="flex items-center gap-3 sm:gap-6 flex-wrap justify-center">
                    <AudioPlayer text={card.text} className="bg-primary/10 text-primary w-12 h-12 sm:w-16 sm:h-16" />
                    <p className="text-gray-500 font-mono text-base sm:text-xl italic">{card.ipa}</p>
                  </div>
                </div>
                {/* 背面 */}
                <div className="card-back absolute inset-0 bg-primary text-white rounded-[4rem] shadow-2xl p-6 sm:p-12 flex flex-col items-center justify-center overflow-hidden" style={{backfaceVisibility: 'hidden', transform: 'rotateY(180deg)'}}>
                  <h3 className="text-2xl sm:text-4xl font-black mb-3 sm:mb-6 text-center leading-tight">{card.chineseDefinition}</h3>
                  <p className="text-white/90 text-center mb-4 sm:mb-8 text-sm sm:text-xl font-medium leading-relaxed">{card.frenchDefinition}</p>
                  <div className="bg-white/10 p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] w-full border border-white/10">
                    <p className="font-bold text-center text-sm sm:text-xl mb-2 sm:mb-4 leading-relaxed italic">"{card.examples[0]?.french}"</p>
                    <p className="text-white/80 text-center text-xs sm:text-base font-medium">{card.examples[0]?.chinese}</p>
                  </div>
                </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center max-w-2xl mx-auto w-full px-6 sm:px-10 py-6 sm:py-12">
           <div className="text-gray-400 font-black tracking-widest text-xl sm:text-2xl">{currentCardIndex + 1} <span className="text-gray-200">/</span> {filteredItems.length}</div>
           <button onClick={nextCard} className="bg-gray-900 text-white p-5 sm:p-8 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all">
             <ArrowRight className="w-7 h-7 sm:w-10 sm:h-10" />
           </button>
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
              onClick={() => setViewMode('flashcard')} 
              className="bg-primary text-white px-8 py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all w-full sm:w-auto"
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
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-black text-2xl sm:text-3xl text-gray-800">{item.text}</span>
                    <AudioPlayer text={item.text} className="w-10 h-10 p-2 text-gray-300 hover:text-primary transition-colors" />
                  </div>
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
