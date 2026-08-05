
import React, { useState, useRef, useEffect } from 'react';
import { Languages, RefreshCw, Info, Check, Save, FileText, Headphones, Clock, Trash2, Play, Pause } from 'lucide-react';
import { useAppContext } from '../App';
import { generateConjugationStoryStream, generateErrorHint, generatePracticeSummary, PracticeSummary } from '../services/geminiService';
import { logFeatureEvent, logWrongAnswers } from '../services/analyticsService';
import { SavedStory, WrongAnswer } from '../types';
import AudioPlayer from '../components/AudioPlayer';
import { cancelSpeech, speakFrench } from '../services/speechService';

const buildConjHTMLPlayer = (title: string, subtitle: string, items: { id: number; fr: string; cn: string }[]) => `<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · OuiOui AI</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f6fb;padding:20px;color:#1a1a2e}
h1{font-size:1.4rem;font-weight:900;margin-bottom:4px}.meta{font-size:.75rem;color:#888;margin-bottom:20px}
.ctrl{position:sticky;top:16px;z-index:9;background:#fff;border-radius:14px;padding:12px 16px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;box-shadow:0 2px 12px #0001}
.btn{background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:9px 18px;font-size:.85rem;font-weight:700;cursor:pointer}.btn:hover{background:#6d28d9}.btn.sec{background:#f0f0f2;color:#444}
.rate-wrap{display:flex;align-items:center;gap:6px;font-size:.75rem;color:#666}
.card{background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:10px;border:2px solid #eef0f6;cursor:pointer;display:flex;gap:12px;align-items:flex-start;transition:border-color .2s,background .2s}
.card:hover{border-color:#c4b5fd}.card.active{border-color:#7c3aed;background:#f5f3ff}
.num{min-width:28px;height:28px;background:#7c3aed;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:900}
.fr{font-size:.95rem;font-weight:600;margin-bottom:3px}.cn{font-size:.8rem;color:#888}
</style></head><body>
<h1>${title}</h1><p class="meta">${subtitle} · OuiOui AI 导出</p>
<div class="ctrl">
  <button class="btn" onclick="playAll()">▶ 全部朗读</button>
  <button class="btn sec" onclick="stopAll()">■ 停止</button>
  <div class="rate-wrap">语速 <input id="rateR" type="range" min=".5" max="1.2" step=".05" value=".85" style="width:80px" oninput="document.getElementById('rateV').textContent=this.value"> <span id="rateV">.85</span></div>
</div>
${items.map(s => `<div class="card" id="c${s.id}" onclick="speakOne(${s.id})"><div class="num">${s.id}</div><div><div class="fr">${s.fr}</div><div class="cn">${s.cn}</div></div></div>`).join('')}
<script>
const SS=${JSON.stringify(items)};let cur=0,playing=false;
function rate(){return parseFloat(document.getElementById('rateR').value);}
function voice(){return speechSynthesis.getVoices().find(v=>v.lang.startsWith('fr'))||null;}
function highlight(id){document.querySelectorAll('.card').forEach(c=>c.classList.remove('active'));const el=document.getElementById('c'+id);if(el){el.classList.add('active');el.scrollIntoView({behavior:'smooth',block:'center'});}}
function speakOne(id){speechSynthesis.cancel();playing=false;const s=SS.find(x=>x.id===id);if(!s)return;highlight(id);const u=new SpeechSynthesisUtterance(s.fr);u.lang='fr-FR';u.rate=rate();const v=voice();if(v)u.voice=v;u.onend=()=>document.querySelectorAll('.card').forEach(c=>c.classList.remove('active'));speechSynthesis.speak(u);}
function playAll(){speechSynthesis.cancel();cur=0;playing=true;next();}
function next(){if(!playing||cur>=SS.length){playing=false;document.querySelectorAll('.card').forEach(c=>c.classList.remove('active'));return;}const s=SS[cur];highlight(s.id);const u=new SpeechSynthesisUtterance(s.fr);u.lang='fr-FR';u.rate=rate();const v=voice();if(v)u.voice=v;u.onend=()=>{cur++;setTimeout(next,600);};speechSynthesis.speak(u);}
function stopAll(){speechSynthesis.cancel();playing=false;document.querySelectorAll('.card').forEach(c=>c.classList.remove('active'));}
if(speechSynthesis.onvoiceschanged!==undefined)speechSynthesis.onvoiceschanged=()=>{};
</script></body></html>`;

const TENSES = [
  { id: 'Présent', label: 'Présent', sub: '直陈现在时' },
  { id: 'Passé composé', label: 'Passé composé', sub: '复合过去时' },
  { id: 'Imparfait', label: 'Imparfait', sub: '未完成过去时' },
  { id: 'Futur simple', label: 'Futur simple', sub: '简单将来时' },
  { id: 'Conditionnel présent', label: 'Conditionnel présent', sub: '条件式现在时' },
  { id: 'Subjonctif présent', label: 'Subjonctif présent', sub: '虚拟式现在时' },
  { id: 'Plus-que-parfait', label: 'Plus-que-parfait', sub: '愈过去时' },
  { id: 'Impératif présent', label: 'Impératif présent', sub: '命令式现在时' },
];

interface Segment {
  id: string;
  french: string;
  chinese: string;
}

const ConjugationView: React.FC = () => {
  const { notebook, currentLevel, savedStories, saveStory, deleteStory, addWrongAnswers } = useAppContext();

  // 提取动词并去重：若收藏的是变位形式（如 parlons），自动使用原形（parler）
  const verbMap = new Map<string, typeof notebook[0]>();
  notebook
    .filter(item =>
      (item.conjugations && item.conjugations.length > 0) ||
      (item.pos && item.pos.toLowerCase().startsWith('v'))
    )
    .forEach(item => {
      const inf = item.detectedForm?.infinitive || item.text;
      if (!verbMap.has(inf)) verbMap.set(inf, { ...item, text: inf });
    });
  const verbs = Array.from(verbMap.values());

  const conjugationHistory = savedStories.filter(s => s.type === 'conjugation');

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [selectedVerbs, setSelectedVerbs] = useState<string[]>([]);
  const [selectedTenses, setSelectedTenses] = useState<string[]>(['Présent']);
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<{ title: string; segments: Segment[] } | null>(null);
  const [streamFinished, setStreamFinished] = useState(false);
  const [userInputs, setUserInputs] = useState<{ [key: string]: string }>({});
  const [showResults, setShowResults] = useState(false);
  const [hints, setHints] = useState<{ [inputKey: string]: string }>({});
  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingIdx, setCurrentPlayingIdx] = useState(-1);
  const isPlayingRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const stopGlobalSpeech = () => {
    cancelSpeech();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentPlayingIdx(-1);
  };

  const playFromSentence = async (idx: number, segments: Segment[]) => {
    if (!isPlayingRef.current || idx >= segments.length) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentPlayingIdx(-1);
      return;
    }
    setCurrentPlayingIdx(idx);
    const text = segments[idx].french.replace(/\{\{(.*?)\|.*?\|.*?\}\}/g, '$1');
    await speakFrench(text, {
      onEnd: () => {
        if (isPlayingRef.current) setTimeout(() => void playFromSentence(idx + 1, segments), 500);
      },
      onError: () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        setCurrentPlayingIdx(-1);
      },
    });
  };

  const playFullStory = () => {
    if (isPlaying) { stopGlobalSpeech(); return; }
    if (!story) return;
    isPlayingRef.current = true;
    setIsPlaying(true);
    playFromSentence(0, story.segments);
  };

  const seekTo = (idx: number) => {
    if (!story) return;
    cancelSpeech();
    isPlayingRef.current = true;
    setIsPlaying(true);
    void playFromSentence(idx, story.segments);
  };

  useEffect(() => {
    if (currentPlayingIdx >= 0) {
      document.getElementById(`conj-seg-${currentPlayingIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentPlayingIdx]);

  const handleCheckResults = () => {
    if (!story) return;
    const wrongs: WrongAnswer[] = [];
    const wrongKeys: Array<{ inputKey: string; answer: string; userAnswer: string; infinitive: string; tense: string; context: string }> = [];
    story.segments.forEach(seg => {
      const parts = seg.french.split(/(\{\{.*?\}\})/g);
      let blankCount = 0;
      parts.forEach(part => {
        const match = part.match(/\{\{(.*?)\|(.*?)\|(.*?)\}\}/);
        if (match) {
          const [, answer, verbBase, tense] = match;
          const inputKey = `${seg.id}-${blankCount++}`;
          const userAnswer = userInputs[inputKey] || '';
          if (userAnswer.toLowerCase().trim() !== answer.toLowerCase().trim()) {
            const context = seg.french.replace(/\{\{.*?\|.*?\|.*?\}\}/g, '_____');
            wrongs.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              createdAt: Date.now(),
              sourceType: 'conjugation',
              answer,
              userAnswer,
              context,
              chinese: seg.chinese,
              infinitive: verbBase,
              tense,
              mastered: false,
            });
            wrongKeys.push({ inputKey, answer, userAnswer, infinitive: verbBase, tense, context });
          }
        }
      });
    });
    if (wrongs.length > 0) {
      addWrongAnswers(wrongs);
      logWrongAnswers(wrongs.map(w => ({
        source_type: w.sourceType,
        answer: w.answer,
        user_answer: w.userAnswer,
        infinitive: w.infinitive,
        tense: w.tense,
      })));
      showToast(`已记录 ${wrongs.length} 道错题`);
    }
    setShowResults(true);
    setHints({});
    setWrongCount(wrongs.length);
    setSummary(null);

    wrongKeys.forEach(({ inputKey, answer, userAnswer, infinitive, tense, context }) => {
      generateErrorHint({ userAnswer, correctAnswer: answer, context, type: 'conjugation', infinitive, tense })
        .then(hint => { if (hint) setHints(prev => ({ ...prev, [inputKey]: hint })); });
    });

    if (wrongKeys.length > 0) {
      setSummaryLoading(true);
      generatePracticeSummary(
        wrongKeys.map(w => ({ userAnswer: w.userAnswer, correctAnswer: w.answer, context: w.context, type: 'conjugation', infinitive: w.infinitive, tense: w.tense })),
        story!.segments.length
      ).then(s => { setSummary(s); setSummaryLoading(false); });
    }
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
    logFeatureEvent('conjugation_generate');
    setActiveTab('create');
    stopGlobalSpeech();
    setLoading(true);
    setStory({ title: '创作中...', segments: [] });
    setStreamFinished(false);
    setShowResults(false);
    setUserInputs({});
    setHints({});
    setSummary(null);
    setSummaryLoading(false);
    setWrongCount(0);

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

  // 导出双版本文本（填空 + 答案）
  const handleDownload = () => {
    if (!story) return;
    const blankLines = story.segments.map((seg, i) => {
      const blank = seg.french.replace(/\{\{(.*?)\|(.*?)\|(.*?)\}\}/g, (_: string, __: string, verb: string, tense: string) => `___(${verb} · ${tense})`);
      return `${i + 1}. ${blank}\n   ${seg.chinese}`;
    }).join('\n\n');
    const answerLines = story.segments.map((seg, i) => {
      const answered = seg.french.replace(/\{\{(.*?)\|.*?\|.*?\}\}/g, (_: string, ans: string) => `[${ans}]`);
      return `${i + 1}. ${answered}\n   ${seg.chinese}`;
    }).join('\n\n');
    const sep = '─'.repeat(36);
    const content = `TITLE: ${story.title}\n动词：${selectedVerbs.join('、')}　时态：${selectedTenses.join('、')}\n\n` +
      `${sep}\n✍️  填空练习版\n${sep}\n\n${blankLines}\n\n` +
      `${sep}\n✅  答案版\n${sep}\n\n${answerLines}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OuiOui_变位练习_${story.title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 导出 HTML 朗读播放器
  const handleExportHTML = () => {
    if (!story) return;
    const items = story.segments.map((s, i) => ({
      id: i + 1,
      fr: s.french.replace(/\{\{(.*?)\|.*?\|.*?\}\}/g, '$1'),
      cn: s.chinese,
    }));
    const subtitle = `动词：${selectedVerbs.join('、')} · ${selectedTenses.join('、')}`;
    const html = buildConjHTMLPlayer(story.title, subtitle, items);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OuiOui_变位练习_播放器.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出 HTML 播放器');
  };

  const renderSegment = (segment: Segment, index: number) => {
    const parts = segment.french.split(/(\{\{.*?\}\})/g);
    let blankCount = 0;
    const cleanText = segment.french.replace(/\{\{(.*?)\|.*?\|.*?\}\}/g, '$1');
    const isActive = index === currentPlayingIdx;

    return (
      <div key={segment.id} id={`conj-seg-${index}`} className={`p-5 rounded-[2rem] border mb-4 shadow-sm transition-all duration-300 ${isActive ? 'bg-violet-50 border-violet-300 shadow-violet-100' : 'bg-white border-gray-100'}`}>
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
                        <span className={`px-2.5 py-1 rounded-lg border font-bold text-sm ${isCorrect ? 'bg-green-100 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                          {isCorrect
                            ? <span className="flex items-center gap-1"><Check className="w-3 h-3" />{answer}</span>
                            : <span className="flex flex-col gap-0.5">
                                <span>{userAnswer || '?'} → {answer}</span>
                                {hints[inputKey]
                                  ? <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">💡 {hints[inputKey]}</span>
                                  : <span className="text-[10px] text-red-300 animate-pulse font-normal">AI 分析中...</span>
                                }
                              </span>
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
                  <button onClick={handleExportHTML} title="导出 HTML 朗读播放器" className="flex flex-col items-center gap-1 px-2.5 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                    <Headphones className="w-4 h-4" />
                    <span className="text-[9px] text-gray-400">音频</span>
                  </button>
                  <button onClick={handleDownload} title="导出文本（填空版+答案版）" className="flex flex-col items-center gap-1 px-2.5 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                    <FileText className="w-4 h-4" />
                    <span className="text-[9px] text-gray-400">文本</span>
                  </button>
                  <button onClick={handleSave} title="保存" className="flex flex-col items-center gap-1 px-2.5 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                    <Save className="w-4 h-4" />
                    <span className="text-[9px] text-gray-400">保存</span>
                  </button>
                  <button onClick={() => { stopGlobalSpeech(); setStory(null); setStreamFinished(false); setShowResults(false); setUserInputs({}); setHints({}); }} title="重新选择" className="flex flex-col items-center gap-1 px-2.5 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                    <RefreshCw className="w-4 h-4" />
                    <span className="text-[9px] text-gray-400">重选</span>
                  </button>
                </div>
              </div>
              {/* 播放控制栏 */}
              <div className="flex items-center gap-4">
                <button
                  onClick={playFullStory}
                  className="w-12 h-12 bg-violet-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-xl shadow-violet-900/50 hover:scale-105 active:scale-95 transition-all"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-gray-400">
                      {currentPlayingIdx >= 0 ? `第 ${currentPlayingIdx + 1} / ${story.segments.length} 句` : '点击进度条可跳转'}
                    </span>
                    {currentPlayingIdx >= 0 && (
                      <span className="text-xs text-gray-500">{Math.round((currentPlayingIdx + 1) / story.segments.length * 100)}%</span>
                    )}
                  </div>
                  <div
                    className="h-2.5 bg-white/10 rounded-full cursor-pointer relative group"
                    onClick={e => {
                      const pct = e.nativeEvent.offsetX / e.currentTarget.offsetWidth;
                      const idx = Math.max(0, Math.min(Math.floor(pct * story.segments.length), story.segments.length - 1));
                      seekTo(idx);
                    }}
                  >
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-300 pointer-events-none"
                      style={{ width: `${currentPlayingIdx >= 0 ? (currentPlayingIdx + 1) / story.segments.length * 100 : 0}%` }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow pointer-events-none transition-all duration-300 opacity-0 group-hover:opacity-100"
                      style={{ left: `calc(${currentPlayingIdx >= 0 ? (currentPlayingIdx + 1) / story.segments.length * 100 : 0}% - 6px)` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {showResults && (
            <div className="mb-6 bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">本次练习总结</p>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-black text-gray-800">
                  {story.segments.length - wrongCount} / {story.segments.length}
                </span>
                {wrongCount === 0
                  ? <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">🎉 全部正确！</span>
                  : <span className="text-sm font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full">❌ {wrongCount} 处错误</span>
                }
              </div>
              {wrongCount > 0 && (
                summaryLoading ? (
                  <p className="text-sm text-gray-400 animate-pulse">AI 正在归纳错误类型...</p>
                ) : summary && (
                  <>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {summary.errorTypes.map((et, i) => (
                        <span key={i} className="px-3 py-1 bg-red-50 border border-red-100 text-red-600 rounded-full text-xs font-bold">
                          {et.label} ×{et.count}
                        </span>
                      ))}
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800 leading-relaxed">
                      💡 {summary.suggestion}
                    </div>
                  </>
                )
              )}
            </div>
          )}

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
                  onClick={handleCheckResults}
                  className="col-span-2 bg-green-500 text-white py-5 rounded-[2rem] font-black text-lg shadow-2xl shadow-green-100 active:scale-95 transition-all"
                >
                  核对答案
                </button>
              ) : (
                <>
                  <button onClick={() => handleGenerate()} className="bg-violet-600 text-white py-4 rounded-[2rem] font-black active:scale-95 transition-all shadow-lg shadow-violet-200">
                    重新生成
                  </button>
                  <button onClick={() => { stopGlobalSpeech(); setShowResults(false); setUserInputs({}); setHints({}); }} className="bg-gray-100 text-gray-700 py-4 rounded-[2rem] font-black active:scale-95 transition-all">
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
