
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bookmark, Check, Send, Sparkles, MessageCircle, BookOpen, ShieldAlert, Layers } from 'lucide-react';
import { useAppContext } from '../App';
import { lookupWordStreaming, lookupConjugations, generateWordImages, chatWithWordContext, PartialWordData } from '../services/geminiService';
import { storage } from '../services/storageService';
import { WordEntry, ChatMessage } from '../types';
import AudioPlayer from '../components/AudioPlayer';

const FRENCH_TIPS = [
  { quote: "Petit à petit, l'oiseau fait son nid.", author: "Proverbe français", chinese: "一步一步，小鸟也能筑好巢。" },
  { quote: "Mieux vaut tard que jamais.", author: "Proverbe français", chinese: "亡羊补牢，犹未为晚。" },
  { quote: "L'appétit vient en mangeant.", author: "François Rabelais", chinese: "越做越有劲，熟能生巧。" },
  { quote: "Une langue différente est une vision différente de la vie.", author: "Federico Fellini", chinese: "不同的语言，是对生命不同的诠释。" },
  { quote: "Qui n'avance pas, recule.", author: "Proverbe français", chinese: "不进则退。" },
  { quote: "Les langues sont la clé du monde.", author: "Voltaire", chinese: "语言是打开世界的钥匙。" },
  { quote: "Chaque jour est une nouvelle chance.", author: "Proverbe français", chinese: "每一天都是新的机会。" },
  { quote: "Il n'y a pas de honte à apprendre.", author: "Proverbe français", chinese: "学习从不是一件羞耻的事。" },
];

const ResultView: React.FC = () => {
  const { query } = useParams<{ query: string }>();
  const navigate = useNavigate();
  const { currentLevel, addToNotebook, updateNotebookImages, notebook, addRecentSearch } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WordEntry | null>(null);
  const [partialData, setPartialData] = useState<PartialWordData | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [conjLoading, setConjLoading] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const decodedQuery = query ? decodeURIComponent(query) : '';

  // Rotate tips and advance loading steps during initial loading
  useEffect(() => {
    if (!loading) return;
    const tipTimer = setInterval(() => setTipIndex(i => (i + 1) % FRENCH_TIPS.length), 3000);
    const stepTimers = [
      setTimeout(() => setLoadingStep(1), 1500),
      setTimeout(() => setLoadingStep(2), 3500),
      setTimeout(() => setLoadingStep(3), 6000),
    ];
    return () => { clearInterval(tipTimer); stepTimers.forEach(clearTimeout); };
  }, [loading]);

  useEffect(() => {
    if (query) {
      addRecentSearch(decodedQuery);
      const cached = storage.getCachedWord(decodedQuery);
      if (cached) {
        setData(cached);
        setImages(cached.imageUrls || []);
        setLoading(false);
      } else {
        loadData(decodedQuery);
      }
    }
  }, [query]);

  useEffect(() => {
    if (data && notebook.find(n => n.id === data.id)) setSaved(true);
  }, [data, notebook]);

  const loadData = async (text: string) => {
    setLoading(true);
    setPartialData(null);
    setLoadingStep(0);
    setError(null);
    try {
      for await (const { partial, complete } of lookupWordStreaming(text, currentLevel)) {
        if (!complete) {
          setPartialData(prev => ({ ...prev, ...partial }));
        } else {
          setData(complete);
          setPartialData(null);
          storage.saveWordToCache(complete);

          if (complete.isVerb || (complete.pos && complete.pos.startsWith('v'))) {
            setConjLoading(true);
            const verbInfinitive = complete.detectedForm?.infinitive || complete.text;
            lookupConjugations(verbInfinitive, complete.detectedForm?.tense).then(conjs => {
              if (conjs.length > 0) setData(prev => prev ? { ...prev, conjugations: conjs } : prev);
              setConjLoading(false);
            });
          }

          generateWordImages(complete.text, complete.imageKeyword || '').then(urls => {
            if (urls.length > 0) {
              setImages(urls);
              storage.saveWordToCache({ ...complete, imageUrls: urls });
              updateNotebookImages(complete.id, urls);
            }
          });
        }
      }
    } catch (err: any) {
      setError(err.message || "请求 AI 时出错，请检查网络环境。");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (data) { addToNotebook({ ...data, imageUrls: images }); setSaved(true); }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !data) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    const currentInput = chatInput;
    setChatInput('');
    setChatLoading(true);
    try {
      const history = chatMessages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text }));
      const replyText = await chatWithWordContext(history, currentInput, data);
      setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: replyText }]);
    } catch {
      setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "对话连接失败。" }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Loading screen (before definition arrives) ──────────────────────────
  if (loading && !partialData?.chineseDefinition) {
    const steps = ['识别词形', '理解语义', '生成例句', '整理完成'];
    const tip = FRENCH_TIPS[tipIndex];
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 space-y-8">
        <div className="text-center">
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">正在解析</p>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-800">{decodedQuery}</h1>
        </div>

        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
          <Sparkles className="absolute inset-0 m-auto w-7 h-7 text-primary animate-pulse" />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {steps.map((step, i) => (
            <React.Fragment key={i}>
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-500 ${
                loadingStep > i ? 'bg-primary text-white' :
                loadingStep === i ? 'bg-primary/15 text-primary' : 'bg-gray-100 text-gray-300'
              }`}>
                {loadingStep > i && <Check className="w-3 h-3" />}
                {step}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-3 h-0.5 rounded-full transition-all duration-500 ${loadingStep > i ? 'bg-primary' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-sm border border-gray-100 transition-all duration-500">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">法语名言</p>
          <p className="text-base font-medium text-gray-800 italic leading-relaxed mb-1">"{tip.quote}"</p>
          <p className="text-[11px] text-indigo-400 font-semibold mb-2">— {tip.author}</p>
          <p className="text-xs text-gray-400 leading-relaxed">{tip.chinese}</p>
        </div>
      </div>
    );
  }

  // ── Partial result (definition arrived, examples still loading) ──────────
  if (loading && partialData?.chineseDefinition) {
    const displayWord = partialData.text || decodedQuery;
    return (
      <div className="pb-24 bg-background min-h-full">
        <header className="sticky top-0 bg-white/80 backdrop-blur-xl z-40 px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-2xl transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h2 className="font-black text-xl text-gray-800 truncate">{displayWord}</h2>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-2xl">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
            <span className="text-xs text-primary font-bold">生成中</span>
          </div>
        </header>

        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
          {/* Definition card */}
          <div className="bg-white rounded-[2rem] p-6 sm:p-10 shadow-sm border border-gray-100">
            <h1 className="text-4xl sm:text-6xl font-black text-primary mb-3">{displayWord}</h1>
            <div className="flex items-center gap-3 text-gray-400 font-mono mb-6 flex-wrap">
              {partialData.pos && <span className="px-2 py-0.5 bg-gray-50 rounded-lg text-sm font-bold italic">{partialData.pos}</span>}
              {partialData.ipa && <span className="text-sm">{partialData.ipa}</span>}
            </div>
            <p className="text-2xl sm:text-3xl font-black text-gray-800 border-l-8 border-primary pl-5">{partialData.chineseDefinition}</p>
            {partialData.frenchDefinition && (
              <div className="bg-gray-50 p-5 rounded-2xl mt-5 flex items-start gap-4">
                <span className="font-black text-primary text-lg">FR</span>
                <p className="text-base sm:text-lg text-gray-600 flex-1 leading-relaxed">{partialData.frenchDefinition}</p>
              </div>
            )}
          </div>

          {/* Examples skeleton */}
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100">
            <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              智能例句解析
              <span className="text-xs text-primary font-bold animate-pulse ml-1">AI 生成中...</span>
            </h3>
            <div className="space-y-6">
              {[75, 55].map((w, i) => (
                <div key={i} className="pl-6 border-l-4 border-gray-100 space-y-2.5">
                  <div className="h-5 bg-gray-100 rounded-lg animate-pulse" style={{ width: `${w}%` }} />
                  <div className="h-4 bg-gray-50 rounded-lg animate-pulse" style={{ width: `${w - 20}%` }} />
                </div>
              ))}
            </div>
          </div>

          {/* Fun note */}
          {partialData.funNote ? (
            <div className="bg-gradient-to-br from-primary to-indigo-700 rounded-[2rem] p-6 sm:p-8 text-white shadow-xl">
              <h3 className="text-base font-black mb-3 flex items-center gap-2"><MessageCircle className="w-5 h-5" />学习锦囊</h3>
              <p className="text-sm sm:text-lg leading-relaxed font-medium text-indigo-50">"{partialData.funNote}"</p>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-[2rem] p-8 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error || !data) return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 max-w-md mx-auto min-h-[70vh]">
      <div className="w-24 h-24 bg-red-50 rounded-[2.5rem] flex items-center justify-center border-4 border-white shadow-xl">
        <ShieldAlert className="w-12 h-12 text-red-400" />
      </div>
      <div className="space-y-2">
        <h3 className="text-2xl font-black text-gray-800">解析中断</h3>
        <p className="text-gray-500 text-sm leading-relaxed bg-white p-4 rounded-2xl border border-gray-100 italic">{error}</p>
      </div>
      <div className="w-full space-y-3">
        <button onClick={() => query && loadData(decodeURIComponent(query))} className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform">重新查询</button>
        <button onClick={() => navigate('/')} className="w-full bg-gray-100 text-gray-500 py-4 rounded-2xl font-bold">返回搜索页</button>
      </div>
      <div className="pt-4 border-t border-gray-100">
        <p className="text-[11px] text-gray-400 uppercase font-black tracking-widest mb-2">诊断提示</p>
        <p className="text-[10px] text-gray-400 leading-tight">请确认 DeepSeek API 密钥已正确配置，并检查本地网络是否能访问 api.deepseek.com。</p>
      </div>
    </div>
  );

  // ── Full result ──────────────────────────────────────────────────────────
  return (
    <div className="pb-24 bg-background min-h-full">
      <header className="sticky top-0 bg-white/80 backdrop-blur-xl z-40 px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-2xl transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h2 className="font-black text-xl text-gray-800 truncate">{data.text}</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saved}
          className={`px-6 py-2 rounded-2xl font-bold transition-all flex items-center gap-2 ${saved ? 'bg-green-100 text-green-600' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
        >
          {saved ? <Check className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          <span>{saved ? '已收藏' : '收藏'}</span>
        </button>
      </header>

      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start max-w-6xl mx-auto">
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 md:p-12 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div>
                <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-primary mb-2 sm:mb-3">{data.text}</h1>
                <div className="flex items-center gap-3 sm:gap-4 text-gray-400 font-mono text-base sm:text-lg flex-wrap">
                  {data.pos && <span className="px-2 py-0.5 bg-gray-50 rounded-lg text-xs sm:text-sm font-bold italic">{data.pos}</span>}
                  {data.ipa && <span className="text-sm sm:text-base">{data.ipa}</span>}
                  {data.reflexiveForm && (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-black text-amber-600">
                      <span className="text-amber-400">⇄</span>
                      {data.reflexiveForm}
                    </span>
                  )}
                </div>
              </div>
              <AudioPlayer text={data.text} className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-lg" />
            </div>
            {data.detectedForm && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-sm mb-2">
                <span className="text-indigo-400 font-black text-base">→</span>
                <span className="text-indigo-500 font-black">{data.detectedForm.infinitive}</span>
                <span className="text-indigo-300">·</span>
                <span className="text-indigo-600 font-bold">{data.detectedForm.tense}</span>
                <span className="text-indigo-300">·</span>
                <span className="text-indigo-400 font-medium">{data.detectedForm.person}</span>
              </div>
            )}
            <div className="space-y-4 sm:space-y-6">
              <p className="text-2xl sm:text-3xl font-black text-gray-800 border-l-6 sm:border-l-8 border-primary pl-4 sm:pl-6">{data.chineseDefinition}</p>
              <div className="bg-gray-50 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] flex items-start gap-3 sm:gap-4">
                <span className="font-black text-primary text-lg sm:text-xl">FR</span>
                <p className="text-base sm:text-lg text-gray-600 flex-1 leading-relaxed">{data.frenchDefinition}</p>
                <AudioPlayer text={data.frenchDefinition} className="shrink-0 bg-primary/10 text-primary hover:bg-primary hover:text-white" />
              </div>
            </div>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {images.map((img, i) => (
                <div key={i} className="aspect-square rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm border border-gray-100 relative group cursor-zoom-in">
                  <img src={img} alt="visual context" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
              ))}
            </div>
          )}

          {data.genderForms && (() => {
            const gf = data.genderForms!;
            const hasFem = gf.fem;
            const hasPlural = gf.pluralMasc || gf.pluralFem;
            if (!gf.masc && !gf.fem) return null;
            return (
              <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-sm border border-gray-100">
                <h3 className="text-base sm:text-xl font-black text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-secondary" />
                  <span>性数变化</span>
                </h3>
                <div className="overflow-hidden rounded-2xl border border-gray-100">
                  <table className="w-full text-sm text-center">
                    <thead>
                      <tr className="bg-gray-50 text-gray-400 text-xs font-black uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-20"></th>
                        <th className="py-2.5 px-3">单数</th>
                        {hasPlural && <th className="py-2.5 px-3">复数</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(gf.masc || gf.pluralMasc) && (
                        <tr className="border-t border-gray-50">
                          <td className="py-3 px-3 text-xs font-black text-primary/60 bg-gray-50/50">阳性 m.</td>
                          <td className="py-3 px-3 font-bold text-gray-800">{gf.masc || '—'}</td>
                          {hasPlural && <td className="py-3 px-3 font-bold text-gray-800">{gf.pluralMasc || gf.masc || '—'}</td>}
                        </tr>
                      )}
                      {hasFem && (
                        <tr className="border-t border-gray-100">
                          <td className="py-3 px-3 text-xs font-black text-secondary/60 bg-gray-50/50">阴性 f.</td>
                          <td className="py-3 px-3 font-bold text-gray-700">{gf.fem}</td>
                          {hasPlural && <td className="py-3 px-3 font-bold text-gray-700">{gf.pluralFem || gf.pluralMasc || '—'}</td>}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 md:p-10 shadow-sm border border-gray-100">
            <h3 className="text-xl sm:text-2xl font-black text-gray-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-3">
              <Sparkles className="w-5 h-5 sm:w-7 sm:h-7 text-accent" />
              <span>智能例句解析</span>
            </h3>
            <div className="space-y-6 sm:space-y-8">
              {data.examples.map((ex, idx) => (
                <div key={idx} className="group relative pl-6 sm:pl-8 border-l-3 sm:border-l-4 border-gray-100 hover:border-accent transition-all">
                  <div className="text-base sm:text-xl font-bold text-gray-800 mb-1 sm:mb-2 pr-10 sm:pr-12 relative leading-relaxed">
                    {ex.french}
                    <div className="absolute top-0 right-0">
                      <AudioPlayer text={ex.french} className="w-8 h-8 sm:w-10 sm:h-10 opacity-50 hover:opacity-100" />
                    </div>
                  </div>
                  <p className="text-gray-500 text-sm sm:text-lg">{ex.chinese}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 sm:space-y-8">
          <div className="bg-gradient-to-br from-primary to-indigo-700 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl text-white relative overflow-hidden">
            <h3 className="text-base sm:text-xl font-black mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3"><MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" /><span>学习锦囊</span></h3>
            <p className="text-sm sm:text-lg leading-relaxed font-medium text-indigo-50">"{data.funNote}"</p>
          </div>

          {conjLoading && (
            <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 text-gray-400">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-secondary animate-pulse" />
                <span className="text-sm font-bold animate-pulse">正在加载变位表...</span>
              </div>
            </div>
          )}
          {!conjLoading && data.conjugations && data.conjugations.length > 0 && (
            <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-sm border border-gray-100">
              <h3 className="text-base sm:text-xl font-black text-gray-800 mb-4 sm:mb-6 flex items-center gap-2"><BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" /><span>核心变位</span></h3>
              <div className="space-y-4 sm:space-y-6">
                {data.conjugations.map((conj, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-100">
                    <h4 className="mb-2 sm:mb-3">
                      <span className="font-black text-primary text-[11px] sm:text-[12px]">{conj.tense.split(' ')[0]}</span>
                      {conj.tense.includes(' ') && (
                        <span className="text-gray-400 text-[10px] sm:text-[11px] font-medium ml-1.5">{conj.tense.slice(conj.tense.indexOf(' ') + 1)}</span>
                      )}
                    </h4>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {[conj.forms.slice(0, 3), conj.forms.slice(3)].map((col, ci) => (
                        <div key={ci} className="space-y-1">
                          {col.map((form, i) => {
                            const tokens = form.split(/[\s']+/);
                            const isMatch = data.detectedForm && tokens.some(
                              t => t.toLowerCase() === data.text.toLowerCase()
                            );
                            return (
                              <div key={i} className={`px-2.5 py-1.5 rounded-lg text-[12px] sm:text-[13px] font-medium leading-snug transition-colors ${
                                isMatch ? 'bg-indigo-100 text-indigo-700 font-black ring-1 ring-indigo-300' : 'bg-white/80 text-gray-700'
                              }`}>
                                {form}
                                {isMatch && <span className="ml-1.5 text-[9px] text-indigo-400 font-black uppercase tracking-wide">← 您搜索的</span>}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isChatOpen && (
        <button onClick={() => setIsChatOpen(true)} className="fixed bottom-24 md:bottom-10 right-6 bg-gray-900 text-white p-5 rounded-full shadow-2xl z-50 hover:scale-110 active:scale-95 transition-all flex items-center gap-3 group">
          <MessageCircle className="w-7 h-7" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-bold whitespace-nowrap">AI 答疑</span>
        </button>
      )}

      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center md:justify-end md:p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full h-full md:w-[400px] md:h-[80vh] md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden transition-all duration-300">
            <header className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-black text-gray-800">法语 AI 助手</h3>
              <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-gray-800 font-bold">✕</button>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-medium ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && <div className="text-xs text-gray-400 animate-pulse">思考中...</div>}
            </div>
            <footer className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendChat()} className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 outline-none text-sm" placeholder="询问关于这个词的问题..." />
                <button onClick={handleSendChat} className="bg-primary text-white p-3 rounded-2xl shadow-lg"><Send className="w-5 h-5" /></button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultView;
