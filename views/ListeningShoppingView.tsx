import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Apple,
  ArrowLeft,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CircleHelp,
  CookingPot,
  CreditCard,
  Footprints,
  Hand,
  Headphones,
  Images,
  Lightbulb,
  ListChecks,
  PackageCheck,
  Plane,
  ReceiptText,
  RotateCcw,
  Scale,
  Shirt,
  ShoppingBasket,
  Store,
  Sun,
  TrainFront,
  Utensils,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SegmentVideoPlayer, { SegmentVideoPlayerHandle } from '../components/SegmentVideoPlayer';
import VocabularyRescue from '../components/VocabularyRescue';
import { useAppContext } from '../App';
import { useListeningProgress } from '../hooks/useListeningProgress';
import { trackLearningEvent } from '../services/learningAnalyticsService';
import { loadLocalListeningRecord } from '../services/listeningProgressService';
import { dictationAnswersMatch, withoutFrenchAccents } from '../services/frenchAnswerService';
import {
  SHOPPING_CLIPS,
  SHOPPING_COMPREHENSION_QUESTIONS,
  SHOPPING_FULL_RANGE,
  SHOPPING_GIST_OPTIONS,
  SHOPPING_VIDEO,
  ShoppingClipId,
  ShoppingDictationField,
  ShoppingOptionIcon,
} from '../data/listeningShoppingLesson';

const STEPS = ['预测', '初听', '核验', '定向再听', '关键词听写', '反思'];
const PREDICTIONS = ['购物目的', '商品名称', '数量或尺码', '价格信息', '付款方式', '会员卡', '路线方向', '天气情况'];
const REFLECTION_OPTIONS = [
  '先判断场景与购物目的，再听商品细节',
  '利用画面确认商品类别，但不依赖画面猜答案',
  '用 de / du / de la / des 帮助切分配料清单',
  '重点捕捉数量、尺码和价格中的数字',
  '利用收银员的固定问句判断付款环节',
  '需要继续练习食品词汇的声音辨认',
];
const EXPRESSION_MODELS = [
  {
    label: '完整购物对话',
    text: "Bonjour, je vais faire un dîner pour mes amis. J'ai besoin de fromage, d'oignons et de crème fraîche. Vous avez aussi cette paire en taille 38, s'il vous plaît ? Je règle par carte.",
  },
  { label: '说明购物目的', text: "J'invite des amis ce soir et je vais préparer le dîner." },
  { label: '列出所需商品', text: "J'ai besoin de fromage, de crème fraîche, d'oignons et de vin blanc." },
  { label: '询问商品尺码', text: 'Excusez-moi, vous avez cette paire en taille 38, s’il vous plaît ?' },
  { label: '说明付款方式', text: 'Je règle par carte, s’il vous plaît.' },
];

const SHOPPING_OPTION_ICONS: Record<ShoppingOptionIcon, React.ComponentType<{ className?: string }>> = {
  meal: Utensils,
  picnic: ShoppingBasket,
  work: BriefcaseBusiness,
  product: PackageCheck,
  shoes: Footprints,
  gloves: Hand,
  scale: Scale,
  socks: PackageCheck,
  produce: Apple,
  checkout: CreditCard,
  restaurant: Utensils,
  station: TrainFront,
  clothes: Shirt,
  kitchen: CookingPot,
  market: Store,
  card: CreditCard,
  cash: Banknote,
  cheque: ReceiptText,
  weekend: CalendarDays,
  afternoon: Sun,
  holiday: Plane,
};

const optionIcons = (icons: ShoppingOptionIcon[] | undefined, active: boolean) => {
  if (!icons?.length) return null;
  return <span className="mb-2 flex min-h-7 items-center justify-center gap-1.5" aria-hidden="true">
    {icons.map((icon, index) => {
      const OptionIcon = SHOPPING_OPTION_ICONS[icon];
      return <React.Fragment key={`${icon}-${index}`}>
        <OptionIcon className={`h-5 w-5 ${active ? 'text-current' : 'text-gray-400'}`} />
        {index < icons.length - 1 && <span className="text-xs text-gray-300">→</span>}
      </React.Fragment>;
    })}
  </span>;
};

const fieldsFor = (clipId: ShoppingClipId) => SHOPPING_CLIPS
  .find((clip) => clip.id === clipId)!
  .dictationTemplate
  .filter((part): part is ShoppingDictationField => typeof part !== 'string');

type ShoppingProgress = {
  step: number;
  maxStep: number;
  predictions: string[];
  gist: number | null;
  comprehensionAnswers: Record<string, string>;
  comprehensionSubmitted: boolean;
  visibleQuestionHelp: string[];
  targetId: ShoppingClipId;
  completedTargets: ShoppingClipId[];
  supportLevels: Partial<Record<ShoppingClipId, number>>;
  sequenceSelections: Partial<Record<ShoppingClipId, string[]>>;
  choiceAnswers: Partial<Record<ShoppingClipId, Record<string, string>>>;
  checkedTargets: ShoppingClipId[];
  visualHelpOpened: ShoppingClipId[];
  dictationId: ShoppingClipId;
  inputs: Record<string, string>;
  reviewed: ShoppingClipId[];
  shownTranslations: ShoppingClipId[];
  reflection: string[];
  personalExpression: string;
};

const ListeningShoppingView: React.FC = () => {
  const { user } = useAppContext();
  const playerRef = useRef<SegmentVideoPlayerHandle>(null);
  const analyticsStartedRef = useRef(false);
  const analyticsCompletedRef = useRef(false);
  const [initialRecord] = useState(() => loadLocalListeningRecord<ShoppingProgress>('faire-les-courses', user?.id));
  const initial = initialRecord?.progressState;
  const [step, setStep] = useState(initial?.step ?? 0);
  const [maxStep, setMaxStep] = useState(initial?.maxStep ?? 0);
  const [predictions, setPredictions] = useState<Set<string>>(new Set(initial?.predictions ?? []));
  const [gist, setGist] = useState<number | null>(initial?.gist ?? null);
  const [comprehensionAnswers, setComprehensionAnswers] = useState<Record<string, string>>(initial?.comprehensionAnswers ?? {});
  const [comprehensionSubmitted, setComprehensionSubmitted] = useState(initial?.comprehensionSubmitted ?? false);
  const [visibleQuestionHelp, setVisibleQuestionHelp] = useState<Set<string>>(new Set(initial?.visibleQuestionHelp ?? []));
  const [targetId, setTargetId] = useState<ShoppingClipId>(initial?.targetId ?? 'ingredients');
  const [completedTargets, setCompletedTargets] = useState<Set<ShoppingClipId>>(new Set(initial?.completedTargets ?? []));
  const [supportLevels, setSupportLevels] = useState<Partial<Record<ShoppingClipId, number>>>(initial?.supportLevels ?? {});
  const [sequenceSelections, setSequenceSelections] = useState<Partial<Record<ShoppingClipId, string[]>>>(initial?.sequenceSelections ?? {});
  const [choiceAnswers, setChoiceAnswers] = useState<Partial<Record<ShoppingClipId, Record<string, string>>>>(initial?.choiceAnswers ?? {});
  const [checkedTargets, setCheckedTargets] = useState<Set<ShoppingClipId>>(new Set(initial?.checkedTargets ?? []));
  const [visualHelpOpened, setVisualHelpOpened] = useState<Set<ShoppingClipId>>(new Set(initial?.visualHelpOpened ?? []));
  const [dictationId, setDictationId] = useState<ShoppingClipId>(initial?.dictationId ?? 'ingredients');
  const [inputs, setInputs] = useState<Record<string, string>>(initial?.inputs ?? {});
  const [reviewed, setReviewed] = useState<Set<ShoppingClipId>>(new Set(initial?.reviewed ?? []));
  const [shownTranslations, setShownTranslations] = useState<Set<ShoppingClipId>>(new Set(initial?.shownTranslations ?? []));
  const [reflection, setReflection] = useState<Set<string>>(new Set(initial?.reflection ?? []));
  const [personalExpression, setPersonalExpression] = useState(initial?.personalExpression ?? EXPRESSION_MODELS[0].text);
  const [completedAt, setCompletedAt] = useState<string | null>(initialRecord?.completedAt ?? null);

  useEffect(() => {
    if (!user?.id || analyticsStartedRef.current) return;
    analyticsStartedRef.current = true;
    trackLearningEvent('lesson_started', 'listening', {
      ownerUserId: user.id,
      targetId: 'faire-les-courses',
      properties: { content_version: 1 },
    });
  }, [user?.id]);

  useEffect(() => {
    if (step !== 5 || !user?.id || analyticsCompletedRef.current) return;
    analyticsCompletedRef.current = true;
    trackLearningEvent('lesson_completed', 'listening', {
      ownerUserId: user.id,
      targetId: 'faire-les-courses',
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

  const trackVideoError = (reason: 'load' | 'play', clipId: ShoppingClipId | 'full') => {
    trackLearningEvent('media_error', 'listening', {
      ownerUserId: user?.id,
      targetId: `faire-les-courses:${clipId}`,
      properties: { media: 'video', reason, step },
    });
  };

  const nextClip = (current: ShoppingClipId, done: Set<ShoppingClipId>) => {
    const index = SHOPPING_CLIPS.findIndex((clip) => clip.id === current);
    return SHOPPING_CLIPS.slice(index + 1).find((clip) => !done.has(clip.id))
      ?? SHOPPING_CLIPS.find((clip) => !done.has(clip.id));
  };

  const target = SHOPPING_CLIPS.find((clip) => clip.id === targetId)!;
  const dictation = SHOPPING_CLIPS.find((clip) => clip.id === dictationId)!;
  const supportLevel = supportLevels[targetId] ?? 0;
  const selectedSequence = sequenceSelections[targetId] ?? [];
  const sequenceComplete = selectedSequence.length === target.sequenceAnswer.length;
  const sequenceCorrect = sequenceComplete && selectedSequence.every((item, index) => item === target.sequenceAnswer[index]);
  const targetChoiceQuestions = target.choiceQuestions ?? [];
  const targetChoiceAnswers = choiceAnswers[targetId] ?? {};
  const choiceComplete = targetChoiceQuestions.length > 0
    && targetChoiceQuestions.every((question) => Boolean(targetChoiceAnswers[question.id]));
  const targetChecked = checkedTargets.has(targetId);
  const targetReady = targetChoiceQuestions.length > 0 ? choiceComplete : sequenceComplete;

  const selectSequenceStep = (item: string) => {
    setSequenceSelections((current) => {
      const selected = current[targetId] ?? [];
      if (selected.includes(item) || selected.length >= target.sequenceAnswer.length) return current;
      return { ...current, [targetId]: [...selected, item] };
    });
  };

  const finishTarget = () => {
    if (!targetReady) return;
    if (targetChoiceQuestions.length > 0 && !targetChecked) {
      setCheckedTargets((current) => new Set(current).add(targetId));
      return;
    }
    const done = new Set<ShoppingClipId>(completedTargets).add(targetId);
    setCompletedTargets(done);
    const next = nextClip(targetId, done);
    if (next) setTargetId(next.id); else go(4);
  };

  const checkDictation = () => {
    if (!reviewed.has(dictationId)) {
      if (!fieldsFor(dictationId).some((field) => inputs[field.id]?.trim())) return;
      setReviewed((current) => new Set<ShoppingClipId>(current).add(dictationId));
      return;
    }
    const done = new Set<ShoppingClipId>(reviewed).add(dictationId);
    const next = nextClip(dictationId, done);
    if (next) setDictationId(next.id); else go(5);
  };

  const summary = useMemo(() => {
    const comprehensionCorrect = SHOPPING_COMPREHENSION_QUESTIONS
      .filter((question) => comprehensionAnswers[question.id] === question.answer).length;
    let targetedCorrect = 0;
    let targetedTotal = 0;
    let dictationCorrect = 0;
    let dictationTotal = 0;
    const errors: string[] = [];
    SHOPPING_CLIPS.forEach((clip) => {
      if (clip.choiceQuestions?.length) {
        clip.choiceQuestions.forEach((question) => {
          targetedTotal += 1;
          if (choiceAnswers[clip.id]?.[question.id] === question.answer) targetedCorrect += 1;
          else errors.push(`${clip.chineseName}：${question.prompt.replace('？', '')}需要再听确认`);
        });
      } else {
        targetedTotal += 1;
        const selected = sequenceSelections[clip.id] ?? [];
        if (selected.length === clip.sequenceAnswer.length
          && selected.every((item, index) => item === clip.sequenceAnswer[index])) targetedCorrect += 1;
        else errors.push(`${clip.chineseName}：配料出现顺序需要再次确认`);
      }
    });
    SHOPPING_CLIPS.forEach((clip) => fieldsFor(clip.id).forEach((field) => {
      dictationTotal += 1;
      const value = inputs[field.id] ?? '';
      if (dictationAnswersMatch(value, field.answer)) dictationCorrect += 1;
      else if (!value.trim()) errors.push(`${field.label}：未填写（${field.answer}）`);
      else if (withoutFrenchAccents(value) === withoutFrenchAccents(field.answer)) errors.push(`${field.label}：注意重音符号（${field.answer}）`);
      else errors.push(`${field.label}：声音辨认或拼写需复习（${field.answer}）`);
    }));
    if (comprehensionCorrect < SHOPPING_COMPREHENSION_QUESTIONS.length) errors.unshift('内容核验：购物目的、商品细节或付款信息仍需确认');
    if (targetedCorrect < targetedTotal) errors.unshift('定向再听：部分商品、数字或收银信息需要再次确认');
    return { comprehensionCorrect, targetedCorrect, targetedTotal, dictationCorrect, dictationTotal, errors };
  }, [choiceAnswers, comprehensionAnswers, inputs, sequenceSelections]);

  const progressState = useMemo<ShoppingProgress>(() => ({
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
    sequenceSelections,
    choiceAnswers,
    checkedTargets: Array.from(checkedTargets),
    visualHelpOpened: Array.from(visualHelpOpened),
    dictationId,
    inputs,
    reviewed: Array.from(reviewed),
    shownTranslations: Array.from(shownTranslations),
    reflection: Array.from(reflection),
    personalExpression,
  }), [checkedTargets, choiceAnswers, completedTargets, comprehensionAnswers, comprehensionSubmitted, dictationId, gist, inputs, maxStep, personalExpression, predictions, reflection, reviewed, sequenceSelections, shownTranslations, step, supportLevels, targetId, visibleQuestionHelp, visualHelpOpened]);

  const learningArchive = useMemo(() => step !== 5 ? null : ({
    courseTitle: 'Faire les courses au supermarché',
    completedAt: completedAt ?? new Date().toISOString(),
    scores: [
      { label: '内容核验', score: summary.comprehensionCorrect, total: SHOPPING_COMPREHENSION_QUESTIONS.length },
      { label: '定向任务', score: summary.targetedCorrect, total: summary.targetedTotal },
      { label: '关键词听写', score: summary.dictationCorrect, total: summary.dictationTotal },
    ],
    errors: summary.errors,
    strategies: Array.from(reflection),
    personalExpression,
    supports: SHOPPING_CLIPS
      .filter((clip) => (supportLevels[clip.id] ?? 0) > 1)
      .map((clip) => `${clip.name}：使用到第 ${supportLevels[clip.id]} 级帮助`),
    vocabularyHelp: SHOPPING_CLIPS.filter((clip) => visualHelpOpened.has(clip.id)).map((clip) => clip.name),
  }), [completedAt, personalExpression, reflection, step, summary, supportLevels, visualHelpOpened]);

  useListeningProgress<ShoppingProgress>({
    courseId: 'faire-les-courses',
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
      setTargetId(restored.targetId ?? 'ingredients');
      setCompletedTargets(new Set(restored.completedTargets ?? []));
      setSupportLevels(restored.supportLevels ?? {});
      setSequenceSelections(restored.sequenceSelections ?? {});
      setChoiceAnswers(restored.choiceAnswers ?? {});
      setCheckedTargets(new Set(restored.checkedTargets ?? []));
      setVisualHelpOpened(new Set(restored.visualHelpOpened ?? []));
      setDictationId(restored.dictationId ?? 'ingredients');
      setInputs(restored.inputs ?? {});
      setReviewed(new Set(restored.reviewed ?? []));
      setShownTranslations(new Set(restored.shownTranslations ?? []));
      setReflection(new Set(restored.reflection ?? []));
      setPersonalExpression(restored.personalExpression ?? EXPRESSION_MODELS[0].text);
      setCompletedAt(record.completedAt);
    },
  });

  const clipTabs = (active: ShoppingClipId, setActive: (id: ShoppingClipId) => void) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SHOPPING_CLIPS.map((clip, index) => (
        <button key={clip.id} type="button" onClick={() => setActive(clip.id)} className={`min-h-14 rounded-lg border px-2.5 py-2 text-left text-xs font-black ${active === clip.id ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-500'}`}>
          <span className="block">片段 {index + 1}</span>
          <span className="mt-0.5 block font-medium text-gray-400">{clip.chineseName}</span>
        </button>
      ))}
    </div>
  );

  const renderStep = () => {
    if (step === 0) return (
      <section>
        <p className="text-sm font-bold text-primary">听前预测 · Anticipation</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">在超市购物时，需要听清哪些信息？</h2>
        <p className="mt-2 text-sm text-gray-500">先选择你认为视频中可能出现的信息类型，可以多选。具体商品和答案暂不显示。</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">{PREDICTIONS.map((item) => <button key={item} type="button" onClick={() => setPredictions((current) => { const next = new Set(current); next.has(item) ? next.delete(item) : next.add(item); return next; })} className={`min-h-12 rounded-lg border px-4 text-left text-sm font-bold ${predictions.has(item) ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{predictions.has(item) && <Check className="mr-2 inline h-4 w-4" />}{item}</button>)}</div>
        <button type="button" disabled={!predictions.size} onClick={() => go(1)} className="mt-7 min-h-12 w-full rounded-lg bg-primary px-5 font-black text-white disabled:bg-gray-200">带着预测去听</button>
      </section>
    );

    if (step === 1) return (
      <section>
        <p className="text-sm font-bold text-primary">整体初听 · Écoute globale</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">完整观看一次，不暂停、不看词汇</h2>
        <p className="mt-2 text-sm text-gray-500">先判断 Hakim 在超市里完成了哪些任务，不要求第一次就听清所有配料。</p>
        <div className="mt-5"><SegmentVideoPlayer src={SHOPPING_VIDEO} range={SHOPPING_FULL_RANGE} onPlaybackError={(reason) => trackVideoError(reason, 'full')} /></div>
        <h3 className="mt-7 font-black text-gray-800">哪一项最符合视频的主要内容？</h3>
        <div className="mt-3 space-y-2">{SHOPPING_GIST_OPTIONS.map((option, index) => <button key={option} type="button" onClick={() => setGist(index)} className={`min-h-12 w-full rounded-lg border px-4 py-3 text-left text-sm font-bold leading-5 ${gist === index ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{option}</button>)}</div>
        <button type="button" disabled={gist === null} onClick={() => go(2)} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white disabled:bg-gray-200">提交并核验</button>
      </section>
    );

    if (step === 2) return (
      <section>
        <p className="text-sm font-bold text-primary">第一次核验 · Vérification</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">用 3 个问题确认主旨与整体流程</h2>
        <p className={`mt-4 rounded-lg p-3 text-sm font-bold ${gist === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{gist === 0 ? '主旨判断正确。这里只核验整体理解，商品和数字细节留到定向再听。' : '参考答案：Hakim 为晚餐购物，也购买袜子、称重果蔬并在收银台付款。'}</p>
        <div className="mt-5"><SegmentVideoPlayer src={SHOPPING_VIDEO} range={SHOPPING_FULL_RANGE} onPlaybackError={(reason) => trackVideoError(reason, 'full')} /></div>
        <div className="mt-7 space-y-5">{SHOPPING_COMPREHENSION_QUESTIONS.map((question, questionIndex) => {
          const selected = comprehensionAnswers[question.id];
          return <section key={question.id} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
            <h3 className="text-sm font-black leading-6 text-gray-800"><span className="mr-2 text-primary">{questionIndex + 1}.</span>{question.prompt}</h3>
            <button type="button" aria-expanded={visibleQuestionHelp.has(question.id)} onClick={() => setVisibleQuestionHelp((current) => { const next = new Set(current); next.has(question.id) ? next.delete(question.id) : next.add(question.id); return next; })} className="mt-2 min-h-10 text-xs font-bold text-primary">{visibleQuestionHelp.has(question.id) ? '收起题意帮助' : '看不懂题目？查看题意帮助'}</button>
            {visibleQuestionHelp.has(question.id) && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{question.promptHelp}</p>}
            <div className="mt-3 grid gap-2 sm:grid-cols-3">{question.options.map((option) => {
              const isSelected = selected === option.value;
              const isCorrect = comprehensionSubmitted && option.value === question.answer;
              const isWrong = comprehensionSubmitted && isSelected && option.value !== question.answer;
              const isActive = isSelected || isCorrect || isWrong;
              return <button key={option.value} type="button" disabled={comprehensionSubmitted} onClick={() => setComprehensionAnswers((current) => ({ ...current, [question.id]: option.value }))} className={`min-h-24 rounded-lg border px-3 py-3 text-center text-sm font-black leading-5 ${isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : isWrong ? 'border-red-300 bg-red-50 text-red-600' : isSelected ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-700'}`}>
                {optionIcons(option.icons, isActive)}
                <span className="block">{option.label}</span>
                {comprehensionSubmitted && option.detail && <span className={`mt-1 block text-[11px] font-medium ${isCorrect ? 'text-emerald-600' : 'text-gray-400'}`}>{option.detail}</span>}
                {isCorrect && <Check className="mx-auto mt-2 h-4 w-4" />}{isWrong && <X className="mx-auto mt-2 h-4 w-4" />}
              </button>;
            })}</div>
            {comprehensionSubmitted && <p className={`mt-3 text-xs font-bold ${selected === question.answer ? 'text-emerald-600' : 'text-gray-500'}`}>{selected === question.answer ? `正确 · ${question.focus}` : `再听提示 · ${question.focus}`}</p>}
          </section>;
        })}</div>
        <button type="button" disabled={!comprehensionSubmitted && !SHOPPING_COMPREHENSION_QUESTIONS.every((question) => Boolean(comprehensionAnswers[question.id]))} onClick={() => comprehensionSubmitted ? go(3) : setComprehensionSubmitted(true)} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white disabled:bg-gray-200">{comprehensionSubmitted ? '进入定向再听' : '提交并查看答案'}</button>
      </section>
    );

    if (step === 3) return (
      <section>
        <p className="text-sm font-bold text-primary">定向再听 · Écoute ciblée</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">{target.name}</h2>
        <p className="mt-2 text-sm text-gray-500">{target.prompt}</p>
        <div className="mt-5">{clipTabs(targetId, setTargetId)}</div>
        <div className="mt-5"><SegmentVideoPlayer ref={playerRef} src={SHOPPING_VIDEO} range={target.range} onPlaybackError={(reason) => trackVideoError(reason, target.id)} /></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-5">{[['1', '原速再听'], ['2', '显示关键词'], ['3', '缺词字幕'], ['4', '完整字幕'], ['5', '中文翻译']].map(([level, label]) => <button key={level} type="button" onClick={() => { const value = Number(level); if (value === 1) playerRef.current?.replay(); else setSupportLevels((current) => ({ ...current, [targetId]: Math.max(current[targetId] ?? 0, value) })); }} className={`min-h-11 rounded-lg border px-2 text-xs font-black ${supportLevel >= Number(level) && Number(level) > 1 ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{level}. {label}</button>)}</div>
        {supportLevel >= 2 && <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm leading-7 text-gray-700">{supportLevel === 2 && <><strong className="text-primary">关键词：</strong>{target.keywords.join(' · ')}</>}{supportLevel === 3 && target.gapTranscript}{supportLevel === 4 && target.transcript}{supportLevel >= 5 && <><p>{target.transcript}</p><p className="mt-2 text-gray-500">{target.translation}</p></>}</div>}
        {target.visuals && <section className="mt-5 border-t border-gray-100 pt-5">
          <button type="button" aria-expanded={visualHelpOpened.has(target.id)} onClick={() => setVisualHelpOpened((current) => { const next = new Set(current); next.has(target.id) ? next.delete(target.id) : next.add(target.id); return next; })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-800"><Images className="h-4 w-4" />{visualHelpOpened.has(target.id) ? '收起图像词汇救援' : '需要帮助？查看图像词汇'}</button>
          {visualHelpOpened.has(target.id) && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{target.visuals.map((visual) => <figure key={visual.src} className="overflow-hidden rounded-lg border border-gray-200 bg-white"><div className="aspect-square bg-gray-50"><img src={visual.src} alt={visual.alt} className="h-full w-full object-cover" /></div><figcaption className="px-2 py-2 text-center text-xs font-bold text-gray-700">{visual.caption}</figcaption></figure>)}</div>}
        </section>}
        {targetChoiceQuestions.length > 0 ? <div className="mt-6 border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-black text-gray-800"><Headphones className="h-4 w-4 text-primary" />听音选择关键信息</h3><p className="mt-1 text-xs leading-5 text-gray-400">先听声音，再用图标、数字和极短法语完成匹配；中文只在需要时打开。</p></div>{targetChecked && <button type="button" onClick={() => { setCheckedTargets((current) => { const next = new Set(current); next.delete(targetId); return next; }); setChoiceAnswers((current) => ({ ...current, [targetId]: {} })); }} className="inline-flex min-h-10 flex-shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-500"><RotateCcw className="h-3.5 w-3.5" />重做</button>}</div>
          <div className="mt-5 space-y-5">{targetChoiceQuestions.map((question, questionIndex) => {
            const selected = targetChoiceAnswers[question.id];
            const helpKey = `target:${question.id}`;
            return <section key={question.id} className="rounded-lg bg-gray-50 p-4">
              <h4 className="text-sm font-black text-gray-800"><span className="mr-2 text-primary">{questionIndex + 1}.</span>{question.prompt}</h4>
              <button type="button" aria-expanded={visibleQuestionHelp.has(helpKey)} onClick={() => setVisibleQuestionHelp((current) => { const next = new Set(current); next.has(helpKey) ? next.delete(helpKey) : next.add(helpKey); return next; })} className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-bold text-primary"><CircleHelp className="h-3.5 w-3.5" />{visibleQuestionHelp.has(helpKey) ? '收起题意帮助' : '看不懂题目？'}</button>
              {visibleQuestionHelp.has(helpKey) && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{question.promptHelp}</p>}
              <div className="mt-3 grid grid-cols-3 gap-2">{question.options.map((option) => {
                const isSelected = selected === option.value;
                const isCorrect = targetChecked && option.value === question.answer;
                const isWrong = targetChecked && isSelected && option.value !== question.answer;
                const isActive = isSelected || isCorrect || isWrong;
                const icons = option.icons ?? (option.icon ? [option.icon] : undefined);
                return <button key={option.value} type="button" disabled={targetChecked} onClick={() => setChoiceAnswers((current) => ({ ...current, [targetId]: { ...(current[targetId] ?? {}), [question.id]: option.value } }))} className={`min-h-24 rounded-lg border px-2 py-3 text-center text-sm font-black leading-5 ${isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : isWrong ? 'border-red-300 bg-red-50 text-red-600' : isSelected ? 'border-primary bg-white text-primary' : 'border-gray-200 bg-white text-gray-700'}`}>
                  {optionIcons(icons, isActive)}
                  <span className="block break-words">{option.label}</span>
                  {targetChecked && option.value === question.answer && option.detail && <span className="mt-1 block text-[11px] font-medium text-emerald-600">{option.detail}</span>}
                  {isCorrect && <Check className="mx-auto mt-2 h-4 w-4" />}{isWrong && <X className="mx-auto mt-2 h-4 w-4" />}
                </button>;
              })}</div>
              {targetChecked && <p className={`mt-3 text-xs font-bold ${selected === question.answer ? 'text-emerald-600' : 'text-gray-500'}`}>{selected === question.answer ? '听辨正确' : '请再听一次'} · {question.focus}</p>}
            </section>;
          })}</div>
        </div> : <div className="mt-6 border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-black text-gray-800"><ListChecks className="h-4 w-4 text-primary" />按听到的顺序排列配料</h3><p className="mt-1 text-xs text-gray-400">这一段配有图像词汇帮助；点击配料，重建听到的清单。</p></div><button type="button" onClick={() => setSequenceSelections((current) => ({ ...current, [targetId]: [] }))} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-500"><RotateCcw className="h-3.5 w-3.5" />重置</button></div>
          <div className="mt-4 flex min-h-14 flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3">{selectedSequence.length ? selectedSequence.map((item, index) => <span key={item} className="rounded-md bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm"><span className="mr-1 text-primary">{index + 1}.</span>{item}</span>) : <span className="text-sm text-gray-400">尚未开始排序</span>}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{target.sequenceChoices.map((item) => <button key={item} type="button" disabled={selectedSequence.includes(item)} onClick={() => selectSequenceStep(item)} className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 text-left text-sm font-bold text-gray-600 disabled:bg-gray-100 disabled:text-gray-300">{item}</button>)}</div>
          {sequenceComplete && <p className={`mt-3 rounded-lg p-3 text-sm font-bold ${sequenceCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{sequenceCorrect ? '配料顺序正确。' : `顺序需要调整。参考：${target.sequenceAnswer.join(' → ')}`}</p>}
        </div>}
        <VocabularyRescue speaker={target} onReplay={() => playerRef.current?.replay()} onOpen={() => {}} courseName="Faire les courses au supermarché" themes={['听力课', '超市购物']} />
        <button type="button" disabled={!targetReady} onClick={finishTarget} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white disabled:bg-gray-200">{targetChoiceQuestions.length > 0 && !targetChecked ? '核对本段' : nextClip(targetId, new Set<ShoppingClipId>(completedTargets).add(targetId)) ? `听下一段：${nextClip(targetId, new Set<ShoppingClipId>(completedTargets).add(targetId))!.chineseName}` : '完成定向再听'}</button>
      </section>
    );

    if (step === 4) {
      const isReviewed = reviewed.has(dictationId);
      return <section>
        <p className="text-sm font-bold text-primary">关键词听写 · Dictée ciblée</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">听写“{dictation.chineseName}”中的关键词</h2>
        <p className="mt-2 text-sm text-gray-500">保留完整法语语境，只填写有学习价值的空缺词；中文翻译按需查看。</p>
        <div className="mt-5">{clipTabs(dictationId, setDictationId)}</div>
        <div className="mt-5"><SegmentVideoPlayer src={SHOPPING_VIDEO} range={dictation.range} onPlaybackError={(reason) => trackVideoError(reason, dictation.id)} /></div>
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-base leading-[3.2] text-gray-700">{dictation.dictationTemplate.map((part, index) => {
          if (typeof part === 'string') return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
          const blankNumber = dictation.dictationTemplate.slice(0, index).filter((item) => typeof item !== 'string').length + 1;
          const isCorrect = dictationAnswersMatch(inputs[part.id] ?? '', part.answer);
          return <span key={part.id} className="inline-block"><input value={inputs[part.id] ?? ''} disabled={isReviewed} onChange={(event) => setInputs((current) => ({ ...current, [part.id]: event.target.value }))} placeholder={`第${blankNumber}空`} aria-label={`${dictation.name}第${blankNumber}空`} className={`mx-1 h-10 w-32 rounded-md border px-2 text-center text-sm font-bold ${isReviewed ? isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-600' : 'border-gray-300'}`} />{isReviewed && !isCorrect && <span className="mr-2 text-xs font-bold text-emerald-600">{part.answer}</span>}</span>;
        })}</div>
        {!isReviewed && <button type="button" aria-expanded={shownTranslations.has(dictationId)} onClick={() => setShownTranslations((current) => { const next = new Set(current); next.has(dictationId) ? next.delete(dictationId) : next.add(dictationId); return next; })} className="mt-3 min-h-11 text-sm font-bold text-primary">{shownTranslations.has(dictationId) ? '收起中文翻译' : '需要帮助？显示中文翻译'}</button>}
        {!isReviewed && shownTranslations.has(dictationId) && <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">{dictation.translation}</p>}
        {isReviewed && <div className="mt-4 rounded-lg bg-indigo-50 p-4 text-sm leading-7 text-gray-700"><p className="text-xs font-black text-primary">完整答案</p><p className="mt-1">{dictation.transcript}</p><p className="mt-3 border-t border-indigo-100 pt-3 text-gray-500">{dictation.translation}</p></div>}
        <button type="button" onClick={checkDictation} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white">{!isReviewed ? `核对 ${dictation.chineseName}` : nextClip(dictationId, new Set<ShoppingClipId>(reviewed).add(dictationId)) ? `听写下一段：${nextClip(dictationId, new Set<ShoppingClipId>(reviewed).add(dictationId))!.chineseName}` : '查看学习反思'}</button>
      </section>;
    }

    return <section>
      <p className="text-sm font-bold text-primary">学习反思 · Réflexion</p>
      <h2 className="mt-2 text-2xl font-black text-gray-800">这次你听懂了什么？</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="border-l-4 border-primary bg-gray-50 p-4"><span className="text-xs text-gray-400">内容核验</span><strong className="mt-1 block text-xl">{summary.comprehensionCorrect} / {SHOPPING_COMPREHENSION_QUESTIONS.length}</strong></div><div className="border-l-4 border-emerald-400 bg-gray-50 p-4"><span className="text-xs text-gray-400">定向任务</span><strong className="mt-1 block text-xl">{summary.targetedCorrect} / {summary.targetedTotal}</strong></div><div className="border-l-4 border-amber-400 bg-gray-50 p-4"><span className="text-xs text-gray-400">关键词听写</span><strong className="mt-1 block text-xl">{summary.dictationCorrect} / {summary.dictationTotal}</strong></div></div>
      <div className="mt-5 rounded-lg border border-gray-200 p-4"><h3 className="font-black text-gray-800">错误归纳</h3><div className="mt-3 space-y-2">{(summary.errors.length ? summary.errors : ['内容核验、定向任务和关键词听写全部正确。']).map((error) => <p key={error} className="text-sm text-gray-600">{error}</p>)}</div></div>
      <div className="mt-5"><h3 className="font-black text-gray-800">本次有效的策略</h3><div className="mt-3 grid gap-2">{REFLECTION_OPTIONS.map((item) => <button key={item} type="button" onClick={() => setReflection((current) => { const next = new Set(current); next.has(item) ? next.delete(item) : next.add(item); return next; })} className={`min-h-11 rounded-lg border px-3 text-left text-sm font-bold ${reflection.has(item) ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{reflection.has(item) && <Check className="mr-2 inline h-4 w-4" />}{item}</button>)}</div></div>
      <div className="mt-7 border-t border-gray-100 pt-6">
        <p className="text-xs font-bold text-primary">把听懂的内容变成自己的表达</p>
        <h3 className="mt-2 text-lg font-black text-gray-800">设计一次自己的超市购物</h3>
        <p className="mt-2 text-sm text-gray-500">写 3–5 句：说明为什么购物、需要什么、询问一个商品，并说明付款方式。可以点击参考表达后替换信息。</p>
        <div className="mt-4 border-l-4 border-primary bg-indigo-50 px-4 py-3 text-sm leading-6 text-gray-700"><p><strong className="text-primary">至少包含：</strong>购物目的 + 两种商品 + 一个询问句 + 付款方式。</p></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{EXPRESSION_MODELS.map((model) => <button key={model.label} type="button" onClick={() => setPersonalExpression(model.text)} className={`min-h-16 rounded-lg border px-3 py-3 text-left ${personalExpression === model.text ? 'border-primary bg-indigo-50' : 'border-gray-200 bg-white'}`}><span className="block text-xs font-black text-primary">{model.label}</span><span className="mt-1 block text-sm font-bold leading-6 text-gray-700">{model.text}</span></button>)}</div>
        <label htmlFor="shopping-personal-expression" className="mt-5 block text-sm font-black text-gray-800">请写下你的购物表达</label>
        <textarea id="shopping-personal-expression" value={personalExpression} onChange={(event) => setPersonalExpression(event.target.value)} placeholder="例如：J'invite des amis ce soir. J'ai besoin de fromage et d'oignons..." rows={5} className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm font-bold leading-6 text-gray-700 outline-none focus:border-primary focus:ring-2 focus:ring-indigo-100" />
      </div>
      <p className="mt-6 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-700">学习档案已自动保存，可在课程列表中随时回顾；登录后教师端也可查看档案摘要。</p>
      <Link to="/listening" className="mt-6 flex min-h-12 items-center justify-center rounded-lg bg-primary font-black text-white">返回课程列表</Link>
    </section>;
  };

  return <div className="py-6 md:py-10">
    <Link to="/listening" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500"><ArrowLeft className="h-4 w-4" />真实素材听力</Link>
    <header className="mt-5 border-b border-gray-100 pb-5"><div className="flex items-center gap-2 text-primary"><Headphones className="h-5 w-5" /><span className="text-sm font-black">课程 04 · 真实情境</span></div><h1 className="mt-2 text-3xl font-black text-gray-800">Faire les courses au supermarché</h1><p className="mt-2 text-sm text-gray-500">超市购物：听懂商品、尺码、价格和付款方式</p></header>
    <nav className="mt-5 grid grid-cols-6 gap-1.5 rounded-lg border border-gray-100 bg-white p-2" aria-label="课程步骤">{STEPS.map((label, index) => <button key={label} type="button" disabled={index > maxStep} onClick={() => go(index)} className={`min-w-0 py-2 text-center text-[10px] font-black sm:text-xs ${index <= step ? 'text-primary' : 'text-gray-400'}`}><span className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full ${index <= step ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>{index < step ? <Check className="h-3 w-3" /> : index + 1}</span><span className="block truncate">{label}</span></button>)}</nav>
    <main className="mx-auto mt-6 max-w-3xl rounded-lg border border-gray-100 bg-white p-5 shadow-sm sm:p-7">{renderStep()}</main>
    <aside className="mx-auto mt-4 flex max-w-3xl items-start gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" /><p>{step === 0 && '先预测信息类型，不提前展示 tartiflette 和配料答案。'}{step === 1 && '完整原速听一遍，先确认购物任务，不急着记住全部词。'}{step === 2 && '只用三道法语题确认主旨和整体流程；具体商品与数字稍后分段细听。'}{step === 3 && '四个片段分别处理配料、尺码、价格和收银信息，按需使用五级帮助。'}{step === 4 && '将商品、尺码与付款词组的声音连接到拼写，翻译仍由学习者主动打开。'}{step === 5 && '借用视频中的购物句型，设计一段真实可用的超市表达。'}</p></aside>
  </div>;
};

export default ListeningShoppingView;
