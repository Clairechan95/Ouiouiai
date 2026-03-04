
import React, { useState } from 'react';
import { Languages, RefreshCw, Info, Check, Save, FileText, Clock, Trash2 } from 'lucide-react';
import { useAppContext } from '../App';
import { generateConjugationStoryStream } from '../services/geminiService';
import { SavedStory } from '../types';
import AudioPlayer from '../components/AudioPlayer';

const TENSES = [
  { id: 'Présent', label: 'Présent', sub: '直陈现在时' },
  { id: 'Passé composé', label: 'Passé composé', sub: '复合过去时' },
  { id: 'Imparfait', label: 'Imparfait', sub: '未完成过去时' },
  { id: 'Futur simple', label: 'Futur simple', sub: '简单将来时' },
  { id: 'Conditionnel présent', label: 'Conditionnel présent', sub: '条件式现在时' },
  { id: 'Subjonctif présent', label: 'Subjonctif présent', sub: '虚拟式现在时' },
  { id: 'Plus-que-parfait', label: 'Plus-que-parfait', sub: '愈过去时' },
];

interface Segment {
  id: string;
  french: string;
  chinese: string;
}

const ConjugationView: React.FC = () => {
  const { notebook, currentLevel, savedStories, saveStory, deleteStory } = useAppContext();

  const verbs = notebook.filter(item =>
    (item.conjugations && item.conjugations.length > 0) ||
    (item.pos && item.pos.toLowerCase().startsWith('v'))
  );

  const conjugationHistory = savedStories.filter(s => s.type === 'conjugation');

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [selectedVerbs, setSelectedVerbs] = useState<string[]>([]);
  const [selectedTenses, setSelectedTenses] = useState<string[]>(['Présent']);
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<{ title: string; segments: Segment[] } | null>(null);
  const [streamFinished, setStreamFinished] = useState(false);
  const [userInputs, setUserInputs] = useState<{ [key: string]: string }>({});
  const [showResults, setShowResults] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const toggleVerb = (verb: string) => {
    setSelectedVerbs(prev =>
      prev.includes(verb) ? prev.filter(v => v !== verb) : [...prev, verb]
    );
  };

  const toggleTense = (tense: string) => {
    setSelectedTenses(prev =>
      prev.includes(tense)
        ? prev.length > 1 ? prev.filter(t => t !== tense) : prev
        : [...prev, tense]
    );
  };

  const handleGenerate = async (verbsToUse = selectedVerbs, tensesToUse = selectedTenses) => {
    if (verbsToUse.length === 0 || tensesToUse.length === 0) return;
    setActiveTab('create');
    setLoading(true);
    setStory({ title: '创作中...', segments: [] });
    setStreamFinished(false);
    setShowResults(false);
    setUserInputs({});

    try {
      const stream = generateConjugationStoryStream(verbsToUse, tensesToUse, currentLevel);
      let finalTitle = '变位练习';
      const newSegments: Segment[] = [];
      let idCounter = 1;

      for await (const line of stream) {
        if (line.startsWith('TITLE:')) {
          finalTitle = line.replace('TITLE:', '').trim();
          setStory(prev => ({ ...prev!, title: finalTitle }));
        } else if (line.includes('|||')) {
          const [french, chinese] = line.split('|||');
          if (french && chinese) {
            newSegments.push({ id: (idCounter++).toString(), french: french.trim(), chinese: chinese.trim() });
            setStory(prev => ({ ...prev!, segments: [...newSegments] }));
          }
        }
      }
      setStreamFinished(true);
    } catch (e) {
      showToast('生成中断，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!story || story.segments.length === 0) return;
    const saved: SavedStory = {
      id: Date.now().toString(),
      createdAt: Date.now(),
      theme: selectedVerbs.join('、'),
      title: story.title,
      type: 'conjugation',
      tenses: selectedTenses,
      data: { title: story.title, segments: story.segments },
    };
    saveStory(saved);
    showToast('已保存 ✓');
  };

  const handleDownload = () => {
    if (!story) return;
    const lines = [`TITLE: ${story.title}`, ''];
    story.segments.forEach((seg, i) => {
      const cleanFrench = seg.french.replace(/\{\{(.*?)\|.*?\|.*?\}\}/g, (_, ans) => `[${ans}]`);
      lines.push(`[${i + 1}] ${cleanFrench}`);
      lines.push(`     ${seg.chinese}`);
      lines.push('');
    });
    lines.push('---');
    lines.push(`动词：${selectedVerbs.join('、')}`);
    lines.push(`时态：${selectedTenses.join('、')}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OuiOui_Conjugation_${story.title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderSegment = (segment: Segment, index: number) => {
    const parts = segment.french.split(/(\{\{.*?\}\})/g);
    let blankCount = 0;
    const cleanText = segment.french.replace(/\{\{(.*?)\|.*?\|.*?\}\}/g, '$1');

    return (
      <div key={segment.id} className="p-5 rounded-[2rem] border bg-white border-gray-100 mb-4 shadow-sm">
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-600 text-xs font-black flex items-center justify-center">{index + 1}</span>
            <AudioPlayer text={cleanText} className="bg-violet-50 text-violet-500 w-9 h-9" />
          </div>
          <div className="space-y-3 flex-1">
            <div className="text-lg leading-loose text-gray-800 font-medium flex flex-wrap items-end gap-x-1 gap-y-2">
              {parts.map((part, idx) => {
                const match = part.match(/\{\{(.*?)\|(.*?)\|(.*?)\}\}/);
                if (match) {
                  const [, answer, verbBase, tense] = match;
                  const inputKey = `${segment.id}-${blankCount++}`;
                  const userAnswer = userInputs[inputKey] || '';
                  const isCorrect = userAnswer.toLowerCase().trim() === answer.toLowerCase().trim();
                  return (
                    <span key={idx} className="inline-flex flex-col items-center gap-0.5">
                      {!showResults ? (
                        <input
                          type="text"
                          value={userAnswer}
                          onChange={e => setUserInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                          className="border-b-2 border-violet-300 bg-violet-50 text-center text-violet-700 font-bold min-w-[90px] max-w-[140px] px-2 py-0.5 outline-none focus:border-violet-600 rounded-t-lg text-base"
                          placeholder="___"
                        />
                      ) : (
                        <span className={`px-2.5 py-0.5 rounded-lg border font-bold text-sm ${isCorrect ? 'bg-green-100 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                          {isCorrect
                            ? <span className="flex items-center gap-1"><Check className="w-3 h-3" />{answer}</span>
                            : <span>{userAnswer || '?'} → {answer}</span>
                          }
                        </span>
                      )}
                      <span className="text-[10px] text-violet-400 font-semibold">{verbBase} · {tense}</span>
                    </span>
                  );
                }
                return <span key={idx}>{part}</span>;
              })}
            </div>
            <div className="text-gray-400 text-sm italic border-l-4 border-gray-100 pl-3">{segment.chinese}</div>
          </div>
        </div>
      </div>
    );
  };

  // 历史记录 tab
  if (activeTab === 'history') {
    return (
      <div className="p-6 pb-24 min-h-full bg-background">
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-bold px-6 py-3 rounded-2xl shadow-2xl">
            {toast}
          </div>
        )}
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-gray-800">变位练习历史</h1>
          <button onClick={() => setActiveTab('create')} className="text-sm font-bold bg-white border border-gray-200 px-5 py-2.5 rounded-2xl text-gray-600 hover:bg-gray-50">返回练习</button>
        </header>
        {conjugationHistory.length === 0 ? (
          <div className="text-center py-24 text-gray-300">
            <Clock className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-bold">暂无保存的练习</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {conjugationHistory.map(s => (
              <div key={s.id} className="bg-white p-7 rounded-[2.5rem] border border-gray-100 hover:shadow-xl transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-wrap gap-1.5">
                    {s.theme.split('、').map(v => (
                      <span key={v} className="text-[10px] bg-violet-100 text-violet-600 px-2.5 py-1 rounded-full font-black">{v}</span>
                    ))}
                  </div>
                  <button onClick={() => deleteStory(s.id)} className="text-gray-200 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-black text-gray-800 text-lg mb-2 line-clamp-2">{s.title}</h3>
                {s.tenses && (
                  <div className="flex flex-wrap gap-1 mb-5">
                    {s.tenses.map(t => (
                      <span key={t} className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    setStory(s.data as any);
                    setSelectedVerbs(s.theme.split('、'));
                    setSelectedTenses(s.tenses || ['Présent']);
                    setStreamFinished(true);
                    setActiveTab('create');
                  }}
                  className="w-full py-3 bg-gray-900 text-white font-black rounded-2xl shadow active:scale-95 transition-transform text-sm"
                >
                  重新挑战
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (verbs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-16 text-center min-h-[70vh]">
        <div className="w-28 h-28 bg-violet-50 rounded-[3rem] flex items-center justify-center mb-8">
          <Languages className="w-14 h-14 text-violet-200" />
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-3">暂无动词可练习</h2>
        <p className="text-gray-400 max-w-xs leading-relaxed">
          先在「智能查词」中搜索法语动词（如 aimer、être、aller），收藏后即可在此进行变位训练。
        </p>
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

      <header className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-violet-600 rounded-2xl shadow-xl shadow-violet-200">
            <Languages className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">变位练习</h1>
            <p className="text-gray-400 text-sm">从生词本动词生成变位填空短文</p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab('history')}
          className="p-3.5 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-violet-600 transition-all shadow-sm relative"
        >
          <Clock className="w-5 h-5" />
          {conjugationHistory.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-violet-500 rounded-full border-2 border-white" />
          )}
        </button>
      </header>

      {/* 配置面板 */}
      {!story && !loading && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
            <h2 className="text-xs font-black text-gray-400 mb-5 uppercase tracking-widest">选择动词</h2>
            <div className="flex flex-wrap gap-3">
              {verbs.map(verb => (
                <button
                  key={verb.id}
                  onClick={() => toggleVerb(verb.text)}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-black transition-all ${
                    selectedVerbs.includes(verb.text)
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-200'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {verb.text}
                  {verb.pos && <span className="ml-1.5 text-[10px] opacity-60">{verb.pos}</span>}
                </button>
              ))}
            </div>
            {selectedVerbs.length > 0 && (
              <p className="mt-4 text-xs text-violet-500 font-bold">已选 {selectedVerbs.length} 个动词</p>
            )}
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
            <h2 className="text-xs font-black text-gray-400 mb-5 uppercase tracking-widest">选择时态（可多选）</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {TENSES.map(t => (
                <button
                  key={t.id}
                  onClick={() => toggleTense(t.id)}
                  className={`p-4 rounded-2xl text-left transition-all border-2 ${
                    selectedTenses.includes(t.id)
                      ? 'bg-violet-50 border-violet-500 text-violet-700'
                      : 'bg-gray-50 border-transparent text-gray-500 hover:border-gray-200'
                  }`}
                >
                  <div className="font-black text-sm">{t.label}</div>
                  <div className="text-xs opacity-60 mt-0.5">{t.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedVerbs.length === 0 && (
            <div className="flex items-center gap-3 text-sm text-amber-500 bg-amber-50 p-4 rounded-2xl">
              <Info className="w-5 h-5 shrink-0" />
              <span>请至少选择 1 个动词。</span>
            </div>
          )}

          <button
            onClick={() => handleGenerate()}
            disabled={selectedVerbs.length === 0}
            className="w-full bg-violet-600 text-white py-5 rounded-3xl font-black text-lg shadow-2xl shadow-violet-200 active:scale-95 transition-all disabled:opacity-30"
          >
            生成变位短文
          </button>
        </div>
      )}

      {/* 练习区 */}
      {story && (
        <div className="max-w-3xl mx-auto">
          <div className="sticky top-4 z-30 mb-8">
            <div className="bg-gray-900 rounded-[2rem] p-6 shadow-2xl text-white">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h2 className="font-black text-xl truncate">{story.title}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedVerbs.map(v => (
                      <span key={v} className="text-[10px] bg-violet-500/30 text-violet-300 px-2 py-0.5 rounded-full font-bold">{v}</span>
                    ))}
                    {selectedTenses.map(t => (
                      <span key={t} className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={handleDownload} title="导出 TXT" className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                    <FileText className="w-4 h-4" />
                  </button>
                  <button onClick={handleSave} title="保存" className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                    <Save className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setStory(null); setStreamFinished(false); setShowResults(false); setUserInputs({}); }} title="重新选择" className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1 mb-10">
            {story.segments.map((seg, i) => renderSegment(seg, i))}
            {loading && (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-400 font-black text-sm">AI 正在构建变位场景...</p>
              </div>
            )}
          </div>

          {streamFinished && (
            <div className="grid grid-cols-2 gap-4">
              {!showResults ? (
                <button
                  onClick={() => setShowResults(true)}
                  className="col-span-2 bg-green-500 text-white py-5 rounded-[2rem] font-black text-lg shadow-2xl shadow-green-100 active:scale-95 transition-all"
                >
                  核对答案
                </button>
              ) : (
                <>
                  <button onClick={() => handleGenerate()} className="bg-violet-600 text-white py-4 rounded-[2rem] font-black active:scale-95 transition-all shadow-lg shadow-violet-200">
                    重新生成
                  </button>
                  <button onClick={() => { setShowResults(false); setUserInputs({}); }} className="bg-gray-100 text-gray-700 py-4 rounded-[2rem] font-black active:scale-95 transition-all">
                    清除重练
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConjugationView;
