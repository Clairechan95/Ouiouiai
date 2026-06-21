
import React, { useState, useRef, useEffect } from 'react';
import { PenTool, Play, Pause, Save, Trash2, Clock, FileText, Headphones, Sparkles, Info, ArrowLeft, Check } from 'lucide-react';
import { generateClozeStoryStream, generateErrorHint } from '../services/geminiService';
import { logFeatureEvent, logWrongAnswers } from '../services/analyticsService';
import { useAppContext } from '../App';
import { ClozeStory, SavedStory, StorySegment, WrongAnswer } from '../types';
import AudioPlayer from '../components/AudioPlayer';

// 生成离线 HTML 朗读播放器
const buildHTMLPlayer = (title: string, subtitle: string, items: { id: number; fr: string; cn: string }[]) => `<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · OuiOui AI</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f6fb;padding:20px;color:#1a1a2e}
h1{font-size:1.4rem;font-weight:900;margin-bottom:4px}
.meta{font-size:.75rem;color:#888;margin-bottom:20px}
.ctrl{position:sticky;top:16px;z-index:9;background:#fff;border-radius:14px;padding:12px 16px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;box-shadow:0 2px 12px #0001}
.btn{background:#6366f1;color:#fff;border:none;border-radius:10px;padding:9px 18px;font-size:.85rem;font-weight:700;cursor:pointer;transition:background .15s}
.btn:hover{background:#4f46e5}.btn.sec{background:#f0f0f2;color:#444}
.rate-wrap{display:flex;align-items:center;gap:6px;font-size:.75rem;color:#666}
.card{background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:10px;border:2px solid #eef0f6;cursor:pointer;display:flex;gap:12px;align-items:flex-start;transition:border-color .2s,background .2s}
.card:hover{border-color:#a5b4fc}.card.active{border-color:#6366f1;background:#f0f1ff}
.num{min-width:28px;height:28px;background:#6366f1;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:900}
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

// 按 CECRL 等级预设主题
const PREDEFINED_THEMES: Record<string, string[]> = {
  '初级 (A1-A2)': [
    '日常作息', '饮食与餐厅', '家庭与朋友', '天气与季节', '交通出行',
    '购物与价格', '数字与时间', '居家与家具', '身体与健康', '学校与学习',
    '颜色与形状', '国家与语言', '动物与自然', '爱好与运动',
  ],
  '中级 (B1-B2)': [
    '旅行与假期', '职业与工作', '城市生活', '人际关系', '媒体与科技',
    '健康与饮食', '娱乐与文化', '教育与成长', '体育与运动', '环境与自然',
    '艺术与音乐', '社会问题', '历史与传统', '时尚与消费',
  ],
  '高级 (C1-C2)': [
    '哲学与伦理', '经济与金融', '政治与社会', '文学与艺术', '科学与技术',
    '历史与文明', '语言与文化', '心理与情感', '环境与可持续发展', '医学与健康',
    '法律与司法', '全球化与外交', '创新与创业', '气候与能源',
  ],
};

const PracticeView: React.FC = () => {
  const { notebook, currentLevel, savedStories, saveStory, deleteStory, addWrongAnswers } = useAppContext();
  const [activeTab, setActiveTab] = useState<'create' | 'saved'>('create');

  // 两步选择状态
  const [step, setStep] = useState<'theme' | 'vocab'>('theme');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [selectedVocabIds, setSelectedVocabIds] = useState<Set<string>>(new Set());

  // 生成与练习状态
  const [loading, setLoading] = useState(false);
  const [clozeData, setClozeData] = useState<ClozeStory | null>(null);
  const [streamFinished, setStreamFinished] = useState(false);
  const [userInputs, setUserInputs] = useState<{ [key: string]: string }>({});
  const [showResults, setShowResults] = useState(false);
  const [hints, setHints] = useState<{ [inputKey: string]: string }>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingIdx, setCurrentPlayingIdx] = useState(-1);
  const isPlayingRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const stopGlobalSpeech = () => {
    window.speechSynthesis.cancel();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentPlayingIdx(-1);
  };

  const resetToStart = () => {
    setClozeData(null);
    setStreamFinished(false);
    setShowResults(false);
    setUserInputs({});
    setHints({});
    setStep('theme');
    setSelectedTheme('');
    setSelectedVocabIds(new Set());
    stopGlobalSpeech();
  };

  // 进入第二步：初始化全选
  const goToVocab = () => {
    setSelectedVocabIds(new Set(notebook.map(i => i.id)));
    setStep('vocab');
  };

  const toggleVocab = (id: string) => {
    setSelectedVocabIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const playFromSentence = (idx: number, segments: StorySegment[]) => {
    if (!isPlayingRef.current || idx >= segments.length) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentPlayingIdx(-1);
      return;
    }
    setCurrentPlayingIdx(idx);
    const text = segments[idx].french.replace(/\{\{(.*?)\}\}/g, '$1');
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr'));
    if (frVoice) utterance.voice = frVoice;
    utterance.lang = 'fr-FR';
    utterance.rate = 0.85;
    utterance.onend = () => setTimeout(() => playFromSentence(idx + 1, segments), 500);
    utterance.onerror = () => { isPlayingRef.current = false; setIsPlaying(false); setCurrentPlayingIdx(-1); };
    window.speechSynthesis.speak(utterance);
  };

  const playFullStory = () => {
    if (isPlaying) { stopGlobalSpeech(); return; }
    if (!clozeData) return;
    isPlayingRef.current = true;
    setIsPlaying(true);
    playFromSentence(0, clozeData.segments);
  };

  const seekTo = (idx: number) => {
    if (!clozeData) return;
    window.speechSynthesis.cancel();
    isPlayingRef.current = true;
    setIsPlaying(true);
    playFromSentence(idx, clozeData.segments);
  };

  useEffect(() => {
    if (currentPlayingIdx >= 0) {
      document.getElementById(`seg-${currentPlayingIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentPlayingIdx]);

  // 导出双版本文本（填空 + 答案）
  const downloadTranscript = () => {
    if (!clozeData) return;
    const blankSection = clozeData.segments.map((s, i) =>
      `${i + 1}. ${s.french.replace(/\{\{(.*?)\}\}/g, '___')}\n   ${s.chinese}`
    ).join('\n\n');
    const answerSection = clozeData.segments.map((s, i) =>
      `${i + 1}. ${s.french.replace(/\{\{(.*?)\}\}/g, '[$1]')}\n   ${s.chinese}`
    ).join('\n\n');
    const content = `TITLE: ${clozeData.title}　主题：${selectedTheme}\n\n` +
      `${'─'.repeat(36)}\n✍️  填空练习版\n${'─'.repeat(36)}\n\n${blankSection}\n\n` +
      `${'─'.repeat(36)}\n✅  答案版\n${'─'.repeat(36)}\n\n${answerSection}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OuiOui_${selectedTheme}_${clozeData.title}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 导出 HTML 朗读播放器（离线可用，支持任意设备）
  const exportHTML = () => {
    if (!clozeData) return;
    const items = clozeData.segments.map((s, i) => ({
      id: i + 1,
      fr: s.french.replace(/\{\{(.*?)\}\}/g, '$1'),
      cn: s.chinese,
    }));
    const html = buildHTMLPlayer(clozeData.title, selectedTheme, items);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OuiOui_${selectedTheme}_播放器.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出 HTML 播放器，可在任意设备浏览器中打开收听');
  };

  const handleGenerate = async () => {
    const selectedItems = notebook.filter(i => selectedVocabIds.has(i.id));
    if (selectedItems.length < 3) return;
    logFeatureEvent('story_generate');
    stopGlobalSpeech();
    setLoading(true);
    setClozeData({ title: '创作中...', segments: [] });
    setStreamFinished(false);
    setShowResults(false);
    setUserInputs({});

    try {
      const shuffled = [...selectedItems].sort(() => 0.5 - Math.random());
      const words = shuffled.slice(0, 8).map(i => i.detectedForm?.infinitive || i.text);
      const stream = generateClozeStoryStream(words, selectedTheme, currentLevel);

      let finalTitle = '未命名故事';
      const segments: StorySegment[] = [];
      let idCounter = 1;

      for await (const line of stream) {
        if (line.startsWith('TITLE:')) {
          finalTitle = line.replace('TITLE:', '').trim();
          setClozeData(prev => ({ ...prev!, title: finalTitle }));
        } else if (line.includes('|||')) {
          const [french, chinese] = line.split('|||');
          segments.push({ id: (idCounter++).toString(), french: french.trim(), chinese: chinese.trim() });
          setClozeData(prev => ({ ...prev!, segments: [...segments] }));
        }
      }
      setStreamFinished(true);
    } catch {
      showToast('生成中断，请检查 API 配置或网络');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckResults = () => {
    if (!clozeData) return;
    const wrongs: WrongAnswer[] = [];
    const wrongKeys: Array<{ inputKey: string; answer: string; userAnswer: string; context: string }> = [];
    clozeData.segments.forEach(seg => {
      const parts = seg.french.split(/(\{\{.*?\}\})/g);
      let clozeCount = 0;
      parts.forEach(part => {
        const match = part.match(/\{\{(.*?)\}\}/);
        if (match) {
          const answer = match[1];
          const inputKey = `${seg.id}-${clozeCount++}`;
          const userAnswer = userInputs[inputKey] || '';
          if (userAnswer.toLowerCase().trim() !== answer.toLowerCase().trim()) {
            const context = seg.french.replace(/\{\{.*?\}\}/g, '_____');
            wrongs.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              createdAt: Date.now(),
              sourceType: 'cloze',
              answer,
              userAnswer,
              context,
              chinese: seg.chinese,
              theme: selectedTheme,
              mastered: false,
            });
            wrongKeys.push({ inputKey, answer, userAnswer, context });
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
        theme: w.theme,
      })));
      showToast(`已记录 ${wrongs.length} 道错题`);
    }
    setShowResults(true);
    setHints({});
    wrongKeys.forEach(({ inputKey, answer, userAnswer, context }) => {
      generateErrorHint({ userAnswer, correctAnswer: answer, context, type: 'cloze' })
        .then(hint => { if (hint) setHints(prev => ({ ...prev, [inputKey]: hint })); });
    });
  };

  const handleSaveStory = () => {
    if (clozeData && clozeData.segments.length > 0) {
      saveStory({ id: Date.now().toString(), createdAt: Date.now(), theme: selectedTheme || '综合', title: clozeData.title, data: clozeData });
      showToast('已保存 ✓');
    }
  };

  const renderSegment = (segment: StorySegment, segIndex: number) => {
    const parts = segment.french.split(/(\{\{.*?\}\})/g);
    let clozeCount = 0;
    const cleanText = segment.french.replace(/\{\{(.*?)\}\}/g, '$1');
    const isActive = segIndex === currentPlayingIdx;

    return (
      <div
        key={segment.id}
        id={`seg-${segIndex}`}
        className={`p-6 rounded-[2rem] border mb-6 shadow-sm transition-all duration-300 ${isActive ? 'bg-indigo-50 border-indigo-300 shadow-indigo-100' : 'bg-white border-gray-100'}`}
      >
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
                          onChange={e => setUserInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                          className="border-b-2 border-primary/20 bg-primary/5 text-center text-primary font-bold w-20 sm:w-28 px-2 py-1 outline-none focus:border-primary rounded-t-xl text-sm sm:text-base"
                        />
                      ) : (
                        <span className={`px-2 py-1 rounded-xl border text-base font-bold ${isCorrect ? 'bg-green-100 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                          {isCorrect
                            ? answer
                            : <span className="flex flex-col gap-0.5">
                                <span>{userAnswer || '-'} → {answer}</span>
                                {hints[inputKey]
                                  ? <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">💡 {hints[inputKey]}</span>
                                  : <span className="text-[10px] text-red-300 animate-pulse font-normal">AI 分析中...</span>
                                }
                              </span>
                          }
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

  // ── 历史记录 Tab ─────────────────────────────────────────────────────────
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
                <button
                  onClick={() => {
                    setClozeData(story.data);
                    setSelectedTheme(story.theme);
                    setActiveTab('create');
                    setStreamFinished(true);
                  }}
                  className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-transform"
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

  // ── 创建 Tab ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 pb-32 min-h-full bg-background">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-bold px-6 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-200"><PenTool className="w-6 h-6 text-white" /></div>
          <h1 className="text-3xl font-black text-gray-800">创意听写</h1>
        </div>
        <button onClick={() => setActiveTab('saved')} className="p-4 bg-white border border-gray-100 rounded-3xl text-gray-400 hover:text-primary transition-all shadow-sm relative group">
          <Clock className="w-7 h-7 group-hover:scale-110 transition-transform" />
          {savedStories.filter(s => !s.type || s.type === 'cloze').length > 0 && <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />}
        </button>
      </header>

      {/* ── 步骤一：选择主题 ── */}
      {!clozeData && !loading && step === 'theme' && (
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">第一步</p>
            <h2 className="text-2xl font-black text-gray-800">选择故事主题</h2>
            <p className="text-gray-400 text-sm mt-1">适配您的水平：{currentLevel}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {(PREDEFINED_THEMES[currentLevel] || PREDEFINED_THEMES['初级 (A1-A2)']).map(theme => (
              <button
                key={theme}
                onClick={() => setSelectedTheme(theme)}
                className={`relative px-4 py-4 rounded-2xl text-sm font-black text-left transition-all ${
                  selectedTheme === theme
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'bg-white text-gray-600 border border-gray-100 hover:border-primary/30 hover:bg-primary/5'
                }`}
              >
                {selectedTheme === theme && <Check className="absolute top-2 right-2 w-3.5 h-3.5 opacity-80" />}
                {theme}
              </button>
            ))}
          </div>
          {notebook.length < 3 && (
            <div className="flex items-center gap-3 text-sm text-amber-500 bg-amber-50 p-4 rounded-2xl mb-4">
              <Info className="w-5 h-5 shrink-0" />
              <span>请先收藏至少 3 个单词，再来挑战听写。</span>
            </div>
          )}
          <button
            onClick={goToVocab}
            disabled={!selectedTheme || notebook.length < 3}
            className="w-full bg-primary text-white py-5 rounded-3xl font-black text-lg shadow-2xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-30"
          >
            下一步：选择词汇 →
          </button>
        </div>
      )}

      {/* ── 步骤二：选择词汇 ── */}
      {!clozeData && !loading && step === 'vocab' && (
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setStep('theme')} className="flex items-center gap-2 text-gray-400 hover:text-gray-700 mb-6 font-bold text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回主题选择
          </button>
          <div className="mb-6">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">第二步</p>
            <h2 className="text-2xl font-black text-gray-800">选择要训练的词汇</h2>
            <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-primary/10 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-primary text-xs font-black">{selectedTheme}</span>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">生词本 ({notebook.length})</span>
              <button
                onClick={() => {
                  if (selectedVocabIds.size === notebook.length) setSelectedVocabIds(new Set());
                  else setSelectedVocabIds(new Set(notebook.map(i => i.id)));
                }}
                className="text-xs font-bold text-primary/70 hover:text-primary transition-colors"
              >
                {selectedVocabIds.size === notebook.length ? '取消全选' : '全选'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2.5 max-h-56 overflow-y-auto">
              {notebook.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleVocab(item.id)}
                  className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    selectedVocabIds.has(item.id)
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {item.text}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">已选 {selectedVocabIds.size} 个词汇（最多取 8 个生成短文）</p>
          </div>

          {selectedVocabIds.size < 3 && (
            <div className="flex items-center gap-3 text-sm text-amber-500 bg-amber-50 p-4 rounded-2xl mb-4">
              <Info className="w-5 h-5 shrink-0" />
              <span>至少选择 3 个词汇。</span>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={selectedVocabIds.size < 3}
            className="w-full bg-primary text-white py-5 rounded-3xl font-black text-xl shadow-2xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-30"
          >
            生成听写挑战
          </button>
        </div>
      )}

      {/* ── 故事生成中 ── */}
      {loading && !clozeData?.segments.length && (
        <div className="max-w-2xl mx-auto text-center py-24">
          <div className="w-14 h-14 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-5"></div>
          <p className="text-gray-400 font-black">AI 正在斟酌遣词造句...</p>
        </div>
      )}

      {/* ── 练习区 ── */}
      {clozeData && (
        <div className="max-w-4xl mx-auto">
          <div className="sticky top-6 z-30 mb-10">
            <div className="bg-gray-900 rounded-[2.5rem] p-6 shadow-2xl text-white">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex-1 min-w-0">
                  <h2 className="font-black text-xl sm:text-2xl truncate">{clozeData.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-gray-400">{selectedTheme}</span>
                    <span className="text-[10px] text-gray-500">{currentLevel}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={exportHTML} className="flex flex-col items-center gap-1 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors" title="导出 HTML 朗读播放器">
                    <Headphones className="w-5 h-5" />
                    <span className="text-[10px] text-gray-400">音频</span>
                  </button>
                  <button onClick={downloadTranscript} className="flex flex-col items-center gap-1 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors" title="下载文稿（填空版+答案版）">
                    <FileText className="w-5 h-5" />
                    <span className="text-[10px] text-gray-400">文本</span>
                  </button>
                  <button onClick={handleSaveStory} className="flex flex-col items-center gap-1 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors" title="保存故事">
                    <Save className="w-5 h-5" />
                    <span className="text-[10px] text-gray-400">保存</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={playFullStory} className="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shrink-0 shadow-xl shadow-primary/50 hover:scale-105 active:scale-95 transition-all">
                  {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400">
                      {currentPlayingIdx >= 0 ? `第 ${currentPlayingIdx + 1} / ${clozeData.segments.length} 句` : '点击进度条可跳转'}
                    </span>
                    {currentPlayingIdx >= 0 && (
                      <span className="text-xs text-gray-500">{Math.round((currentPlayingIdx + 1) / clozeData.segments.length * 100)}%</span>
                    )}
                  </div>
                  <div
                    className="h-3 bg-white/10 rounded-full cursor-pointer relative group"
                    onClick={e => {
                      const pct = e.nativeEvent.offsetX / e.currentTarget.offsetWidth;
                      const idx = Math.max(0, Math.min(Math.floor(pct * clozeData.segments.length), clozeData.segments.length - 1));
                      seekTo(idx);
                    }}
                  >
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300 pointer-events-none"
                      style={{ width: `${currentPlayingIdx >= 0 ? (currentPlayingIdx + 1) / clozeData.segments.length * 100 : 0}%` }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md pointer-events-none transition-all duration-300 opacity-0 group-hover:opacity-100"
                      style={{ left: `calc(${currentPlayingIdx >= 0 ? (currentPlayingIdx + 1) / clozeData.segments.length * 100 : 0}% - 7px)` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-12">
            {clozeData.segments.map((seg, i) => renderSegment(seg, i))}
            {loading && (
              <div className="text-center py-16">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-400 font-black">AI 正在斟酌遣词造句...</p>
              </div>
            )}
          </div>

          {streamFinished && (
            <div className="grid grid-cols-2 gap-6">
              {!showResults ? (
                <button onClick={handleCheckResults} className="col-span-2 bg-green-500 text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-green-100 active:scale-95 transition-all">完成挑战并核对</button>
              ) : (
                <>
                  <button onClick={resetToStart} className="bg-white border-2 border-gray-100 text-gray-800 py-5 rounded-[2rem] font-black active:scale-95 transition-all">重新生成</button>
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
