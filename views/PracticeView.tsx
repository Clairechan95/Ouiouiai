
import React, { useState, useRef, useEffect } from 'react';
import { PenTool, Play, Pause, Save, Trash2, Clock, FileText, Headphones, Sparkles, Info, ArrowLeft, Check, AlignLeft, Mic } from 'lucide-react';
import { generateClozeStoryStream, generateErrorHint, generatePracticeSummary, PracticeSummary } from '../services/geminiService';
import { logFeatureEvent, logWrongAnswers } from '../services/analyticsService';
import { useAppContext } from '../App';
import { ClozeStory, SavedStory, StorySegment, WrongAnswer } from '../types';
import AudioPlayer from '../components/AudioPlayer';
import { cancelSpeech, speakFrench } from '../services/speechService';

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

// ── 听写辅助函数 ──────────────────────────────────────────────────────────────

/** 将故事段落拆分为 3–8 词的节奏组（避免孤词） */
const buildDictChunks = (segments: StorySegment[]): string[] => {
  const MIN = 3; // 最小词数
  const MAX = 8; // 最大词数

  const raw: string[] = [];
  for (const seg of segments) {
    const clean = cleanFr(seg.french).trim();
    const words = clean.split(/\s+/);
    if (words.length <= MAX) {
      raw.push(clean);
    } else {
      const parts = clean.split(/,\s*/);
      let buf: string[] = [];
      let bufW = 0;
      for (const part of parts) {
        const pw = part.trim().split(/\s+/).filter(Boolean);
        if (!pw.length) continue;
        if (bufW + pw.length <= MAX) {
          buf.push(part.trim());
          bufW += pw.length;
        } else {
          if (buf.length) raw.push(buf.join(', '));
          if (pw.length > MAX) {
            for (let i = 0; i < pw.length; i += MAX)
              raw.push(pw.slice(i, i + MAX).join(' '));
            buf = []; bufW = 0;
          } else {
            buf = [part.trim()]; bufW = pw.length;
          }
        }
      }
      if (buf.length) raw.push(buf.join(', '));
    }
  }

  // 合并过短的 chunk（< MIN 词）到前一个 chunk，避免孤词
  const merged: string[] = [];
  for (const chunk of raw) {
    const wc = chunk.split(/\s+/).filter(Boolean).length;
    if (wc < MIN && merged.length > 0) {
      merged[merged.length - 1] += ' ' + chunk;
    } else {
      merged.push(chunk);
    }
  }
  return merged.filter(Boolean);
};

/** 按词数计算听写等待秒数 */
const getWaitSecs = (chunk: string) =>
  Math.max(5, chunk.trim().split(/\s+/).filter(Boolean).length + 3);

const FRENCH_VOICE_MISSING_MESSAGE = '当前设备没有可用的法语语音，请点右上角语音检测，按指引安装或启用 French / Français。';

/** 修正常见省音错误（"Je aime" → "j'aime"），作为 AI 生成兜底 */
const fixElision = (text: string): string =>
  text
    .replace(/\bje\s+([aâàäeéèêëiîïoôùûü])/gi, (_, v) => `j'${v}`)
    .replace(/\bme\s+([aâàäeéèêëiîïoôùûü])/gi, (_, v) => `m'${v}`)
    .replace(/\bte\s+([aâàäeéèêëiîïoôùûü])/gi, (_, v) => `t'${v}`)
    .replace(/\bse\s+([aâàäeéèêëiîïoôùûü])/gi, (_, v) => `s'${v}`)
    .replace(/\ble\s+([aâàäeéèêëiîïoôùûü])/gi, (_, v) => `l'${v}`)
    .replace(/\bla\s+([aâàäeéèêëiîïoôùûü])/gi, (_, v) => `l'${v}`)
    .replace(/\bde\s+([aâàäeéèêëiîïoôùûü])/gi, (_, v) => `d'${v}`)
    .replace(/\bque\s+([aâàäeéèêëiîïoôùûü])/gi, (_, v) => `qu'${v}`)
    .replace(/\bne\s+([aâàäeéèêëiîïoôùûü])/gi, (_, v) => `n'${v}`)
    .replace(/\bsi\s+(il[s]?\b)/gi, (_, v) => `s'${v}`);

/** 剥离 {{}} 并修正省音，生成干净的法语文本 */
const cleanFr = (french: string): string =>
  fixElision(french.replace(/\{\{(.*?)\}\}/g, '$1'));

/** 逐词比对，返回 [{word, ok}] */
const diffWords = (input: string, correct: string): { word: string; ok: boolean }[] => {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[.,!?;:«»\u201c\u201d\u2018\u2019()\-]/g, '').trim();
  const uWords = input.trim().split(/\s+/).filter(Boolean);
  const cWords = correct.trim().split(/\s+/).filter(Boolean);
  return cWords.map((cw, i) => ({ word: cw, ok: norm(uWords[i] ?? '') === norm(cw) }));
};

// ── 类型 ──────────────────────────────────────────────────────────────────────

type PracticeMode = 'cloze' | 'sentence' | 'paragraph';
type DictPhase = 'idle' | 'round1' | 'middle' | 'round4' | 'done';

interface SentResult {
  input: string;
  answer: string;
  chinese: string;
  allCorrect: boolean;
}

// ── 组件 ──────────────────────────────────────────────────────────────────────

const PracticeView: React.FC = () => {
  const { notebook, currentLevel, savedStories, saveStory, deleteStory, addWrongAnswers } = useAppContext();
  const [activeTab, setActiveTab] = useState<'create' | 'saved'>('create');

  // 两步选择状态
  const [step, setStep] = useState<'theme' | 'vocab'>('theme');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [selectedVocabIds, setSelectedVocabIds] = useState<Set<string>>(new Set());

  // 练习模式
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('cloze');

  // 生成与练习状态（填词模式）
  const [loading, setLoading] = useState(false);
  const [clozeData, setClozeData] = useState<ClozeStory | null>(null);
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

  // 整句听写状态
  const [sentIdx, setSentIdx] = useState(0);
  const [sentInput, setSentInput] = useState('');
  const [sentSubmitted, setSentSubmitted] = useState(false);
  const [sentDone, setSentDone] = useState(false);
  const [sentResults, setSentResults] = useState<SentResult[]>([]);

  // 整段听写状态
  const [dictPhase, setDictPhase] = useState<DictPhase>('idle');
  const [dictChunkIdx, setDictChunkIdx] = useState(-1);
  const [dictCountdown, setDictCountdown] = useState(0);
  const [dictSpeaking, setDictSpeaking] = useState(false);
  const [dictPaused, setDictPaused] = useState(false);
  const [dictInput, setDictInput] = useState('');
  const [dictShowResult, setDictShowResult] = useState(false);
  const dictStopRef = useRef(false);

  // 组件卸载时停止所有语音
  useEffect(() => {
    return () => {
      dictStopRef.current = true;
      cancelSpeech();
    };
  }, []);

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

  const resetToStart = () => {
    // 停止所有播放
    dictStopRef.current = true;
    stopGlobalSpeech();
    // 重置填词模式
    setClozeData(null);
    setStreamFinished(false);
    setShowResults(false);
    setUserInputs({});
    setHints({});
    setSummary(null);
    setSummaryLoading(false);
    setWrongCount(0);
    // 重置整句听写
    setSentIdx(0);
    setSentInput('');
    setSentSubmitted(false);
    setSentDone(false);
    setSentResults([]);
    // 重置整段听写
    setDictPhase('idle');
    setDictChunkIdx(-1);
    setDictCountdown(0);
    setDictSpeaking(false);
    setDictPaused(false);
    setDictInput('');
    setDictShowResult(false);
    // 返回第一步
    setStep('theme');
    setSelectedTheme('');
    setCustomTheme('');
    setSelectedVocabIds(new Set());
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

  // ── 填词模式播放控制 ──────────────────────────────────────────────────────

  const playFromSentence = async (idx: number, segments: StorySegment[]) => {
    if (!isPlayingRef.current || idx >= segments.length) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentPlayingIdx(-1);
      return;
    }
    setCurrentPlayingIdx(idx);
    const text = cleanFr(segments[idx].french);
    await speakFrench(text, {
      onEnd: () => {
        if (isPlayingRef.current) setTimeout(() => void playFromSentence(idx + 1, segments), 500);
      },
      onError: () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        setCurrentPlayingIdx(-1);
        showToast(FRENCH_VOICE_MISSING_MESSAGE);
      },
    });
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
    cancelSpeech();
    isPlayingRef.current = true;
    setIsPlaying(true);
    void playFromSentence(idx, clozeData.segments);
  };

  useEffect(() => {
    if (currentPlayingIdx >= 0) {
      document.getElementById(`seg-${currentPlayingIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentPlayingIdx]);

  // ── 整段听写引擎 ──────────────────────────────────────────────────────────

  const runDictation = async (chunks: string[], sentences: string[], startChunk = 0, skipToRound4 = false) => {
    dictStopRef.current = false;

    const speak = (text: string): Promise<void> =>
      new Promise(resolve => {
        if (dictStopRef.current) { resolve(); return; }
        setDictSpeaking(true);
        void speakFrench(text, {
          onEnd: () => { setDictSpeaking(false); resolve(); },
          onError: (error) => {
            setDictSpeaking(false);
            if (error === 'missing-french-voice') {
              showToast(FRENCH_VOICE_MISSING_MESSAGE);
            }
            resolve();
          },
        });
      });

    const sleep = (ms: number): Promise<void> =>
      new Promise(resolve => setTimeout(resolve, ms));

    // 逐句朗读，句间有呼吸停顿
    const speakSentences = async (): Promise<void> => {
      for (const sentence of sentences) {
        if (dictStopRef.current) return;
        await speak(sentence);
        if (dictStopRef.current) return;
        await sleep(900); // 句间停顿约 0.9 秒
      }
    };

    const doCountdown = (secs: number): Promise<void> =>
      new Promise(resolve => {
        setDictCountdown(secs);
        let rem = secs;
        const iv = setInterval(() => {
          if (dictStopRef.current) { clearInterval(iv); setDictCountdown(0); resolve(); return; }
          rem -= 1;
          setDictCountdown(rem);
          if (rem <= 0) { clearInterval(iv); resolve(); }
        }, 1000);
      });

    // 第1遍：全文逐句朗读（句间呼吸停顿）
    if (startChunk === 0 && !skipToRound4) {
      setDictPhase('round1');
      setDictChunkIdx(-1);
      setDictCountdown(0);
      await speakSentences();
      if (dictStopRef.current) return;
      await sleep(1500);
      if (dictStopRef.current) return;
    }

    // 中间段：逐节奏组（每组读两遍 + 倒计时）
    if (!skipToRound4) {
      setDictPhase('middle');
      for (let i = startChunk; i < chunks.length; i++) {
        if (dictStopRef.current) { setDictChunkIdx(i); return; }
        setDictChunkIdx(i);
        setDictCountdown(0);
        // 第一遍
        await speak(chunks[i]);
        if (dictStopRef.current) { setDictChunkIdx(i); return; }
        await sleep(800);
        if (dictStopRef.current) { setDictChunkIdx(i); return; }
        // 第二遍
        await speak(chunks[i]);
        if (dictStopRef.current) { setDictChunkIdx(i); return; }
        // 倒计时
        await doCountdown(getWaitSecs(chunks[i]));
        if (dictStopRef.current) { setDictChunkIdx(i + 1 < chunks.length ? i + 1 : i); return; }
      }
    }

    // 第4遍：全文逐句朗读（句间呼吸停顿）
    setDictPhase('round4');
    setDictChunkIdx(-1);
    setDictCountdown(0);
    await speakSentences();
    if (dictStopRef.current) return;

    setDictPhase('done');
  };

  const startDictation = () => {
    if (!clozeData) return;
    const chunks = buildDictChunks(clozeData.segments);
    const sentences = clozeData.segments.map(s => cleanFr(s.french));
    runDictation(chunks, sentences, 0, false);
  };

  const pauseDictation = () => {
    dictStopRef.current = true;
    cancelSpeech();
    setDictSpeaking(false);
    setDictPaused(true);
    setDictCountdown(0);
  };

  const endDictationEarly = () => {
    dictStopRef.current = true;
    cancelSpeech();
    setDictSpeaking(false);
    setDictPaused(false);
    setDictCountdown(0);
    setDictPhase('done');
  };

  const resumeDictation = () => {
    if (!clozeData) return;
    const chunks = buildDictChunks(clozeData.segments);
    const sentences = clozeData.segments.map(s => cleanFr(s.french));
    setDictPaused(false);
    if (dictPhase === 'round4') {
      runDictation(chunks, sentences, 0, true);
    } else if (dictPhase === 'middle') {
      runDictation(chunks, sentences, Math.max(0, dictChunkIdx), false);
    } else {
      runDictation(chunks, sentences, 0, false);
    }
  };

  const handleDictationSubmit = () => {
    if (!clozeData) return;
    dictStopRef.current = true;
    cancelSpeech();
    setDictSpeaking(false);

    const norm = (s: string) =>
      s.toLowerCase().replace(/[.,!?;:«»\u201c\u201d\u2018\u2019()\-\n]/g, ' ').replace(/\s+/g, ' ').trim();
    const userWords = new Set(dictInput.split(/\s+/).map(norm).filter(Boolean));

    const wrongs: WrongAnswer[] = [];
    clozeData.segments.forEach(seg => {
      const answer = cleanFr(seg.french);
      const cWords = answer.split(/\s+/).map(norm).filter(Boolean);
      const matched = cWords.filter(w => userWords.has(w)).length;
      if (matched < cWords.length) {
        wrongs.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: Date.now(),
          sourceType: 'dictation',
          answer,
          userAnswer: dictInput.trim(),
          context: answer,
          chinese: seg.chinese,
          theme: selectedTheme,
          mastered: false,
        });
      }
    });

    if (wrongs.length > 0) {
      addWrongAnswers(wrongs);
      showToast(`已记录 ${wrongs.length} 道错题`);
    } else {
      showToast('全部正确，完美！🎉');
    }
    setDictShowResult(true);
  };

  // ── 整句听写逻辑 ──────────────────────────────────────────────────────────

  const handleSentenceSubmit = () => {
    if (!clozeData) return;
    const seg = clozeData.segments[sentIdx];
    const answer = cleanFr(seg.french);
    const diffs = diffWords(sentInput, answer);
    const allCorrect = diffs.every(d => d.ok);

    if (!allCorrect) {
      addWrongAnswers([{
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        sourceType: 'dictation',
        answer,
        userAnswer: sentInput.trim(),
        context: answer,
        chinese: seg.chinese,
        theme: selectedTheme,
        mastered: false,
      }]);
    }

    setSentResults(prev => [...prev, { input: sentInput, answer, chinese: seg.chinese, allCorrect }]);
    setSentSubmitted(true);
  };

  const handleSentenceNext = () => {
    if (!clozeData) return;
    const nextIdx = sentIdx + 1;
    if (nextIdx >= clozeData.segments.length) {
      setSentDone(true);
    } else {
      setSentIdx(nextIdx);
      setSentInput('');
      setSentSubmitted(false);
    }
  };

  // ── 填词模式导出 ──────────────────────────────────────────────────────────

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

  const exportHTML = () => {
    if (!clozeData) return;
    const items = clozeData.segments.map((s, i) => ({
      id: i + 1,
      fr: cleanFr(s.french),
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

  // ── 生成故事 ──────────────────────────────────────────────────────────────

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
      const words = shuffled.slice(0, 8).map(i => {
        const base = i.detectedForm?.infinitive || i.text;
        const tense = i.detectedForm?.tense;
        return tense ? `${base}[${tense}]` : base;
      });
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

  // ── 填词模式核对 ──────────────────────────────────────────────────────────

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
    setWrongCount(wrongs.length);
    setSummary(null);

    wrongKeys.forEach(({ inputKey, answer, userAnswer, context }) => {
      generateErrorHint({ userAnswer, correctAnswer: answer, context, type: 'cloze' })
        .then(hint => { if (hint) setHints(prev => ({ ...prev, [inputKey]: hint })); });
    });

    if (wrongKeys.length > 0) {
      setSummaryLoading(true);
      generatePracticeSummary(
        wrongKeys.map(w => ({ userAnswer: w.userAnswer, correctAnswer: w.answer, context: w.context, type: 'cloze' })),
        clozeData!.segments.length
      ).then(s => { setSummary(s); setSummaryLoading(false); });
    }
  };

  const handleSaveStory = () => {
    if (clozeData && clozeData.segments.length > 0) {
      saveStory({ id: Date.now().toString(), createdAt: Date.now(), theme: selectedTheme || '综合', title: clozeData.title, data: clozeData });
      showToast('已保存 ✓');
    }
  };

  // ── 填词模式段落渲染 ──────────────────────────────────────────────────────

  const renderSegment = (segment: StorySegment, segIndex: number) => {
    const parts = segment.french.split(/(\{\{.*?\}\})/g);
    let clozeCount = 0;
    const cleanText = cleanFr(segment.french);
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

  // ── 历史记录 Tab ──────────────────────────────────────────────────────────

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

  // ── 创建 Tab ──────────────────────────────────────────────────────────────

  // 整段听写阶段文案
  const dictPhaseLabel: Record<DictPhase, string> = {
    idle: '',
    round1: '第 1 遍 · 全文朗读，请专心聆听',
    middle: '逐段听写，请边听边写',
    round4: '第 4 遍 · 全文核对，请检查并完善',
    done: '听写完成，可以提交了',
  };

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

      {/* ── 步骤一：选择主题 + 练习模式 ── */}
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
                onClick={() => { setSelectedTheme(theme); setCustomTheme(''); }}
                className={`relative px-4 py-4 rounded-2xl text-sm font-black text-left transition-all ${
                  selectedTheme === theme && !customTheme
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'bg-white text-gray-600 border border-gray-100 hover:border-primary/30 hover:bg-primary/5'
                }`}
              >
                {selectedTheme === theme && !customTheme && <Check className="absolute top-2 right-2 w-3.5 h-3.5 opacity-80" />}
                {theme}
              </button>
            ))}
          </div>

          {/* 自定义主题输入 */}
          <div className="mb-8">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">或自定义主题</p>
            <input
              type="text"
              value={customTheme}
              onChange={e => { setCustomTheme(e.target.value); setSelectedTheme(e.target.value); }}
              placeholder="输入任意主题，如：巴黎生活、面试场景..."
              className={`w-full px-4 py-3.5 rounded-2xl border text-sm font-bold outline-none transition-all ${
                customTheme
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 focus:border-primary/50'
              }`}
            />
          </div>

          {/* 练习模式选择 */}
          <div className="mb-8">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">练习模式</p>
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'cloze' as PracticeMode, icon: <PenTool className="w-5 h-5" />, label: '填词模式', desc: '填写关键词' },
                { key: 'sentence' as PracticeMode, icon: <Mic className="w-5 h-5" />, label: '整句听写', desc: '逐句听写全文' },
                { key: 'paragraph' as PracticeMode, icon: <AlignLeft className="w-5 h-5" />, label: '整段听写', desc: '专四模式·4遍' },
              ] as const).map(m => (
                <button
                  key={m.key}
                  onClick={() => setPracticeMode(m.key)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                    practiceMode === m.key
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-100 bg-white text-gray-500 hover:border-primary/30'
                  }`}
                >
                  {m.icon}
                  <span className="text-xs font-black">{m.label}</span>
                  <span className="text-[10px] text-gray-400 leading-tight">{m.desc}</span>
                </button>
              ))}
            </div>
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

      {/* ── 故事生成中（填词模式流式显示，其他模式显示等待） ── */}
      {loading && !clozeData?.segments.length && (
        <div className="max-w-2xl mx-auto text-center py-24">
          <div className="w-14 h-14 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-5"></div>
          <p className="text-gray-400 font-black">AI 正在斟酌遣词造句...</p>
        </div>
      )}

      {/* ── 填词模式练习区 ── */}
      {clozeData && practiceMode === 'cloze' && (
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

          {showResults && (
            <div className="mb-6 bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">本次听写总结</p>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-black text-gray-800">
                  {clozeData.segments.length - wrongCount} / {clozeData.segments.length}
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

      {/* ── 整句听写练习区 ── */}
      {clozeData && practiceMode === 'sentence' && (
        <div className="max-w-2xl mx-auto">
          {/* 加载中 */}
          {loading && (
            <div className="text-center py-24">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400 font-black">AI 正在生成故事...</p>
            </div>
          )}

          {/* 练习中 */}
          {streamFinished && !sentDone && (
            <>
              {/* 顶部信息 */}
              <div className="bg-gray-900 rounded-[2.5rem] p-6 shadow-2xl text-white mb-8">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-black text-xl truncate">{clozeData.title}</h2>
                  <button onClick={handleSaveStory} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors" title="保存故事">
                    <Save className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-gray-400">{selectedTheme}</span>
                  <span className="text-[10px] text-gray-500">整句听写</span>
                </div>
                {/* 进度条 */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>句 {sentIdx + 1} / {clozeData.segments.length}</span>
                    <span>{Math.round((sentIdx / clozeData.segments.length) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${(sentIdx / clozeData.segments.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 当前句卡片 */}
              <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm mb-6">
                <div className="flex items-center gap-3 mb-5">
                  <AudioPlayer
                    text={cleanFr(clozeData.segments[sentIdx].french)}
                    className="bg-indigo-50 text-indigo-500 w-12 h-12 shrink-0"
                  />
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">点击播放，听后默写整句</p>
                    <p className="text-xs text-gray-300 mt-0.5">可多次收听</p>
                  </div>
                </div>

                {!sentSubmitted ? (
                  <>
                    <textarea
                      value={sentInput}
                      onChange={e => setSentInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (sentInput.trim()) handleSentenceSubmit(); } }}
                      placeholder="在此输入你听到的完整句子..."
                      rows={3}
                      className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 text-sm font-medium outline-none focus:border-primary/50 resize-none bg-gray-50 text-gray-800 placeholder-gray-300 mb-4"
                    />
                    <button
                      onClick={handleSentenceSubmit}
                      disabled={!sentInput.trim()}
                      className="w-full bg-primary text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-30"
                    >
                      提交
                    </button>
                  </>
                ) : (
                  <>
                    {/* 逐词对比 */}
                    <div className="mb-4">
                      <p className="text-xs font-black text-gray-400 mb-2">逐词对比</p>
                      <div className="flex flex-wrap gap-1.5">
                        {diffWords(sentInput, cleanFr(clozeData.segments[sentIdx].french)).map((d, i) => (
                          <span key={i} className={`px-2.5 py-1 rounded-xl font-bold text-sm ${
                            d.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {d.word}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* 中文 */}
                    <p className="text-gray-400 text-sm italic border-l-4 border-gray-100 pl-3 mb-4">
                      {clozeData.segments[sentIdx].chinese}
                    </p>
                    {/* 你写的（仅当有错误时） */}
                    {!diffWords(sentInput, cleanFr(clozeData.segments[sentIdx].french)).every(d => d.ok) && (
                      <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-xl mb-4">
                        你写的：{sentInput.trim() || '（空）'}
                      </p>
                    )}
                    <button
                      onClick={handleSentenceNext}
                      className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-base active:scale-95 transition-all"
                    >
                      {sentIdx + 1 < clozeData.segments.length ? '下一句 →' : '完成听写'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {/* 整句听写完成汇总 */}
          {sentDone && (
            <>
              <div className="bg-gray-900 rounded-[2.5rem] p-6 text-white mb-6 shadow-2xl">
                <h2 className="font-black text-xl mb-1">{clozeData.title}</h2>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-3xl font-black">
                    {sentResults.filter(r => r.allCorrect).length} / {sentResults.length}
                  </span>
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                    sentResults.every(r => r.allCorrect)
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}>
                    {sentResults.every(r => r.allCorrect) ? '🎉 全部正确！' : `${sentResults.filter(r => !r.allCorrect).length} 句有误`}
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                {sentResults.map((r, i) => {
                  const diffs = diffWords(r.input, r.answer);
                  return (
                    <div key={i} className={`p-5 rounded-[2rem] border ${r.allCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-red-100'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-black text-gray-400">句 {i + 1}</span>
                        {r.allCorrect && <span className="text-xs text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-full">✓ 完全正确</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {diffs.map((d, j) => (
                          <span key={j} className={`px-2 py-0.5 rounded-lg text-sm font-medium ${
                            d.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}>{d.word}</span>
                        ))}
                      </div>
                      {!r.allCorrect && (
                        <p className="text-xs text-gray-400 mt-1.5 mb-1.5">你写的：{r.input.trim() || '（空）'}</p>
                      )}
                      <p className="text-xs text-gray-400 italic border-l-2 border-gray-200 pl-2">{r.chinese}</p>
                    </div>
                  );
                })}
              </div>

              <button onClick={resetToStart} className="w-full bg-gray-900 text-white py-5 rounded-[2rem] font-black text-lg active:scale-95 transition-all">
                重新生成
              </button>
            </>
          )}
        </div>
      )}

      {/* ── 整段听写练习区（专四模式）── */}
      {clozeData && practiceMode === 'paragraph' && (
        <div className="max-w-2xl mx-auto">
          {/* 加载中 */}
          {loading && (
            <div className="text-center py-24">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400 font-black">AI 正在生成故事...</p>
            </div>
          )}

          {streamFinished && !dictShowResult && (
            <>
              {/* 顶部信息卡 */}
              <div className="bg-gray-900 rounded-[2.5rem] p-6 shadow-2xl text-white mb-8">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-black text-xl truncate">{clozeData.title}</h2>
                  <div className="flex gap-2">
                    <button onClick={handleSaveStory} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors" title="保存故事">
                      <Save className="w-4 h-4" />
                    </button>
                    <button onClick={downloadTranscript} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors" title="下载文稿">
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-gray-400">{selectedTheme}</span>
                  <span className="text-[10px] text-gray-500">整段听写 · 专四模式</span>
                </div>

                {/* 阶段指示 */}
                {dictPhase !== 'idle' && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-sm font-bold text-indigo-300">{dictPhaseLabel[dictPhase]}</p>
                    {dictPhase === 'middle' && dictChunkIdx >= 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        节奏组 {dictChunkIdx + 1} / {buildDictChunks(clozeData.segments).length}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 开始听写（idle状态） */}
              {dictPhase === 'idle' && (
                <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm mb-6 text-center">
                  <div className="text-4xl mb-3">🎧</div>
                  <p className="font-black text-gray-800 text-lg mb-1">准备好了吗？</p>
                  <p className="text-gray-400 text-sm mb-2">
                    共 {clozeData.segments.length} 句 · {buildDictChunks(clozeData.segments).length} 个节奏组
                  </p>
                  <div className="text-xs text-gray-400 bg-gray-50 rounded-2xl p-4 mb-6 text-left space-y-1">
                    <p>第 1 遍：全文朗读，专心聆听</p>
                    <p>中间段：逐节奏组读两遍，间隔写字时间</p>
                    <p>第 4 遍：全文朗读，核对补充</p>
                  </div>
                  <button
                    onClick={startDictation}
                    className="w-full bg-primary text-white py-5 rounded-2xl font-black text-lg shadow-2xl shadow-primary/30 active:scale-95 transition-all"
                  >
                    开始听写
                  </button>
                </div>
              )}

              {/* 听写中 */}
              {dictPhase !== 'idle' && (
                <>
                  {/* 倒计时条（middle阶段） */}
                  {dictPhase === 'middle' && (
                    <div className="bg-white rounded-[2rem] border border-gray-100 p-5 shadow-sm mb-4">
                      {dictCountdown > 0 ? (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-gray-400">写字时间</span>
                            <span className="text-sm font-black text-primary">{dictCountdown} 秒</span>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-1000"
                              style={{
                                width: `${(dictCountdown / getWaitSecs(buildDictChunks(clozeData.segments)[Math.max(0, dictChunkIdx)] ?? '')) * 100}%`,
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-indigo-500 font-bold">
                          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                          {dictSpeaking ? '正在朗读...' : '准备中...'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 全文朗读阶段提示 */}
                  {(dictPhase === 'round1' || dictPhase === 'round4') && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-5 mb-4 flex items-center gap-3">
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse shrink-0" />
                      <p className="text-sm text-indigo-600 font-bold">
                        {dictPhase === 'round1' ? '正在朗读全文，请专心聆听...' : '正在朗读全文，请核对你的听写...'}
                      </p>
                    </div>
                  )}

                  {/* 完成提示 */}
                  {dictPhase === 'done' && (
                    <div className="bg-green-50 border border-green-200 rounded-[2rem] p-5 mb-4 text-center">
                      <p className="text-green-700 font-black text-base">✅ 四遍已播放完毕，请提交你的听写</p>
                    </div>
                  )}

                  {/* 输入区（开始后即显示，随时可写） */}
                  <div className="bg-white rounded-[2rem] border border-gray-100 p-5 shadow-sm mb-4">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">你的听写</p>
                    <textarea
                      value={dictInput}
                      onChange={e => setDictInput(e.target.value)}
                      placeholder="边听边在此输入法语原文..."
                      rows={8}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium outline-none focus:border-primary/50 resize-none bg-gray-50 text-gray-800 placeholder-gray-300"
                    />
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-3">
                    {dictPhase !== 'done' && (
                      <>
                        {!dictPaused ? (
                          <button
                            onClick={pauseDictation}
                            className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-gray-100 text-gray-700 py-4 rounded-2xl font-black active:scale-95 transition-all"
                          >
                            <Pause className="w-5 h-5" /> 暂停
                          </button>
                        ) : (
                          <button
                            onClick={resumeDictation}
                            className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl font-black shadow-lg shadow-primary/20 active:scale-95 transition-all"
                          >
                            <Play className="w-5 h-5 fill-current ml-0.5" /> 继续
                          </button>
                        )}
                        <button
                          onClick={endDictationEarly}
                          className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-500 hover:bg-gray-200 px-5 py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                        >
                          结束·提交
                        </button>
                      </>
                    )}
                    {dictPhase === 'done' && (
                      <button
                        onClick={handleDictationSubmit}
                        className="flex-1 bg-green-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-green-200 active:scale-95 transition-all"
                      >
                        提交听写
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* 整段听写结果 */}
          {dictShowResult && clozeData && (
            <>
              {(() => {
                const fullCorrect = clozeData.segments
                  .map(s => cleanFr(s.french))
                  .join(' ');
                const diffs = diffWords(dictInput, fullCorrect);
                const total = diffs.length;
                const correct = diffs.filter(d => d.ok).length;
                const accuracy = total > 0 ? Math.round((correct / total) * 100) : 100;

                return (
                  <>
                    <div className="bg-gray-900 rounded-[2.5rem] p-6 text-white mb-6 shadow-2xl">
                      <h2 className="font-black text-xl mb-3">{clozeData.title}</h2>
                      <div className="flex items-center gap-3">
                        <span className="text-4xl font-black">{accuracy}%</span>
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                          accuracy === 100
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {accuracy === 100 ? '🎉 完美！' : `${total - correct} 个词有误`}
                        </span>
                      </div>
                    </div>

                    {/* 逐词对比（正确答案） */}
                    <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm mb-4">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">正确答案（绿色=正确 / 红色=有误）</p>
                      <div className="flex flex-wrap gap-1.5">
                        {diffs.map((d, i) => (
                          <span key={i} className={`px-2.5 py-1 rounded-xl text-sm font-medium ${
                            d.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {d.word}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 你写的 */}
                    <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm mb-8">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">你写的</p>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {dictInput.trim() || '（未输入）'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => {
                          setDictShowResult(false);
                          setDictPhase('idle');
                          setDictInput('');
                          setDictCountdown(0);
                          setDictChunkIdx(-1);
                          setDictPaused(false);
                          setDictSpeaking(false);
                        }}
                        className="bg-indigo-50 text-indigo-600 py-5 rounded-[2rem] font-black active:scale-95 transition-all"
                      >
                        再来一次
                      </button>
                      <button onClick={resetToStart} className="bg-white border-2 border-gray-100 text-gray-800 py-5 rounded-[2rem] font-black active:scale-95 transition-all">
                        重新生成
                      </button>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PracticeView;
