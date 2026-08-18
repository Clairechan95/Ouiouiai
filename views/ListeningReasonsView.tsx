import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Headphones, Lightbulb, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import SegmentVideoPlayer, { SegmentVideoPlayerHandle } from '../components/SegmentVideoPlayer';
import VocabularyRescue from '../components/VocabularyRescue';
import {
  REASON_SECTIONS,
  REASONS_COMPREHENSION_QUESTIONS,
  REASONS_FULL_RANGE,
  REASONS_GIST_OPTIONS,
  REASONS_VIDEO,
  ReasonDictationField,
  ReasonSectionId,
} from '../data/listeningReasonsLesson';

const STEPS = ['预测', '初听', '核验', '定向再听', '关键词听写', '反思'];
const PREDICTIONS = ['语言给人的感受', '文化探索', '工作与交流', '考试分数', '天气情况', '商品价格'];
const PERSONAL_EXPRESSION_MODELS = [
  { label: '综合表达', text: 'Je choisis le français parce que c’est une langue romantique, douce et belle. Il me permet de découvrir d’autres cultures et m’offre l’opportunité de travailler avec des gens qui ont des idées différentes. Pour moi, c’est aussi la langue des couleurs et de la lumière.' },
  { label: '语言感受', text: 'Je choisis le français parce que c’est une langue romantique, douce et belle.' },
  { label: '文化发现', text: 'Je choisis le français parce qu’il me permet de découvrir d’autres cultures.' },
  { label: '交流机会', text: 'Je choisis le français parce qu’il m’offre l’opportunité de travailler avec des gens qui ont des idées différentes.' },
  { label: '语言意象', text: 'Pour moi, la langue française, c’est avant tout la langue des couleurs et de la lumière.' },
  { label: '爱情表达', text: 'Je choisis le français parce que j’aime sa façon originale de dire « je t’aime ».' },
];
const normalize = (value: string) => value.trim().toLocaleLowerCase('fr-FR').normalize('NFC');
const noAccents = (value: string) => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const fieldsFor = (sectionId: ReasonSectionId) => {
  const section = REASON_SECTIONS.find((item) => item.id === sectionId)!;
  return section.dictationTemplate.filter((part): part is ReasonDictationField => typeof part !== 'string');
};

const ListeningReasonsView: React.FC = () => {
  const playerRef = useRef<SegmentVideoPlayerHandle>(null);
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [predictions, setPredictions] = useState<Set<string>>(new Set());
  const [gist, setGist] = useState<number | null>(null);
  const [comprehensionAnswers, setComprehensionAnswers] = useState<Record<string, string>>({});
  const [comprehensionSubmitted, setComprehensionSubmitted] = useState(false);
  const [visibleQuestionHelp, setVisibleQuestionHelp] = useState<Set<string>>(new Set());
  const [targetId, setTargetId] = useState<ReasonSectionId>('images');
  const [completedTargets, setCompletedTargets] = useState<Set<ReasonSectionId>>(new Set());
  const [supportLevels, setSupportLevels] = useState<Partial<Record<ReasonSectionId, number>>>({});
  const [dictationId, setDictationId] = useState<ReasonSectionId>('images');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState<Set<ReasonSectionId>>(new Set());
  const [shownDictationTranslations, setShownDictationTranslations] = useState<Set<ReasonSectionId>>(new Set());
  const [reflection, setReflection] = useState<Set<string>>(new Set());
  const [personalExpression, setPersonalExpression] = useState(PERSONAL_EXPRESSION_MODELS[0].text);

  const target = REASON_SECTIONS.find((item) => item.id === targetId)!;
  const dictation = REASON_SECTIONS.find((item) => item.id === dictationId)!;
  const supportLevel = supportLevels[targetId] ?? 0;

  const go = (next: number) => {
    const value = Math.max(0, Math.min(5, next));
    setStep(value);
    setMaxStep((current) => Math.max(current, value));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextSection = (current: ReasonSectionId, done: Set<ReasonSectionId>) => {
    const index = REASON_SECTIONS.findIndex((item) => item.id === current);
    return REASON_SECTIONS.slice(index + 1).find((item) => !done.has(item.id))
      ?? REASON_SECTIONS.find((item) => !done.has(item.id));
  };

  const finishTarget = () => {
    const done = new Set(completedTargets).add(targetId);
    setCompletedTargets(done);
    const next = nextSection(targetId, done);
    if (next) setTargetId(next.id); else go(4);
  };

  const checkDictation = () => {
    if (!reviewed.has(dictationId)) {
      if (!fieldsFor(dictationId).some((field) => inputs[field.id]?.trim())) return;
      setReviewed((current) => new Set(current).add(dictationId));
      return;
    }
    const done = new Set(reviewed).add(dictationId);
    const next = nextSection(dictationId, done);
    if (next) setDictationId(next.id); else go(5);
  };

  const summary = useMemo(() => {
    const comprehensionCorrect = REASONS_COMPREHENSION_QUESTIONS.filter((question) => comprehensionAnswers[question.id] === question.answer).length;
    let dictationCorrect = 0;
    let dictationTotal = 0;
    const errors: string[] = [];
    REASON_SECTIONS.forEach((section) => fieldsFor(section.id).forEach((field) => {
      dictationTotal += 1;
      const value = inputs[field.id] ?? '';
      if (normalize(value) === normalize(field.answer)) dictationCorrect += 1;
      else if (!value.trim()) errors.push(`${field.label}：未填写（${field.answer}）`);
      else if (noAccents(value) === noAccents(field.answer)) errors.push(`${field.label}：注意重音符号（${field.answer}）`);
      else errors.push(`${field.label}：拼写或词形需复习（${field.answer}）`);
    }));
    if (comprehensionCorrect < REASONS_COMPREHENSION_QUESTIONS.length) errors.unshift('内容核验：部分关键词或核心内容还需要再次确认');
    return { comprehensionCorrect, dictationCorrect, dictationTotal, errors };
  }, [comprehensionAnswers, inputs]);

  const sectionTabs = (active: ReasonSectionId, setActive: (id: ReasonSectionId) => void) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {REASON_SECTIONS.map((section) => (
        <button key={section.id} type="button" onClick={() => setActive(section.id)} className={`min-h-11 rounded-lg border px-2 text-xs font-black ${active === section.id ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-500'}`}>
          {section.name}
        </button>
      ))}
    </div>
  );

  const renderStep = () => {
    if (step === 0) return (
      <section>
        <p className="text-sm font-bold text-primary">听前预测 · Anticipation</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">他们为什么选择法语？</h2>
        <p className="mt-2 text-sm text-gray-500">根据标题选择你认为可能出现的内容，可以多选。</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {PREDICTIONS.map((item) => <button key={item} type="button" onClick={() => setPredictions((current) => { const next = new Set(current); next.has(item) ? next.delete(item) : next.add(item); return next; })} className={`min-h-12 rounded-lg border px-4 text-left text-sm font-bold ${predictions.has(item) ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{predictions.has(item) && <Check className="mr-2 inline h-4 w-4" />}{item}</button>)}
        </div>
        <button type="button" disabled={!predictions.size} onClick={() => go(1)} className="mt-7 min-h-12 w-full rounded-lg bg-primary px-5 font-black text-white disabled:bg-gray-200">带着预测去听</button>
      </section>
    );

    if (step === 1) return (
      <section>
        <p className="text-sm font-bold text-primary">整体初听 · Écoute globale</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">先抓住大家在谈什么</h2>
        <div className="mt-5"><SegmentVideoPlayer src={REASONS_VIDEO} range={REASONS_FULL_RANGE} maskSubtitles /></div>
        <div className="mt-6 space-y-2">{REASONS_GIST_OPTIONS.map((option, index) => <button key={option} type="button" onClick={() => setGist(index)} className={`min-h-12 w-full rounded-lg border px-4 text-left text-sm font-bold ${gist === index ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{option}</button>)}</div>
        <button type="button" disabled={gist === null} onClick={() => go(2)} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white disabled:bg-gray-200">提交并核验</button>
      </section>
    );

    if (step === 2) return (
      <section>
        <p className="text-sm font-bold text-primary">第一次核验 · Vérification</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">再次听，抓住关键词与核心内容</h2>
        <p className="mt-2 text-sm text-gray-500">根据听到的法语选择答案，重点辨认关键词并理解主要内容。</p>
        <p className={`mt-4 rounded-lg p-3 text-sm font-bold ${gist === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{gist === 0 ? '主旨判断正确。' : '参考答案：受访者谈法语给人的感受，以及它带来的文化和交流机会。'}</p>
        <div className="mt-5"><SegmentVideoPlayer src={REASONS_VIDEO} range={REASONS_FULL_RANGE} maskSubtitles /></div>
        <div className="mt-6 space-y-5">{REASONS_COMPREHENSION_QUESTIONS.map((question, questionIndex) => {
          const selected = comprehensionAnswers[question.id];
          return <section key={question.id} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
            <h3 className="text-sm font-black leading-6 text-gray-800"><span className="mr-2 text-primary">{questionIndex + 1}.</span>{question.prompt}</h3>
            <button type="button" aria-expanded={visibleQuestionHelp.has(question.id)} onClick={() => setVisibleQuestionHelp((current) => { const next = new Set(current); next.has(question.id) ? next.delete(question.id) : next.add(question.id); return next; })} className="mt-2 min-h-10 text-xs font-bold text-primary">
              {visibleQuestionHelp.has(question.id) ? '收起题意帮助' : '看不懂题目？查看题意帮助'}
            </button>
            {visibleQuestionHelp.has(question.id) && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{question.promptHelp}</p>}
            <div className="mt-3 grid gap-2">{question.options.map((option) => {
              const isSelected = selected === option;
              const isCorrect = comprehensionSubmitted && option === question.answer;
              const isWrong = comprehensionSubmitted && isSelected && option !== question.answer;
              return <button key={option} type="button" disabled={comprehensionSubmitted} onClick={() => setComprehensionAnswers((current) => ({ ...current, [question.id]: option }))} className={`min-h-12 rounded-lg border px-4 py-3 text-left text-sm font-bold leading-5 ${isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : isWrong ? 'border-red-300 bg-red-50 text-red-600' : isSelected ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>
              {isCorrect && <Check className="mr-2 inline h-4 w-4" />}{isWrong && <X className="mr-2 inline h-4 w-4" />}{option}
              </button>;
            })}</div>
            {comprehensionSubmitted && <p className={`mt-3 text-xs font-bold ${selected === question.answer ? 'text-emerald-600' : 'text-gray-500'}`}>{selected === question.answer ? `正确 · ${question.focus}` : `再听提示 · ${question.focus}`}</p>}
          </section>;
        })}</div>
        <button type="button" disabled={!comprehensionSubmitted && Object.keys(comprehensionAnswers).length < REASONS_COMPREHENSION_QUESTIONS.length} onClick={() => comprehensionSubmitted ? go(3) : setComprehensionSubmitted(true)} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white disabled:bg-gray-200">{comprehensionSubmitted ? '进入定向再听' : '提交并查看答案'}</button>
      </section>
    );

    if (step === 3) return (
      <section>
        <p className="text-sm font-bold text-primary">定向再听 · Écoute ciblée</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">{target.name}</h2>
        <p className="mt-2 text-sm text-gray-500">{target.prompt}</p>
        <div className="mt-5">{sectionTabs(targetId, setTargetId)}</div>
        <div className="mt-5"><SegmentVideoPlayer ref={playerRef} src={REASONS_VIDEO} range={{ start: target.start, end: target.end, label: target.name }} maskSubtitles={supportLevel < 4} /></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-5">{[
          ['1', '原速再听'], ['2', '显示关键词'], ['3', '缺词字幕'], ['4', '完整字幕'], ['5', '中文翻译'],
        ].map(([level, label]) => <button key={level} type="button" onClick={() => { const value = Number(level); if (value === 1) playerRef.current?.replay(); else setSupportLevels((current) => ({ ...current, [targetId]: Math.max(current[targetId] ?? 0, value) })); }} className={`min-h-11 rounded-lg border px-2 text-xs font-black ${supportLevel >= Number(level) && Number(level) > 1 ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{level}. {label}</button>)}</div>
        {supportLevel >= 2 && <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm leading-7 text-gray-700">{supportLevel === 2 && <><strong className="text-primary">关键词：</strong>{target.keywords.join(' · ')}</>}{supportLevel === 3 && target.gapTranscript}{supportLevel === 4 && target.transcript}{supportLevel >= 5 && <><p>{target.transcript}</p><p className="mt-2 text-gray-500">{target.translation}</p></>}</div>}
        <VocabularyRescue speaker={target} onReplay={() => playerRef.current?.replay()} onOpen={() => {}} courseName="Pourquoi choisir le français ?" themes={['听力课', '学习动机']} />
        <button type="button" onClick={finishTarget} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white">{nextSection(targetId, new Set(completedTargets).add(targetId)) ? `听下一组：${nextSection(targetId, new Set(completedTargets).add(targetId))!.name}` : '完成定向再听'}</button>
      </section>
    );

    if (step === 4) {
      const isReviewed = reviewed.has(dictationId);
      return <section>
        <p className="text-sm font-bold text-primary">关键词听写 · Dictée ciblée</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">听写“{dictation.name}”中的关键词</h2>
        <p className="mt-2 text-sm text-gray-500">完整法语语境已经保留，只填写空缺的关键词；中文翻译默认隐藏。</p>
        <div className="mt-5">{sectionTabs(dictationId, setDictationId)}</div>
        <div className="mt-5"><SegmentVideoPlayer src={REASONS_VIDEO} range={{ start: dictation.start, end: dictation.end, label: `${dictation.name} · 关键词听写` }} maskSubtitles /></div>
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-base leading-[3.2] text-gray-700">{dictation.dictationTemplate.map((part, index) => {
          if (typeof part === 'string') return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
          const blankNumber = dictation.dictationTemplate.slice(0, index).filter((item) => typeof item !== 'string').length + 1;
          return <span key={part.id} className="inline-block"><input value={inputs[part.id] ?? ''} disabled={isReviewed} onChange={(event) => setInputs((current) => ({ ...current, [part.id]: event.target.value }))} placeholder={`第${blankNumber}空`} aria-label={`${dictation.name}第${blankNumber}空`} className={`mx-1 h-10 w-32 rounded-md border px-2 text-center text-sm font-bold ${isReviewed ? normalize(inputs[part.id] ?? '') === normalize(part.answer) ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-600' : 'border-gray-300'}`} />{isReviewed && normalize(inputs[part.id] ?? '') !== normalize(part.answer) && <span className="mr-2 text-xs font-bold text-emerald-600">{part.answer}</span>}</span>;
        })}</div>
        {!isReviewed && <button type="button" aria-expanded={shownDictationTranslations.has(dictationId)} onClick={() => setShownDictationTranslations((current) => { const next = new Set(current); next.has(dictationId) ? next.delete(dictationId) : next.add(dictationId); return next; })} className="mt-3 min-h-11 text-sm font-bold text-primary">{shownDictationTranslations.has(dictationId) ? '收起中文翻译' : '需要帮助？显示中文翻译'}</button>}
        {!isReviewed && shownDictationTranslations.has(dictationId) && <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">{dictation.translation}</p>}
        {isReviewed && <div className="mt-4 rounded-lg bg-indigo-50 p-4 text-sm leading-7 text-gray-700"><p className="text-xs font-black text-primary">完整答案</p><p className="mt-1">{dictation.transcript}</p><p className="mt-3 border-t border-indigo-100 pt-3 text-gray-500">{dictation.translation}</p></div>}
        <button type="button" onClick={checkDictation} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white">{!isReviewed ? `核对 ${dictation.name}` : nextSection(dictationId, new Set(reviewed).add(dictationId)) ? `听写下一组：${nextSection(dictationId, new Set(reviewed).add(dictationId))!.name}` : '查看学习反思'}</button>
      </section>;
    }

    return <section>
      <p className="text-sm font-bold text-primary">学习反思 · Réflexion</p>
      <h2 className="mt-2 text-2xl font-black text-gray-800">这次你听懂了什么？</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="border-l-4 border-primary bg-gray-50 p-4"><span className="text-xs text-gray-400">内容核验</span><strong className="mt-1 block text-xl">{summary.comprehensionCorrect} / {REASONS_COMPREHENSION_QUESTIONS.length}</strong></div><div className="border-l-4 border-amber-400 bg-gray-50 p-4"><span className="text-xs text-gray-400">关键词听写</span><strong className="mt-1 block text-xl">{summary.dictationCorrect} / {summary.dictationTotal}</strong></div></div>
      <div className="mt-5 rounded-lg border border-gray-200 p-4"><h3 className="font-black text-gray-800">错误归纳</h3><div className="mt-3 space-y-2">{(summary.errors.length ? summary.errors : ['内容核验和关键词听写全部正确。']).map((error) => <p key={error} className="text-sm text-gray-600">{error}</p>)}</div></div>
      <div className="mt-5"><h3 className="font-black text-gray-800">本次有效的策略</h3><div className="mt-3 grid gap-2">{['抓住重复句型 La langue française, c’est…', '区分语言感受与实际用途', '通过词尾判断性数配合', '需要继续练习重音与拼写'].map((item) => <button key={item} type="button" onClick={() => setReflection((current) => { const next = new Set(current); next.has(item) ? next.delete(item) : next.add(item); return next; })} className={`min-h-11 rounded-lg border px-3 text-left text-sm font-bold ${reflection.has(item) ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{reflection.has(item) && <Check className="mr-2 inline h-4 w-4" />}{item}</button>)}</div></div>
      <div className="mt-7 border-t border-gray-100 pt-6">
        <p className="text-xs font-bold text-primary">把听懂的内容变成自己的表达</p>
        <h3 className="mt-2 text-lg font-black text-gray-800">Je choisis le français parce que…</h3>
        <p className="mt-2 text-sm text-gray-500">选择一个表达角度，再加入自己的经历或理由。</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{PERSONAL_EXPRESSION_MODELS.map((model) => <button key={model.label} type="button" onClick={() => setPersonalExpression(model.text)} className={`min-h-16 rounded-lg border px-3 py-3 text-left ${personalExpression === model.text ? 'border-primary bg-indigo-50' : 'border-gray-200 bg-white'}`}><span className="block text-xs font-black text-primary">{model.label}</span><span className="mt-1 block text-sm font-bold leading-6 text-gray-700">{model.text}</span></button>)}</div>
        <label htmlFor="personal-expression" className="mt-5 block text-sm font-black text-gray-800">我的表达</label>
        <textarea id="personal-expression" value={personalExpression} onChange={(event) => setPersonalExpression(event.target.value)} rows={4} className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm font-bold leading-6 text-gray-700 outline-none focus:border-primary focus:ring-2 focus:ring-indigo-100" />
      </div>
      <Link to="/listening" className="mt-6 flex min-h-12 items-center justify-center rounded-lg bg-primary font-black text-white">返回课程列表</Link>
    </section>;
  };

  return <div className="py-6 md:py-10">
    <Link to="/listening" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500"><ArrowLeft className="h-4 w-4" />真实素材听力</Link>
    <header className="mt-5 border-b border-gray-100 pb-5"><div className="flex items-center gap-2 text-primary"><Headphones className="h-5 w-5" /><span className="text-sm font-black">课程 02 · 真实采访</span></div><h1 className="mt-2 text-3xl font-black text-gray-800">Pourquoi choisir le français ?</h1><p className="mt-2 text-sm text-gray-500">为什么选择法语？</p></header>
    <nav className="mt-5 grid grid-cols-6 gap-1.5 rounded-lg border border-gray-100 bg-white p-2" aria-label="课程步骤">{STEPS.map((label, index) => <button key={label} type="button" disabled={index > maxStep} onClick={() => go(index)} className={`min-w-0 py-2 text-center text-[10px] font-black sm:text-xs ${index === step ? 'text-primary' : index < step ? 'text-primary' : 'text-gray-400'}`}><span className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full ${index <= step ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>{index < step ? <Check className="h-3 w-3" /> : index + 1}</span><span className="block truncate">{label}</span></button>)}</nav>
    <main className="mx-auto mt-6 max-w-3xl rounded-lg border border-gray-100 bg-white p-5 shadow-sm sm:p-7">{renderStep()}</main>
    <aside className="mx-auto mt-4 flex max-w-3xl items-start gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" /><p>{step === 0 && '先预测信息类型，不提前显示目标词。'}{step === 1 && '第一遍连续播放，不要求听懂每一个形容词。'}{step === 2 && '通过法语选项核验关键词和核心内容，不依赖逐句翻译。'}{step === 3 && '按四段原声内容依次重听，提示只在需要时逐级打开。'}{step === 4 && '把声音与拼写连接起来，重点关注重音和词尾。'}{step === 5 && '先借用视频中的句式，再替换或补充成自己的真实理由。'}</p></aside>
  </div>;
};

export default ListeningReasonsView;
