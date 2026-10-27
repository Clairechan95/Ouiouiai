import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Headphones, Lightbulb, RotateCcw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import SegmentAudioPlayer, { SegmentAudioPlayerHandle } from '../components/SegmentAudioPlayer';
import VocabularyRescue from '../components/VocabularyRescue';
import { useAppContext } from '../App';
import { useListeningProgress } from '../hooks/useListeningProgress';
import { trackLearningEvent } from '../services/learningAnalyticsService';
import { loadLocalListeningRecord } from '../services/listeningProgressService';
import { dictationAnswersMatch, withoutFrenchAccents } from '../services/frenchAnswerService';
import {
  RESTAURANT_AUDIO,
  RESTAURANT_CLIPS,
  RESTAURANT_COMPREHENSION_QUESTIONS,
  RESTAURANT_COVER,
  RESTAURANT_FULL_RANGE,
  RESTAURANT_GIST_OPTIONS,
  RestaurantClipId,
  RestaurantDictationField,
} from '../data/listeningRestaurantLesson';

const STEPS = ['预测', '初听', '核验', '定向再听', '关键词听写', '反思'];
const PREDICTIONS = ['日期或时间', '用餐人数', '预订姓名', '座位要求', '菜品价格', '付款方式', '替代安排', '景观信息'];
const REFLECTION_OPTIONS = [
  '先确认交际场景，再记录时间、人数和姓名',
  '利用服务员的问句预测下一条信息',
  '抓住 par contre 判断对方要提出替代方案',
  '借助图片确认座位位置，但仍以声音为主',
  '需要继续练习数字和姓名的声音辨认',
  '需要继续练习餐厅订位的礼貌表达',
];
const EXPRESSION_MODELS = [
  {
    label: '完整电话订位',
    text: "Bonjour, je voudrais réserver une table pour demain soir. Ce serait pour quatre personnes, au nom de Chen. Est-ce qu'il y aurait possibilité d'être près de la fenêtre ?",
  },
  { label: '说明时间与人数', text: 'Je voudrais réserver une table pour samedi soir. Ce serait pour deux personnes.' },
  { label: '说明预订姓名', text: "La réservation est au nom de Chen : C.H.E.N." },
  { label: '提出座位要求', text: "Est-ce qu'il y aurait possibilité d'être en terrasse ?" },
];

const fieldsFor = (clipId: RestaurantClipId) => RESTAURANT_CLIPS
  .find((clip) => clip.id === clipId)!
  .dictationTemplate
  .filter((part): part is RestaurantDictationField => typeof part !== 'string');

type RestaurantProgress = {
  step: number;
  maxStep: number;
  predictions: string[];
  gist: number | null;
  comprehensionAnswers: Record<string, string>;
  comprehensionSubmitted: boolean;
  visibleQuestionHelp: string[];
  targetId: RestaurantClipId;
  completedTargets: RestaurantClipId[];
  supportLevels: Partial<Record<RestaurantClipId, number>>;
  targetAnswers: Partial<Record<RestaurantClipId, Record<string, string>>>;
  checkedTargets: RestaurantClipId[];
  dictationId: RestaurantClipId;
  inputs: Record<string, string>;
  reviewed: RestaurantClipId[];
  shownTranslations: RestaurantClipId[];
  reflection: string[];
  personalExpression: string;
};

const ListeningRestaurantView: React.FC = () => {
  const { user } = useAppContext();
  const playerRef = useRef<SegmentAudioPlayerHandle>(null);
  const analyticsStartedRef = useRef(false);
  const analyticsCompletedRef = useRef(false);
  const [initialRecord] = useState(() => loadLocalListeningRecord<RestaurantProgress>('reserver-une-table', user?.id));
  const initial = initialRecord?.progressState;
  const [step, setStep] = useState(initial?.step ?? 0);
  const [maxStep, setMaxStep] = useState(initial?.maxStep ?? 0);
  const [predictions, setPredictions] = useState<Set<string>>(new Set(initial?.predictions ?? []));
  const [gist, setGist] = useState<number | null>(initial?.gist ?? null);
  const [comprehensionAnswers, setComprehensionAnswers] = useState<Record<string, string>>(initial?.comprehensionAnswers ?? {});
  const [comprehensionSubmitted, setComprehensionSubmitted] = useState(initial?.comprehensionSubmitted ?? false);
  const [visibleQuestionHelp, setVisibleQuestionHelp] = useState<Set<string>>(new Set(initial?.visibleQuestionHelp ?? []));
  const [targetId, setTargetId] = useState<RestaurantClipId>(initial?.targetId ?? 'reservation');
  const [completedTargets, setCompletedTargets] = useState<Set<RestaurantClipId>>(new Set(initial?.completedTargets ?? []));
  const [supportLevels, setSupportLevels] = useState<Partial<Record<RestaurantClipId, number>>>(initial?.supportLevels ?? {});
  const [targetAnswers, setTargetAnswers] = useState<Partial<Record<RestaurantClipId, Record<string, string>>>>(initial?.targetAnswers ?? {});
  const [checkedTargets, setCheckedTargets] = useState<Set<RestaurantClipId>>(new Set(initial?.checkedTargets ?? []));
  const [dictationId, setDictationId] = useState<RestaurantClipId>(initial?.dictationId ?? 'reservation');
  const [inputs, setInputs] = useState<Record<string, string>>(initial?.inputs ?? {});
  const [reviewed, setReviewed] = useState<Set<RestaurantClipId>>(new Set(initial?.reviewed ?? []));
  const [shownTranslations, setShownTranslations] = useState<Set<RestaurantClipId>>(new Set(initial?.shownTranslations ?? []));
  const [reflection, setReflection] = useState<Set<string>>(new Set(initial?.reflection ?? []));
  const [personalExpression, setPersonalExpression] = useState(initial?.personalExpression ?? EXPRESSION_MODELS[0].text);
  const [completedAt, setCompletedAt] = useState<string | null>(initialRecord?.completedAt ?? null);

  useEffect(() => {
    if (!user?.id || analyticsStartedRef.current) return;
    analyticsStartedRef.current = true;
    trackLearningEvent('lesson_started', 'listening', {
      ownerUserId: user.id,
      targetId: 'reserver-une-table',
      properties: { content_version: 1 },
    });
  }, [user?.id]);

  useEffect(() => {
    if (step !== 5 || !user?.id || analyticsCompletedRef.current) return;
    analyticsCompletedRef.current = true;
    trackLearningEvent('lesson_completed', 'listening', {
      ownerUserId: user.id,
      targetId: 'reserver-une-table',
      properties: { content_version: 1 },
    });
  }, [step, user?.id]);

  useEffect(() => {
    if (step === 5) setCompletedAt((current) => current ?? new Date().toISOString());
  }, [step]);

  const go = (next: number) => {
    const value = Math.max(0, Math.min(5, next));
    setStep(value);
    setMaxStep((current) => Math.max(current, value));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const trackAudioError = (reason: 'load' | 'play', clipId: RestaurantClipId | 'full') => {
    trackLearningEvent('media_error', 'listening', {
      ownerUserId: user?.id,
      targetId: `reserver-une-table:${clipId}`,
      properties: { media: 'audio', reason, step },
    });
  };

  const nextClip = (current: RestaurantClipId, done: Set<RestaurantClipId>) => {
    const index = RESTAURANT_CLIPS.findIndex((clip) => clip.id === current);
    return RESTAURANT_CLIPS.slice(index + 1).find((clip) => !done.has(clip.id))
      ?? RESTAURANT_CLIPS.find((clip) => !done.has(clip.id));
  };

  const target = RESTAURANT_CLIPS.find((clip) => clip.id === targetId)!;
  const dictation = RESTAURANT_CLIPS.find((clip) => clip.id === dictationId)!;
  const selectedTargetAnswers = targetAnswers[targetId] ?? {};
  const targetComplete = target.questions.every((question) => Boolean(selectedTargetAnswers[question.id]));
  const targetChecked = checkedTargets.has(targetId);
  const supportLevel = supportLevels[targetId] ?? 0;

  const finishTarget = () => {
    if (!targetChecked) {
      setCheckedTargets((current) => new Set(current).add(targetId));
      return;
    }
    const done = new Set(completedTargets).add(targetId);
    setCompletedTargets(done);
    const next = nextClip(targetId, done);
    if (next) setTargetId(next.id);
    else go(4);
  };

  const checkDictation = () => {
    if (!reviewed.has(dictationId)) {
      setReviewed((current) => new Set(current).add(dictationId));
      return;
    }
    const done = new Set(reviewed).add(dictationId);
    const next = nextClip(dictationId, done);
    if (next) setDictationId(next.id);
    else go(5);
  };

  const summary = useMemo(() => {
    const comprehensionCorrect = RESTAURANT_COMPREHENSION_QUESTIONS.filter((question) => comprehensionAnswers[question.id] === question.answer).length;
    let targetedCorrect = 0;
    let targetedTotal = 0;
    let dictationCorrect = 0;
    let dictationTotal = 0;
    const errors: string[] = [];
    RESTAURANT_CLIPS.forEach((clip) => {
      clip.questions.forEach((question) => {
        targetedTotal += 1;
        if (targetAnswers[clip.id]?.[question.id] === question.answer) targetedCorrect += 1;
        else errors.push(`${clip.chineseName}：${question.focus}`);
      });
      fieldsFor(clip.id).forEach((field) => {
        dictationTotal += 1;
        const value = inputs[field.id] ?? '';
        if (dictationAnswersMatch(value, field.answer)) dictationCorrect += 1;
        else if (!value.trim()) errors.push(`${field.label}：未填写（${field.answer}）`);
        else if (withoutFrenchAccents(value) === withoutFrenchAccents(field.answer)) errors.push(`${field.label}：注意重音符号（${field.answer}）`);
        else errors.push(`${field.label}：声音辨认或拼写需复习（${field.answer}）`);
      });
    });
    if (comprehensionCorrect < RESTAURANT_COMPREHENSION_QUESTIONS.length) errors.unshift('第一次核验：时间、人数或座位要求需要再次确认');
    return { comprehensionCorrect, targetedCorrect, targetedTotal, dictationCorrect, dictationTotal, errors };
  }, [comprehensionAnswers, inputs, targetAnswers]);

  const progressState = useMemo<RestaurantProgress>(() => ({
    step,
    maxStep,
    predictions: Array.from(predictions),
    gist,
    comprehensionAnswers,
    comprehensionSubmitted,
    visibleQuestionHelp: Array.from(visibleQuestionHelp),
    targetId,
    completedTargets: Array.from(completedTargets),
    supportLevels,
    targetAnswers,
    checkedTargets: Array.from(checkedTargets),
    dictationId,
    inputs,
    reviewed: Array.from(reviewed),
    shownTranslations: Array.from(shownTranslations),
    reflection: Array.from(reflection),
    personalExpression,
  }), [checkedTargets, completedTargets, comprehensionAnswers, comprehensionSubmitted, dictationId, gist, inputs, maxStep, personalExpression, predictions, reflection, reviewed, shownTranslations, step, supportLevels, targetAnswers, targetId, visibleQuestionHelp]);

  const learningArchive = useMemo(() => step !== 5 ? null : ({
    courseTitle: 'Réserver une table au restaurant',
    completedAt: completedAt ?? new Date().toISOString(),
    scores: [
      { label: '内容核验', score: summary.comprehensionCorrect, total: RESTAURANT_COMPREHENSION_QUESTIONS.length },
      { label: '定向任务', score: summary.targetedCorrect, total: summary.targetedTotal },
      { label: '关键词听写', score: summary.dictationCorrect, total: summary.dictationTotal },
    ],
    errors: summary.errors,
    strategies: Array.from(reflection),
    personalExpression,
    supports: RESTAURANT_CLIPS.filter((clip) => (supportLevels[clip.id] ?? 0) > 1).map((clip) => `${clip.chineseName}：第 ${supportLevels[clip.id]} 级帮助`),
  }), [completedAt, personalExpression, reflection, step, summary, supportLevels]);

  useListeningProgress<RestaurantProgress>({
    courseId: 'reserver-une-table',
    userId: user?.id,
    currentStep: step,
    maxStep,
    progressState,
    learningArchive,
    onRestore: (record) => {
      const restored = record.progressState;
      setStep(restored.step ?? 0);
      setMaxStep(restored.maxStep ?? 0);
      setPredictions(new Set(restored.predictions ?? []));
      setGist(restored.gist ?? null);
      setComprehensionAnswers(restored.comprehensionAnswers ?? {});
      setComprehensionSubmitted(restored.comprehensionSubmitted ?? false);
      setVisibleQuestionHelp(new Set(restored.visibleQuestionHelp ?? []));
      setTargetId(restored.targetId ?? 'reservation');
      setCompletedTargets(new Set(restored.completedTargets ?? []));
      setSupportLevels(restored.supportLevels ?? {});
      setTargetAnswers(restored.targetAnswers ?? {});
      setCheckedTargets(new Set(restored.checkedTargets ?? []));
      setDictationId(restored.dictationId ?? 'reservation');
      setInputs(restored.inputs ?? {});
      setReviewed(new Set(restored.reviewed ?? []));
      setShownTranslations(new Set(restored.shownTranslations ?? []));
      setReflection(new Set(restored.reflection ?? []));
      setPersonalExpression(restored.personalExpression ?? EXPRESSION_MODELS[0].text);
      setCompletedAt(record.completedAt);
    },
  });

  const toggleHelp = (key: string) => setVisibleQuestionHelp((current) => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const clipTabs = (active: RestaurantClipId, setActive: (id: RestaurantClipId) => void) => (
    <div className="grid gap-2 sm:grid-cols-3">
      {RESTAURANT_CLIPS.map((clip, index) => <button key={clip.id} type="button" onClick={() => setActive(clip.id)} className={`min-h-12 rounded-lg border px-3 text-left text-xs font-black ${active === clip.id ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-500'}`}><span className="block">片段 {index + 1} · {clip.name}</span><span className="mt-0.5 block font-medium text-gray-400">{clip.chineseName}</span></button>)}
    </div>
  );

  const renderOptions = (
    question: (typeof RESTAURANT_COMPREHENSION_QUESTIONS)[number],
    selected: string | undefined,
    submitted: boolean,
    choose: (value: string) => void,
  ) => <div className={`mt-3 grid gap-2 ${question.options.some((option) => option.image) ? 'sm:grid-cols-3' : ''}`}>
    {question.options.map((option) => {
      const isCorrect = submitted && option.value === question.answer;
      const isWrong = submitted && selected === option.value && option.value !== question.answer;
      return <button key={option.value} type="button" disabled={submitted} onClick={() => choose(option.value)} className={`overflow-hidden rounded-lg border text-left text-sm font-black ${isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : isWrong ? 'border-red-300 bg-red-50 text-red-600' : selected === option.value ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-700'}`}>
        {option.image && <div className="aspect-[16/8] overflow-hidden bg-gray-100"><img src={option.image} alt="" className="h-full w-full object-cover" /></div>}
        <span className="flex min-h-12 items-center px-4 py-3">{isCorrect && <Check className="mr-2 h-4 w-4 flex-shrink-0" />}{isWrong && <X className="mr-2 h-4 w-4 flex-shrink-0" />}{option.label}{submitted && option.detail && <small className="ml-2 font-medium text-gray-400">{option.detail}</small>}</span>
      </button>;
    })}
  </div>;

  const renderStep = () => {
    if (step === 0) return <section>
      <p className="text-sm font-bold text-primary">听前预测 · Anticipation</p>
      <h2 className="mt-2 text-2xl font-black text-gray-800">电话预订餐桌时，要听清哪些信息？</h2>
      <p className="mt-2 text-sm text-gray-500">观察餐厅场景，选择你认为可能出现的信息，可以多选。</p>
      <img src={RESTAURANT_COVER} alt="餐厅里已经摆好的餐桌" className="mt-5 aspect-[16/6] w-full rounded-lg object-cover" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">{PREDICTIONS.map((item) => <button key={item} type="button" onClick={() => setPredictions((current) => { const next = new Set(current); next.has(item) ? next.delete(item) : next.add(item); return next; })} className={`min-h-12 rounded-lg border px-4 text-left text-sm font-bold ${predictions.has(item) ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{predictions.has(item) && <Check className="mr-2 inline h-4 w-4" />}{item}</button>)}</div>
      <button type="button" disabled={!predictions.size} onClick={() => go(1)} className="mt-7 min-h-12 w-full rounded-lg bg-primary font-black text-white disabled:bg-gray-200">带着预测去听</button>
    </section>;

    if (step === 1) return <section>
      <p className="text-sm font-bold text-primary">整体初听 · Écoute globale</p>
      <h2 className="mt-2 text-2xl font-black text-gray-800">先判断这通电话在完成什么任务</h2>
      <p className="mt-2 text-sm text-gray-500">完整原速听一遍，不急着记住姓名或每一个座位细节。</p>
      <div className="mt-5"><SegmentAudioPlayer src={RESTAURANT_AUDIO} range={RESTAURANT_FULL_RANGE} artwork={RESTAURANT_COVER} artworkAlt="餐厅餐桌" onPlaybackError={(reason) => trackAudioError(reason, 'full')} /></div>
      <h3 className="mt-7 font-black text-gray-800">Quelle est la situation ?</h3>
      <button type="button" aria-expanded={visibleQuestionHelp.has('gist')} onClick={() => toggleHelp('gist')} className="mt-2 min-h-9 text-xs font-bold text-primary">{visibleQuestionHelp.has('gist') ? '收起题意帮助' : '看不懂题目？'}</button>
      {visibleQuestionHelp.has('gist') && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">这通电话的主要交际任务是什么？</p>}
      <div className="mt-3 space-y-2">{RESTAURANT_GIST_OPTIONS.map((option, index) => <button key={option} type="button" onClick={() => setGist(index)} className={`min-h-12 w-full rounded-lg border px-4 text-left text-sm font-bold ${gist === index ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{option}</button>)}</div>
      <button type="button" disabled={gist === null} onClick={() => go(2)} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white disabled:bg-gray-200">提交并核验</button>
    </section>;

    if (step === 2) return <section>
      <p className="text-sm font-bold text-primary">第一次核验 · Vérification</p>
      <h2 className="mt-2 text-2xl font-black text-gray-800">抓住时间、人数和座位要求</h2>
      <p className={`mt-4 rounded-lg p-3 text-sm font-bold ${gist === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{gist === 0 ? '主旨判断正确：顾客正在电话预订餐桌。' : '参考答案：这是一通餐厅订位电话。'}</p>
      <div className="mt-5"><SegmentAudioPlayer src={RESTAURANT_AUDIO} range={RESTAURANT_FULL_RANGE} artwork={RESTAURANT_COVER} onPlaybackError={(reason) => trackAudioError(reason, 'full')} /></div>
      <div className="mt-7 space-y-6">{RESTAURANT_COMPREHENSION_QUESTIONS.map((question, index) => {
        const selected = comprehensionAnswers[question.id];
        return <section key={question.id} className="border-b border-gray-100 pb-6 last:border-0">
          <h3 className="text-sm font-black text-gray-800"><span className="mr-2 text-primary">{index + 1}.</span>{question.prompt}</h3>
          <button type="button" aria-expanded={visibleQuestionHelp.has(question.id)} onClick={() => toggleHelp(question.id)} className="mt-2 min-h-9 text-xs font-bold text-primary">{visibleQuestionHelp.has(question.id) ? '收起题意帮助' : '看不懂题目？查看题意帮助'}</button>
          {visibleQuestionHelp.has(question.id) && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{question.promptHelp}</p>}
          {renderOptions(question, selected, comprehensionSubmitted, (value) => setComprehensionAnswers((current) => ({ ...current, [question.id]: value })))}
          {comprehensionSubmitted && <p className={`mt-3 text-xs font-bold ${selected === question.answer ? 'text-emerald-600' : 'text-gray-500'}`}>{selected === question.answer ? '正确' : '再听提示'} · {question.focus}</p>}
        </section>;
      })}</div>
      <button type="button" disabled={!comprehensionSubmitted && !RESTAURANT_COMPREHENSION_QUESTIONS.every((question) => Boolean(comprehensionAnswers[question.id]))} onClick={() => comprehensionSubmitted ? go(3) : setComprehensionSubmitted(true)} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white disabled:bg-gray-200">{comprehensionSubmitted ? '进入定向再听' : '提交并查看答案'}</button>
    </section>;

    if (step === 3) return <section>
      <p className="text-sm font-bold text-primary">定向再听 · Écoute ciblée</p>
      <h2 className="mt-2 text-2xl font-black text-gray-800">{target.name}</h2>
      <p className="mt-2 text-sm text-gray-500">{target.prompt}</p>
      <div className="mt-5">{clipTabs(targetId, setTargetId)}</div>
      <div className="mt-5"><SegmentAudioPlayer ref={playerRef} src={RESTAURANT_AUDIO} range={target.range} artwork={target.artwork} onPlaybackError={(reason) => trackAudioError(reason, target.id)} /></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-5">{[['1', '原速再听'], ['2', '显示关键词'], ['3', '缺词字幕'], ['4', '完整字幕'], ['5', '中文翻译']].map(([level, label]) => <button key={level} type="button" onClick={() => { const value = Number(level); if (value === 1) playerRef.current?.replay(); else setSupportLevels((current) => ({ ...current, [targetId]: Math.max(current[targetId] ?? 0, value) })); }} className={`min-h-11 rounded-lg border px-2 text-xs font-black ${supportLevel >= Number(level) && Number(level) > 1 ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{level}. {label}</button>)}</div>
      {supportLevel >= 2 && <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm leading-7 text-gray-700">{supportLevel === 2 && <><strong className="text-primary">关键词：</strong>{target.keywords.join(' · ')}</>}{supportLevel === 3 && target.gapTranscript}{supportLevel === 4 && target.transcript}{supportLevel >= 5 && <><p>{target.transcript}</p><p className="mt-2 text-gray-500">{target.translation}</p></>}</div>}
      <div className="mt-6 space-y-5 border-t border-gray-100 pt-5">{target.questions.map((question, index) => {
        const selected = selectedTargetAnswers[question.id];
        const helpKey = `target:${question.id}`;
        return <section key={question.id} className="rounded-lg bg-gray-50 p-4">
          <h3 className="text-sm font-black text-gray-800"><span className="mr-2 text-primary">{index + 1}.</span>{question.prompt}</h3>
          <button type="button" aria-expanded={visibleQuestionHelp.has(helpKey)} onClick={() => toggleHelp(helpKey)} className="mt-2 min-h-9 text-xs font-bold text-primary">{visibleQuestionHelp.has(helpKey) ? '收起题意帮助' : '看不懂题目？'}</button>
          {visibleQuestionHelp.has(helpKey) && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{question.promptHelp}</p>}
          {renderOptions(question, selected, targetChecked, (value) => setTargetAnswers((current) => ({ ...current, [targetId]: { ...(current[targetId] ?? {}), [question.id]: value } })))}
          {targetChecked && <p className={`mt-3 text-xs font-bold ${selected === question.answer ? 'text-emerald-600' : 'text-gray-500'}`}>{selected === question.answer ? '听辨正确' : '请再听一次'} · {question.focus}</p>}
        </section>;
      })}</div>
      <VocabularyRescue speaker={target} onReplay={() => playerRef.current?.replay()} onOpen={() => {}} courseName="Réserver une table au restaurant" themes={['听力课', '餐厅订位']} />
      {targetChecked && <button type="button" onClick={() => { setCheckedTargets((current) => { const next = new Set(current); next.delete(targetId); return next; }); setTargetAnswers((current) => ({ ...current, [targetId]: {} })); }} className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-gray-500"><RotateCcw className="h-4 w-4" />重做本段</button>}
      <button type="button" disabled={!targetComplete} onClick={finishTarget} className="mt-4 min-h-12 w-full rounded-lg bg-primary font-black text-white disabled:bg-gray-200">{!targetChecked ? '核对本段' : nextClip(targetId, new Set(completedTargets).add(targetId)) ? `听下一段：${nextClip(targetId, new Set(completedTargets).add(targetId))!.chineseName}` : '完成定向再听'}</button>
    </section>;

    if (step === 4) {
      const isReviewed = reviewed.has(dictationId);
      return <section>
        <p className="text-sm font-bold text-primary">关键词听写 · Dictée ciblée</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">听写“{dictation.chineseName}”中的关键词</h2>
        <p className="mt-2 text-sm text-gray-500">保留完整法语语境，只填写关键表达；中文翻译按需查看。</p>
        <div className="mt-5">{clipTabs(dictationId, setDictationId)}</div>
        <div className="mt-5"><SegmentAudioPlayer src={RESTAURANT_AUDIO} range={dictation.range} artwork={dictation.artwork} onPlaybackError={(reason) => trackAudioError(reason, dictation.id)} /></div>
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-base leading-[3.2] text-gray-700">{dictation.dictationTemplate.map((part, index) => {
          if (typeof part === 'string') return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
          const blankNumber = dictation.dictationTemplate.slice(0, index).filter((item) => typeof item !== 'string').length + 1;
          const isCorrect = dictationAnswersMatch(inputs[part.id] ?? '', part.answer);
          return <span key={part.id} className="inline-block"><input value={inputs[part.id] ?? ''} disabled={isReviewed} onChange={(event) => setInputs((current) => ({ ...current, [part.id]: event.target.value }))} placeholder={`第${blankNumber}空`} aria-label={`${dictation.name}第${blankNumber}空`} className={`mx-1 h-10 w-32 rounded-md border px-2 text-center text-sm font-bold ${isReviewed ? isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-600' : 'border-gray-300'}`} />{isReviewed && !isCorrect && <span className="mr-2 text-xs font-bold text-emerald-600">{part.answer}</span>}</span>;
        })}</div>
        {!isReviewed && <button type="button" aria-expanded={shownTranslations.has(dictationId)} onClick={() => setShownTranslations((current) => { const next = new Set(current); next.has(dictationId) ? next.delete(dictationId) : next.add(dictationId); return next; })} className="mt-3 min-h-11 text-sm font-bold text-primary">{shownTranslations.has(dictationId) ? '收起中文翻译' : '需要帮助？显示中文翻译'}</button>}
        {!isReviewed && shownTranslations.has(dictationId) && <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">{dictation.translation}</p>}
        {isReviewed && <div className="mt-4 rounded-lg bg-indigo-50 p-4 text-sm leading-7 text-gray-700"><p className="text-xs font-black text-primary">完整答案</p><p className="mt-1">{dictation.transcript}</p><p className="mt-3 border-t border-indigo-100 pt-3 text-gray-500">{dictation.translation}</p></div>}
        <button type="button" onClick={checkDictation} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white">{!isReviewed ? `核对 ${dictation.chineseName}` : nextClip(dictationId, new Set(reviewed).add(dictationId)) ? `听写下一段：${nextClip(dictationId, new Set(reviewed).add(dictationId))!.chineseName}` : '查看学习反思'}</button>
      </section>;
    }

    return <section>
      <p className="text-sm font-bold text-primary">学习反思 · Réflexion</p>
      <h2 className="mt-2 text-2xl font-black text-gray-800">这次你听懂了什么？</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="border-l-4 border-primary bg-gray-50 p-4"><span className="text-xs text-gray-400">内容核验</span><strong className="mt-1 block text-xl">{summary.comprehensionCorrect} / {RESTAURANT_COMPREHENSION_QUESTIONS.length}</strong></div><div className="border-l-4 border-emerald-400 bg-gray-50 p-4"><span className="text-xs text-gray-400">定向任务</span><strong className="mt-1 block text-xl">{summary.targetedCorrect} / {summary.targetedTotal}</strong></div><div className="border-l-4 border-amber-400 bg-gray-50 p-4"><span className="text-xs text-gray-400">关键词听写</span><strong className="mt-1 block text-xl">{summary.dictationCorrect} / {summary.dictationTotal}</strong></div></div>
      <div className="mt-5 rounded-lg border border-gray-200 p-4"><h3 className="font-black text-gray-800">错误归纳</h3><div className="mt-3 space-y-2">{(summary.errors.length ? summary.errors : ['内容核验、定向任务和关键词听写全部正确。']).map((error) => <p key={error} className="text-sm text-gray-600">{error}</p>)}</div></div>
      <div className="mt-5"><h3 className="font-black text-gray-800">本次有效的策略</h3><div className="mt-3 grid gap-2">{REFLECTION_OPTIONS.map((item) => <button key={item} type="button" onClick={() => setReflection((current) => { const next = new Set(current); next.has(item) ? next.delete(item) : next.add(item); return next; })} className={`min-h-11 rounded-lg border px-3 text-left text-sm font-bold ${reflection.has(item) ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{reflection.has(item) && <Check className="mr-2 inline h-4 w-4" />}{item}</button>)}</div></div>
      <div className="mt-7 border-t border-gray-100 pt-6"><p className="text-xs font-bold text-primary">把听懂的内容变成自己的表达</p><h3 className="mt-2 text-lg font-black text-gray-800">完成一次自己的电话订位</h3><p className="mt-2 text-sm text-gray-500">写 3–4 句：说明时间、人数和姓名，再提出一个座位要求。可以点击参考表达后替换信息。</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{EXPRESSION_MODELS.map((model) => <button key={model.label} type="button" onClick={() => setPersonalExpression(model.text)} className={`min-h-16 rounded-lg border px-3 py-3 text-left ${personalExpression === model.text ? 'border-primary bg-indigo-50' : 'border-gray-200 bg-white'}`}><span className="block text-xs font-black text-primary">{model.label}</span><span className="mt-1 block text-sm font-bold leading-6 text-gray-700">{model.text}</span></button>)}</div><label htmlFor="restaurant-expression" className="mt-5 block text-sm font-black text-gray-800">请写下你的订位表达</label><textarea id="restaurant-expression" value={personalExpression} onChange={(event) => setPersonalExpression(event.target.value)} rows={5} className="mt-2 w-full resize-y rounded-lg border border-gray-200 p-3 text-sm font-bold leading-6 text-gray-700 outline-none focus:border-primary focus:ring-2 focus:ring-indigo-100" /></div>
      <p className="mt-6 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-700">学习档案已自动保存，可在课程列表中回顾；登录后教师端也可查看档案摘要。</p>
      <Link to="/listening" className="mt-6 flex min-h-12 items-center justify-center rounded-lg bg-primary font-black text-white">返回课程列表</Link>
    </section>;
  };

  return <div className="py-6 md:py-10">
    <Link to="/listening" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500"><ArrowLeft className="h-4 w-4" />真实素材听力</Link>
    <header className="mt-5 border-b border-gray-100 pb-5"><div className="flex items-center gap-2 text-primary"><Headphones className="h-5 w-5" /><span className="text-sm font-black">课程 05 · 真实情境</span></div><h1 className="mt-2 text-3xl font-black text-gray-800">Réserver une table au restaurant</h1><p className="mt-2 text-sm text-gray-500">电话订位：听懂时间、人数、姓名、座位要求和替代安排</p></header>
    <nav className="mt-5 grid grid-cols-6 gap-1.5 rounded-lg border border-gray-100 bg-white p-2" aria-label="课程步骤">{STEPS.map((label, index) => <button key={label} type="button" disabled={index > maxStep} onClick={() => go(index)} className={`min-w-0 py-2 text-center text-[10px] font-black sm:text-xs ${index <= step ? 'text-primary' : 'text-gray-400'}`}><span className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full ${index <= step ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>{index < step ? <Check className="h-3 w-3" /> : index + 1}</span><span className="block truncate">{label}</span></button>)}</nav>
    <main className="mx-auto mt-6 max-w-3xl rounded-lg border border-gray-100 bg-white p-5 shadow-sm sm:p-7">{renderStep()}</main>
    <aside className="mx-auto mt-4 flex max-w-3xl items-start gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" /><p>{step === 0 && '先预测订位需要的信息，不提前显示答案。'}{step === 1 && '完整原速听一遍，先判断交际目的。'}{step === 2 && '只核验三个核心信息；题意帮助和图片按需使用。'}{step === 3 && '三个片段保留前后语境，并逐级开放关键词、字幕和翻译。'}{step === 4 && '把餐厅表达的声音与拼写连接起来，中文翻译按需显示。'}{step === 5 && '借用音频中的句型，完成一次自己的电话订位。'}</p></aside>
  </div>;
};

export default ListeningRestaurantView;
