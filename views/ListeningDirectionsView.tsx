import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Headphones, Lightbulb, MapPin, RotateCcw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import SegmentVideoPlayer, { SegmentVideoPlayerHandle } from '../components/SegmentVideoPlayer';
import VocabularyRescue from '../components/VocabularyRescue';
import { useAppContext } from '../App';
import { trackLearningEvent } from '../services/learningAnalyticsService';
import { useListeningProgress } from '../hooks/useListeningProgress';
import { loadLocalListeningRecord } from '../services/listeningProgressService';
import {
  DIRECTION_CLIPS,
  DIRECTIONS_COMPREHENSION_QUESTIONS,
  DIRECTIONS_GIST_OPTIONS,
  DirectionClipId,
  DirectionDictationField,
} from '../data/listeningDirectionsLesson';

const STEPS = ['预测', '初听', '核验', '定向再听', '关键词听写', '反思'];
const PREDICTIONS = ['要找的地点', '前进方向', '路口顺序', '沿途地标', '距离信息', '商品价格', '营业时间'];
const EXPRESSION_MODELS = [
  {
    label: '完整问路与指路',
    text: 'Excusez-moi, est-ce que vous pourriez me dire où se trouve la gare, s’il vous plaît ? Vous allez tout droit, puis vous prenez la deuxième à droite et la première à gauche.',
  },
  {
    label: '礼貌询问地点',
    text: 'Excusez-moi, est-ce que vous pourriez me dire où se trouve la gare, s’il vous plaît ?',
  },
  {
    label: '说明寻找目标',
    text: 'Excusez-moi, je cherche la Banque de Paris.',
  },
  {
    label: '路口顺序',
    text: 'Vous allez tout droit, puis vous prenez la deuxième à droite et la première à gauche.',
  },
  {
    label: '利用地标指路',
    text: 'Vous passez devant une boulangerie, puis vous tournez à gauche. C’est juste à côté du cinéma.',
  },
];

const normalize = (value: string) => value.trim().toLocaleLowerCase('fr-FR').normalize('NFC');
const noAccents = (value: string) => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const fieldsFor = (clipId: DirectionClipId) => DIRECTION_CLIPS
  .find((clip) => clip.id === clipId)!
  .dictationTemplate
  .filter((part): part is DirectionDictationField => typeof part !== 'string');

type DirectionsProgress = {
  step: number;
  maxStep: number;
  predictions: string[];
  gist: number | null;
  verificationClipId: DirectionClipId;
  comprehensionAnswers: Record<string, string>;
  comprehensionSubmitted: boolean;
  visibleQuestionHelp: string[];
  targetId: DirectionClipId;
  completedTargets: DirectionClipId[];
  supportLevels: Partial<Record<DirectionClipId, number>>;
  routeSelections: Partial<Record<DirectionClipId, string[]>>;
  dictationId: DirectionClipId;
  inputs: Record<string, string>;
  reviewed: DirectionClipId[];
  shownTranslations: DirectionClipId[];
  reflection: string[];
  personalExpression: string;
};

const ListeningDirectionsView: React.FC = () => {
  const { user } = useAppContext();
  const playerRef = useRef<SegmentVideoPlayerHandle>(null);
  const analyticsStartedRef = useRef(false);
  const analyticsCompletedRef = useRef(false);
  const [initialRecord] = useState(() => loadLocalListeningRecord<DirectionsProgress>('demander-son-chemin', user?.id));
  const initial = initialRecord?.progressState;
  const [step, setStep] = useState(initial?.step ?? 0);
  const [maxStep, setMaxStep] = useState(initial?.maxStep ?? 0);
  const [predictions, setPredictions] = useState<Set<string>>(new Set(initial?.predictions ?? []));
  const [gist, setGist] = useState<number | null>(initial?.gist ?? null);
  const [verificationClipId, setVerificationClipId] = useState<DirectionClipId>(initial?.verificationClipId ?? 'gare');
  const [comprehensionAnswers, setComprehensionAnswers] = useState<Record<string, string>>(initial?.comprehensionAnswers ?? {});
  const [comprehensionSubmitted, setComprehensionSubmitted] = useState(initial?.comprehensionSubmitted ?? false);
  const [visibleQuestionHelp, setVisibleQuestionHelp] = useState<Set<string>>(new Set(initial?.visibleQuestionHelp ?? []));
  const [targetId, setTargetId] = useState<DirectionClipId>(initial?.targetId ?? 'gare');
  const [completedTargets, setCompletedTargets] = useState<Set<DirectionClipId>>(new Set(initial?.completedTargets ?? []));
  const [supportLevels, setSupportLevels] = useState<Partial<Record<DirectionClipId, number>>>(initial?.supportLevels ?? {});
  const [routeSelections, setRouteSelections] = useState<Partial<Record<DirectionClipId, string[]>>>(initial?.routeSelections ?? {});
  const [dictationId, setDictationId] = useState<DirectionClipId>(initial?.dictationId ?? 'gare');
  const [inputs, setInputs] = useState<Record<string, string>>(initial?.inputs ?? {});
  const [reviewed, setReviewed] = useState<Set<DirectionClipId>>(new Set(initial?.reviewed ?? []));
  const [shownTranslations, setShownTranslations] = useState<Set<DirectionClipId>>(new Set(initial?.shownTranslations ?? []));
  const [reflection, setReflection] = useState<Set<string>>(new Set(initial?.reflection ?? []));
  const [personalExpression, setPersonalExpression] = useState(initial?.personalExpression ?? EXPRESSION_MODELS[0].text);
  const [completedAt, setCompletedAt] = useState<string | null>(initialRecord?.completedAt ?? null);

  useEffect(() => {
    if (!user?.id || analyticsStartedRef.current) return;
    analyticsStartedRef.current = true;
    trackLearningEvent('lesson_started', 'listening', {
      ownerUserId: user.id,
      targetId: 'demander-son-chemin',
      properties: { content_version: 1 },
    });
  }, [user?.id]);

  useEffect(() => {
    if (step !== 5 || !user?.id || analyticsCompletedRef.current) return;
    analyticsCompletedRef.current = true;
    trackLearningEvent('lesson_completed', 'listening', {
      ownerUserId: user.id,
      targetId: 'demander-son-chemin',
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

  const trackVideoError = (reason: 'load' | 'play', clipId: DirectionClipId) => {
    trackLearningEvent('media_error', 'listening', {
      ownerUserId: user?.id,
      targetId: `demander-son-chemin:${clipId}`,
      properties: { media: 'video', reason, step },
    });
  };

  const nextClip = (current: DirectionClipId, done: Set<DirectionClipId>) => {
    const index = DIRECTION_CLIPS.findIndex((clip) => clip.id === current);
    return DIRECTION_CLIPS.slice(index + 1).find((clip) => !done.has(clip.id))
      ?? DIRECTION_CLIPS.find((clip) => !done.has(clip.id));
  };

  const target = DIRECTION_CLIPS.find((clip) => clip.id === targetId)!;
  const dictation = DIRECTION_CLIPS.find((clip) => clip.id === dictationId)!;
  const verificationClip = DIRECTION_CLIPS.find((clip) => clip.id === verificationClipId)!;
  const supportLevel = supportLevels[targetId] ?? 0;
  const selectedRoute = routeSelections[targetId] ?? [];
  const routeComplete = selectedRoute.length === target.routeAnswer.length;
  const routeCorrect = routeComplete && selectedRoute.every((item, index) => item === target.routeAnswer[index]);

  const selectRouteStep = (item: string) => {
    setRouteSelections((current) => {
      const selected = current[targetId] ?? [];
      if (selected.includes(item) || selected.length >= target.routeAnswer.length) return current;
      return { ...current, [targetId]: [...selected, item] };
    });
  };

  const finishTarget = () => {
    if (!routeComplete) return;
    const done = new Set<DirectionClipId>(completedTargets).add(targetId);
    setCompletedTargets(done);
    const next = nextClip(targetId, done);
    if (next) setTargetId(next.id); else go(4);
  };

  const checkDictation = () => {
    if (!reviewed.has(dictationId)) {
      if (!fieldsFor(dictationId).some((field) => inputs[field.id]?.trim())) return;
      setReviewed((current) => new Set<DirectionClipId>(current).add(dictationId));
      return;
    }
    const done = new Set<DirectionClipId>(reviewed).add(dictationId);
    const next = nextClip(dictationId, done);
    if (next) setDictationId(next.id); else go(5);
  };

  const summary = useMemo(() => {
    const comprehensionCorrect = DIRECTIONS_COMPREHENSION_QUESTIONS
      .filter((question) => comprehensionAnswers[question.id] === question.answer).length;
    const routeCorrectCount = DIRECTION_CLIPS.filter((clip) => {
      const selected = routeSelections[clip.id] ?? [];
      return selected.length === clip.routeAnswer.length
        && selected.every((item, index) => item === clip.routeAnswer[index]);
    }).length;
    let dictationCorrect = 0;
    let dictationTotal = 0;
    const errors: string[] = [];
    DIRECTION_CLIPS.forEach((clip) => fieldsFor(clip.id).forEach((field) => {
      dictationTotal += 1;
      const value = inputs[field.id] ?? '';
      if (normalize(value) === normalize(field.answer)) dictationCorrect += 1;
      else if (!value.trim()) errors.push(`${field.label}：未填写（${field.answer}）`);
      else if (noAccents(value) === noAccents(field.answer)) errors.push(`${field.label}：注意重音符号（${field.answer}）`);
      else errors.push(`${field.label}：声音辨认或拼写需复习（${field.answer}）`);
    }));
    if (comprehensionCorrect < DIRECTIONS_COMPREHENSION_QUESTIONS.length) {
      errors.unshift('内容核验：部分目的地、方向或地标信息需要再次确认');
    }
    if (routeCorrectCount < DIRECTION_CLIPS.length) {
      errors.unshift('路线重建：注意方向词、序数词与先后顺序');
    }
    return { comprehensionCorrect, routeCorrectCount, dictationCorrect, dictationTotal, errors };
  }, [comprehensionAnswers, inputs, routeSelections]);

  const progressState = useMemo<DirectionsProgress>(() => ({
    step,
    maxStep,
    predictions: Array.from(predictions),
    gist,
    verificationClipId,
    comprehensionAnswers,
    comprehensionSubmitted,
    visibleQuestionHelp: Array.from(visibleQuestionHelp),
    targetId,
    completedTargets: Array.from(completedTargets),
    supportLevels,
    routeSelections,
    dictationId,
    inputs,
    reviewed: Array.from(reviewed),
    shownTranslations: Array.from(shownTranslations),
    reflection: Array.from(reflection),
    personalExpression,
  }), [completedTargets, comprehensionAnswers, comprehensionSubmitted, dictationId, gist, inputs, maxStep, personalExpression, predictions, reflection, reviewed, routeSelections, shownTranslations, step, supportLevels, targetId, verificationClipId, visibleQuestionHelp]);

  const learningArchive = useMemo(() => step !== 5 ? null : ({
    courseTitle: 'Demander son chemin',
    completedAt: completedAt ?? new Date().toISOString(),
    scores: [
      { label: '内容核验', score: summary.comprehensionCorrect, total: DIRECTIONS_COMPREHENSION_QUESTIONS.length },
      { label: '路线重建', score: summary.routeCorrectCount, total: DIRECTION_CLIPS.length },
      { label: '关键词听写', score: summary.dictationCorrect, total: summary.dictationTotal },
    ],
    errors: summary.errors,
    strategies: Array.from(reflection),
    personalExpression,
  }), [completedAt, personalExpression, reflection, step, summary]);

  useListeningProgress<DirectionsProgress>({
    courseId: 'demander-son-chemin',
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
      setVerificationClipId(restored.verificationClipId ?? 'gare');
      setComprehensionAnswers(restored.comprehensionAnswers ?? {});
      setComprehensionSubmitted(restored.comprehensionSubmitted ?? false);
      setVisibleQuestionHelp(new Set(restored.visibleQuestionHelp ?? []));
      setTargetId(restored.targetId ?? 'gare');
      setCompletedTargets(new Set(restored.completedTargets ?? []));
      setSupportLevels(restored.supportLevels ?? {});
      setRouteSelections(restored.routeSelections ?? {});
      setDictationId(restored.dictationId ?? 'gare');
      setInputs(restored.inputs ?? {});
      setReviewed(new Set(restored.reviewed ?? []));
      setShownTranslations(new Set(restored.shownTranslations ?? []));
      setReflection(new Set(restored.reflection ?? []));
      setPersonalExpression(restored.personalExpression ?? EXPRESSION_MODELS[0].text);
      setCompletedAt(record.completedAt);
    },
  });

  const neutralRange = (clipId: DirectionClipId) => {
    const clipIndex = DIRECTION_CLIPS.findIndex((clip) => clip.id === clipId);
    const clip = DIRECTION_CLIPS[clipIndex];
    return { ...clip.range, label: `情境 ${clipIndex + 1} · 完整片段` };
  };

  const clipTabs = (
    active: DirectionClipId,
    setActive: (id: DirectionClipId) => void,
    revealDestinations = true,
  ) => (
    <div className="grid grid-cols-2 gap-2">
      {DIRECTION_CLIPS.map((clip, index) => (
        <button key={clip.id} type="button" onClick={() => setActive(clip.id)} className={`min-h-12 rounded-lg border px-3 text-left text-xs font-black ${active === clip.id ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-500'}`}>
          <span className="block">{revealDestinations ? `视频 ${index + 1} · ${clip.name}` : `情境 ${index + 1}`}</span>
          <span className="mt-0.5 block font-medium text-gray-400">{revealDestinations ? clip.chineseName : '街头问路'}</span>
        </button>
      ))}
    </div>
  );

  const renderStep = () => {
    if (step === 0) return (
      <section>
        <p className="text-sm font-bold text-primary">听前预测 · Anticipation</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">问路时需要听清哪些信息？</h2>
        <p className="mt-2 text-sm text-gray-500">根据两个视频的场景选择可能出现的信息，可以多选。</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {PREDICTIONS.map((item) => <button key={item} type="button" onClick={() => setPredictions((current) => { const next = new Set(current); next.has(item) ? next.delete(item) : next.add(item); return next; })} className={`min-h-12 rounded-lg border px-4 text-left text-sm font-bold ${predictions.has(item) ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{predictions.has(item) && <Check className="mr-2 inline h-4 w-4" />}{item}</button>)}
        </div>
        <button type="button" disabled={!predictions.size} onClick={() => go(1)} className="mt-7 min-h-12 w-full rounded-lg bg-primary px-5 font-black text-white disabled:bg-gray-200">带着预测去听</button>
      </section>
    );

    if (step === 1) return (
      <section>
        <p className="text-sm font-bold text-primary">整体初听 · Écoute globale</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">连续听完两个问路场景</h2>
        <p className="mt-2 text-sm text-gray-500">先判断人物在完成什么交际任务，不急着记住每一个路口。</p>
        <div className="mt-5 space-y-7">
          {DIRECTION_CLIPS.map((clip, index) => <section key={clip.id} className="border-b border-gray-100 pb-7 last:border-0 last:pb-0">
            <div className="mb-3"><h3 className="font-black text-gray-800">情境 {index + 1}</h3><p className="mt-1 text-xs text-gray-400">街头问路 · 完整原速视频</p></div>
            <SegmentVideoPlayer src={clip.video} range={neutralRange(clip.id)} onPlaybackError={(reason) => trackVideoError(reason, clip.id)} />
          </section>)}
        </div>
        <h3 className="mt-7 font-black text-gray-800">两段视频的共同任务是什么？</h3>
        <div className="mt-3 space-y-2">{DIRECTIONS_GIST_OPTIONS.map((option, index) => <button key={option} type="button" onClick={() => setGist(index)} className={`min-h-12 w-full rounded-lg border px-4 text-left text-sm font-bold ${gist === index ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{option}</button>)}</div>
        <button type="button" disabled={gist === null} onClick={() => go(2)} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white disabled:bg-gray-200">提交并核验</button>
      </section>
    );

    if (step === 2) return (
      <section>
        <p className="text-sm font-bold text-primary">第一次核验 · Vérification</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">抓住目的地、方向与地标</h2>
        <p className={`mt-4 rounded-lg p-3 text-sm font-bold ${gist === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{gist === 0 ? '主旨判断正确。两段视频都在完成“询问并说明路线”的任务。' : '参考答案：两位路人分别询问火车站和巴黎银行的位置，并听取路线指引。'}</p>
        <div className="mt-5">{clipTabs(verificationClipId, setVerificationClipId, comprehensionSubmitted)}</div>
        <div className="mt-4"><SegmentVideoPlayer src={verificationClip.video} range={comprehensionSubmitted ? verificationClip.range : neutralRange(verificationClip.id)} onPlaybackError={(reason) => trackVideoError(reason, verificationClip.id)} /></div>
        <div className="mt-7 space-y-5">{DIRECTIONS_COMPREHENSION_QUESTIONS.map((question, questionIndex) => {
          const selected = comprehensionAnswers[question.id];
          const clip = DIRECTION_CLIPS.find((item) => item.id === question.clipId)!;
          return <section key={question.id} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
            <p className="text-xs font-black text-primary">{comprehensionSubmitted ? clip.name : `情境 ${DIRECTION_CLIPS.findIndex((item) => item.id === question.clipId) + 1}`}</p>
            <h3 className="mt-1 text-sm font-black leading-6 text-gray-800"><span className="mr-2 text-primary">{questionIndex + 1}.</span>{question.prompt}</h3>
            <button type="button" aria-expanded={visibleQuestionHelp.has(question.id)} onClick={() => setVisibleQuestionHelp((current) => { const next = new Set(current); next.has(question.id) ? next.delete(question.id) : next.add(question.id); return next; })} className="mt-2 min-h-10 text-xs font-bold text-primary">{visibleQuestionHelp.has(question.id) ? '收起题意帮助' : '看不懂题目？查看题意帮助'}</button>
            {visibleQuestionHelp.has(question.id) && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{question.promptHelp}</p>}
            <div className="mt-3 grid gap-2">{question.options.map((option) => {
              const isSelected = selected === option;
              const isCorrect = comprehensionSubmitted && option === question.answer;
              const isWrong = comprehensionSubmitted && isSelected && option !== question.answer;
              return <button key={option} type="button" disabled={comprehensionSubmitted} onClick={() => setComprehensionAnswers((current) => ({ ...current, [question.id]: option }))} className={`min-h-12 rounded-lg border px-4 py-3 text-left text-sm font-bold leading-5 ${isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : isWrong ? 'border-red-300 bg-red-50 text-red-600' : isSelected ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{isCorrect && <Check className="mr-2 inline h-4 w-4" />}{isWrong && <X className="mr-2 inline h-4 w-4" />}{option}</button>;
            })}</div>
            {comprehensionSubmitted && <p className={`mt-3 text-xs font-bold ${selected === question.answer ? 'text-emerald-600' : 'text-gray-500'}`}>{selected === question.answer ? `正确 · ${question.focus}` : `再听提示 · ${question.focus}`}</p>}
          </section>;
        })}</div>
        <button type="button" disabled={!comprehensionSubmitted && Object.keys(comprehensionAnswers).length < DIRECTIONS_COMPREHENSION_QUESTIONS.length} onClick={() => comprehensionSubmitted ? go(3) : setComprehensionSubmitted(true)} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white disabled:bg-gray-200">{comprehensionSubmitted ? '进入定向再听' : '提交并查看答案'}</button>
      </section>
    );

    if (step === 3) return (
      <section>
        <p className="text-sm font-bold text-primary">定向再听 · Écoute ciblée</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">{target.name} · 重建路线</h2>
        <p className="mt-2 text-sm text-gray-500">{target.prompt}</p>
        <div className="mt-5">{clipTabs(targetId, setTargetId)}</div>
        <div className="mt-5"><SegmentVideoPlayer ref={playerRef} src={target.video} range={target.range} onPlaybackError={(reason) => trackVideoError(reason, target.id)} /></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-5">{[
          ['1', '原速再听'], ['2', '显示关键词'], ['3', '缺词字幕'], ['4', '完整字幕'], ['5', '中文翻译'],
        ].map(([level, label]) => <button key={level} type="button" onClick={() => { const value = Number(level); if (value === 1) playerRef.current?.replay(); else setSupportLevels((current) => ({ ...current, [targetId]: Math.max(current[targetId] ?? 0, value) })); }} className={`min-h-11 rounded-lg border px-2 text-xs font-black ${supportLevel >= Number(level) && Number(level) > 1 ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{level}. {label}</button>)}</div>
        {supportLevel >= 2 && <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm leading-7 text-gray-700">{supportLevel === 2 && <><strong className="text-primary">关键词：</strong>{target.keywords.join(' · ')}</>}{supportLevel === 3 && target.gapTranscript}{supportLevel === 4 && target.transcript}{supportLevel >= 5 && <><p>{target.transcript}</p><p className="mt-2 text-gray-500">{target.translation}</p></>}</div>}
        <div className="mt-6 border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-black text-gray-800"><MapPin className="h-4 w-4 text-primary" />按听到的顺序排列路线</h3><p className="mt-1 text-xs text-gray-400">点击下方短语，依次放入路线。</p></div><button type="button" onClick={() => setRouteSelections((current) => ({ ...current, [targetId]: [] }))} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-500"><RotateCcw className="h-3.5 w-3.5" />重置</button></div>
          <div className="mt-4 flex min-h-14 flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3">{selectedRoute.length ? selectedRoute.map((item, index) => <span key={item} className="rounded-md bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm"><span className="mr-1 text-primary">{index + 1}.</span>{item}</span>) : <span className="text-sm text-gray-400">路线尚未开始</span>}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{target.routeChoices.map((item) => <button key={item} type="button" disabled={selectedRoute.includes(item)} onClick={() => selectRouteStep(item)} className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 text-left text-sm font-bold text-gray-600 disabled:bg-gray-100 disabled:text-gray-300">{item}</button>)}</div>
          {routeComplete && <p className={`mt-3 rounded-lg p-3 text-sm font-bold ${routeCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{routeCorrect ? '路线顺序正确。' : `顺序需要调整。参考：${target.routeAnswer.join(' → ')}`}</p>}
        </div>
        <VocabularyRescue speaker={target} onReplay={() => playerRef.current?.replay()} onOpen={() => {}} courseName="Demander son chemin" themes={['听力课', '问路与指路']} />
        <button type="button" disabled={!routeComplete} onClick={finishTarget} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white disabled:bg-gray-200">{nextClip(targetId, new Set<DirectionClipId>(completedTargets).add(targetId)) ? `听下一段：${nextClip(targetId, new Set<DirectionClipId>(completedTargets).add(targetId))!.name}` : '完成定向再听'}</button>
      </section>
    );

    if (step === 4) {
      const isReviewed = reviewed.has(dictationId);
      return <section>
        <p className="text-sm font-bold text-primary">关键词听写 · Dictée ciblée</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">听写“{dictation.name}”中的路线词</h2>
        <p className="mt-2 text-sm text-gray-500">完整法语语境已经保留，只填写空缺词；中文翻译按需查看。</p>
        <div className="mt-5">{clipTabs(dictationId, setDictationId)}</div>
        <div className="mt-5"><SegmentVideoPlayer src={dictation.video} range={dictation.range} onPlaybackError={(reason) => trackVideoError(reason, dictation.id)} /></div>
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-base leading-[3.2] text-gray-700">{dictation.dictationTemplate.map((part, index) => {
          if (typeof part === 'string') return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
          const blankNumber = dictation.dictationTemplate.slice(0, index).filter((item) => typeof item !== 'string').length + 1;
          return <span key={part.id} className="inline-block"><input value={inputs[part.id] ?? ''} disabled={isReviewed} onChange={(event) => setInputs((current) => ({ ...current, [part.id]: event.target.value }))} placeholder={`第${blankNumber}空`} aria-label={`${dictation.name}第${blankNumber}空`} className={`mx-1 h-10 w-32 rounded-md border px-2 text-center text-sm font-bold ${isReviewed ? normalize(inputs[part.id] ?? '') === normalize(part.answer) ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-600' : 'border-gray-300'}`} />{isReviewed && normalize(inputs[part.id] ?? '') !== normalize(part.answer) && <span className="mr-2 text-xs font-bold text-emerald-600">{part.answer}</span>}</span>;
        })}</div>
        {!isReviewed && <button type="button" aria-expanded={shownTranslations.has(dictationId)} onClick={() => setShownTranslations((current) => { const next = new Set(current); next.has(dictationId) ? next.delete(dictationId) : next.add(dictationId); return next; })} className="mt-3 min-h-11 text-sm font-bold text-primary">{shownTranslations.has(dictationId) ? '收起中文翻译' : '需要帮助？显示中文翻译'}</button>}
        {!isReviewed && shownTranslations.has(dictationId) && <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">{dictation.translation}</p>}
        {isReviewed && <div className="mt-4 rounded-lg bg-indigo-50 p-4 text-sm leading-7 text-gray-700"><p className="text-xs font-black text-primary">完整答案</p><p className="mt-1">{dictation.transcript}</p><p className="mt-3 border-t border-indigo-100 pt-3 text-gray-500">{dictation.translation}</p></div>}
        <button type="button" onClick={checkDictation} className="mt-6 min-h-12 w-full rounded-lg bg-primary font-black text-white">{!isReviewed ? `核对 ${dictation.name}` : nextClip(dictationId, new Set<DirectionClipId>(reviewed).add(dictationId)) ? `听写下一段：${nextClip(dictationId, new Set<DirectionClipId>(reviewed).add(dictationId))!.name}` : '查看学习反思'}</button>
      </section>;
    }

    return <section>
      <p className="text-sm font-bold text-primary">学习反思 · Réflexion</p>
      <h2 className="mt-2 text-2xl font-black text-gray-800">这次你听懂了什么？</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="border-l-4 border-primary bg-gray-50 p-4"><span className="text-xs text-gray-400">内容核验</span><strong className="mt-1 block text-xl">{summary.comprehensionCorrect} / {DIRECTIONS_COMPREHENSION_QUESTIONS.length}</strong></div><div className="border-l-4 border-emerald-400 bg-gray-50 p-4"><span className="text-xs text-gray-400">路线重建</span><strong className="mt-1 block text-xl">{summary.routeCorrectCount} / {DIRECTION_CLIPS.length}</strong></div><div className="border-l-4 border-amber-400 bg-gray-50 p-4"><span className="text-xs text-gray-400">关键词听写</span><strong className="mt-1 block text-xl">{summary.dictationCorrect} / {summary.dictationTotal}</strong></div></div>
      <div className="mt-5 rounded-lg border border-gray-200 p-4"><h3 className="font-black text-gray-800">错误归纳</h3><div className="mt-3 space-y-2">{(summary.errors.length ? summary.errors : ['内容核验、路线重建和关键词听写全部正确。']).map((error) => <p key={error} className="text-sm text-gray-600">{error}</p>)}</div></div>
      <div className="mt-5"><h3 className="font-black text-gray-800">本次有效的策略</h3><div className="mt-3 grid gap-2">{['先抓住目的地，再听路线细节', '用 gauche、droite、tout droit 标记方向', '用 première、deuxième 重建路口顺序', '利用 boulangerie、cinéma 等地标确认位置', '需要继续练习方向词的声音辨认'].map((item) => <button key={item} type="button" onClick={() => setReflection((current) => { const next = new Set(current); next.has(item) ? next.delete(item) : next.add(item); return next; })} className={`min-h-11 rounded-lg border px-3 text-left text-sm font-bold ${reflection.has(item) ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'}`}>{reflection.has(item) && <Check className="mr-2 inline h-4 w-4" />}{item}</button>)}</div></div>
      <div className="mt-7 border-t border-gray-100 pt-6">
        <p className="text-xs font-bold text-primary">把听懂的内容变成自己的表达</p>
        <h3 className="mt-2 text-lg font-black text-gray-800">用法语完成一个问路小任务</h3>
        <p className="mt-2 text-sm text-gray-500">任选一个任务，写 2–3 句。可以点击下方参考表达，再替换成自己的地点和路线。</p>
        <div className="mt-4 border-l-4 border-primary bg-indigo-50 px-4 py-3 text-sm leading-6 text-gray-700">
          <p><strong className="text-primary">任务 A · 问路：</strong>礼貌询问图书馆、车站或电影院在哪里。</p>
          <p className="mt-2"><strong className="text-primary">任务 B · 指路：</strong>告诉别人怎样到达一个地点，至少使用两个方向词，可加入地标或距离。</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{EXPRESSION_MODELS.map((model) => <button key={model.label} type="button" onClick={() => setPersonalExpression(model.text)} className={`min-h-16 rounded-lg border px-3 py-3 text-left ${personalExpression === model.text ? 'border-primary bg-indigo-50' : 'border-gray-200 bg-white'}`}><span className="block text-xs font-black text-primary">{model.label}</span><span className="mt-1 block text-sm font-bold leading-6 text-gray-700">{model.text}</span></button>)}</div>
        <label htmlFor="directions-personal-expression" className="mt-5 block text-sm font-black text-gray-800">请写下你的问路或指路句子</label>
        <textarea id="directions-personal-expression" value={personalExpression} onChange={(event) => setPersonalExpression(event.target.value)} placeholder="例如：Excusez-moi, où se trouve la bibliothèque, s’il vous plaît ? Vous allez tout droit, puis vous tournez à gauche." rows={4} className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm font-bold leading-6 text-gray-700 outline-none focus:border-primary focus:ring-2 focus:ring-indigo-100" />
      </div>
      <p className="mt-6 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-700">学习档案已自动保存，可在课程列表中随时回顾。</p>
      <Link to="/listening" className="mt-6 flex min-h-12 items-center justify-center rounded-lg bg-primary font-black text-white">返回课程列表</Link>
    </section>;
  };

  return <div className="py-6 md:py-10">
    <Link to="/listening" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500"><ArrowLeft className="h-4 w-4" />真实素材听力</Link>
    <header className="mt-5 border-b border-gray-100 pb-5"><div className="flex items-center gap-2 text-primary"><Headphones className="h-5 w-5" /><span className="text-sm font-black">课程 03 · 真实情境</span></div><h1 className="mt-2 text-3xl font-black text-gray-800">Demander son chemin</h1><p className="mt-2 text-sm text-gray-500">问路与指路：听懂方向、顺序、距离和地标</p></header>
    <nav className="mt-5 grid grid-cols-6 gap-1.5 rounded-lg border border-gray-100 bg-white p-2" aria-label="课程步骤">{STEPS.map((label, index) => <button key={label} type="button" disabled={index > maxStep} onClick={() => go(index)} className={`min-w-0 py-2 text-center text-[10px] font-black sm:text-xs ${index <= step ? 'text-primary' : 'text-gray-400'}`}><span className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full ${index <= step ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>{index < step ? <Check className="h-3 w-3" /> : index + 1}</span><span className="block truncate">{label}</span></button>)}</nav>
    <main className="mx-auto mt-6 max-w-3xl rounded-lg border border-gray-100 bg-white p-5 shadow-sm sm:p-7">{renderStep()}</main>
    <aside className="mx-auto mt-4 flex max-w-3xl items-start gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" /><p>{step === 0 && '先预测需要的信息类型，不提前显示路线答案。'}{step === 1 && '两个视频都保持原速完整播放，先判断交际目的。'}{step === 2 && '法语选项核验目的地、方向与地标；题意帮助按需打开。'}{step === 3 && '先重听完整短片，再按顺序重建路线；提示逐级打开。'}{step === 4 && '把方向和地标的声音与拼写连接起来，中文只在需要时显示。'}{step === 5 && '借用视频中的问路句型，替换成自己熟悉的目的地和路线。'}</p></aside>
  </div>;
};

export default ListeningDirectionsView;
