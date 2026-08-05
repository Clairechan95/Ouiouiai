import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ClipboardCheck,
  Headphones,
  Lightbulb,
  ListChecks,
  Volume2,
  X,
} from 'lucide-react';
import SegmentVideoPlayer, { SegmentVideoPlayerHandle, VideoRange } from '../components/SegmentVideoPlayer';
import VocabularyRescue from '../components/VocabularyRescue';
import {
  DETAIL_OPTIONS,
  DictationField,
  LISTENING_FULL_RANGE,
  LISTENING_SPEAKERS,
  LISTENING_VIDEO,
  ListeningSpeaker,
  ListeningSpeakerId,
  ListeningVocabulary,
  NATIONALITY_OPTIONS,
} from '../data/listeningLesson';

const STEP_LABELS = ['预测', '初听', '核验', '定向再听', '关键词听写', '反思'];
const PREDICTION_OPTIONS = ['姓名', '国籍', '所在城市', '来法国的时间', '商品价格', '天气情况'];

type MatchKey = `${ListeningSpeakerId}-${'nationality' | 'detail'}`;

const normalizeAnswer = (value: string) => value.trim().toLocaleLowerCase('fr-FR').normalize('NFC');
const withoutAccents = (value: string) =>
  normalizeAnswer(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const getDictationFields = (speaker: ListeningSpeaker) =>
  speaker.dictationTemplate.filter((part): part is DictationField => typeof part !== 'string');

const ListeningLessonView: React.FC = () => {
  const playerRef = useRef<SegmentVideoPlayerHandle>(null);
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [predictions, setPredictions] = useState<Set<string>>(new Set());
  const [gistAnswer, setGistAnswer] = useState<number | null>(null);
  const [matches, setMatches] = useState<Partial<Record<MatchKey, string>>>({});
  const [matchSubmitted, setMatchSubmitted] = useState(false);
  const [targetSpeakerId, setTargetSpeakerId] = useState<ListeningSpeakerId>('jeena');
  const [completedTargets, setCompletedTargets] = useState<Set<ListeningSpeakerId>>(new Set());
  const [supportLevels, setSupportLevels] = useState<Partial<Record<ListeningSpeakerId, number>>>({});
  const [usedSupports, setUsedSupports] = useState<Set<string>>(new Set());
  const [dictationSpeakerId, setDictationSpeakerId] = useState<ListeningSpeakerId>('jeena');
  const [dictationInputs, setDictationInputs] = useState<Record<string, string>>({});
  const [reviewedDictations, setReviewedDictations] = useState<Set<ListeningSpeakerId>>(new Set());
  const [reflectionChoices, setReflectionChoices] = useState<Set<string>>(new Set());
  const [openedVocabulary, setOpenedVocabulary] = useState<Map<string, ListeningVocabulary>>(new Map());
  const [completed, setCompleted] = useState(false);

  const targetSpeaker = LISTENING_SPEAKERS.find((item) => item.id === targetSpeakerId)!;
  const dictationSpeaker = LISTENING_SPEAKERS.find((item) => item.id === dictationSpeakerId)!;
  const activeSpeaker = step === 4 ? dictationSpeaker : targetSpeaker;

  const videoRange: VideoRange = step === 3 || step === 4
    ? { start: activeSpeaker.start, end: activeSpeaker.end, label: `${activeSpeaker.name} 片段` }
    : LISTENING_FULL_RANGE;

  const goToStep = (nextStep: number) => {
    const bounded = Math.max(0, Math.min(STEP_LABELS.length - 1, nextStep));
    setStep(bounded);
    setMaxStep((current) => Math.max(current, bounded));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const togglePrediction = (item: string) => {
    setPredictions((current) => {
      const next = new Set(current);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const chooseMatch = (key: MatchKey, value: string) => {
    if (matchSubmitted) return;
    setMatches((current) => ({ ...current, [key]: value }));
  };

  const expectedMatch = (speaker: ListeningSpeaker, type: 'nationality' | 'detail') =>
    type === 'nationality' ? speaker.nationality : speaker.detail;

  const targetSupportLevel = supportLevels[targetSpeakerId] ?? 0;

  const useSupport = (level: number) => {
    setUsedSupports((current) => new Set(current).add(`${targetSpeakerId}-${level}`));
    if (level === 1) {
      playerRef.current?.replay();
      return;
    }
    setSupportLevels((current) => ({
      ...current,
      [targetSpeakerId]: Math.max(current[targetSpeakerId] ?? 0, level),
    }));
  };

  const recordVocabularyHelp = (entry: ListeningVocabulary) => {
    setOpenedVocabulary((current) => {
      const next = new Map(current);
      next.set(entry.id, entry);
      return next;
    });
  };

  const selectNextTarget = () => {
    const nextCompleted = new Set(completedTargets).add(targetSpeakerId);
    setCompletedTargets(nextCompleted);
    const currentIndex = LISTENING_SPEAKERS.findIndex((item) => item.id === targetSpeakerId);
    const nextSpeaker = LISTENING_SPEAKERS.slice(currentIndex + 1).find((item) => !nextCompleted.has(item.id))
      ?? LISTENING_SPEAKERS.find((item) => !nextCompleted.has(item.id));
    if (nextSpeaker) setTargetSpeakerId(nextSpeaker.id);
    else goToStep(4);
  };

  const targetButtonLabel = useMemo(() => {
    const nextCompleted = new Set(completedTargets).add(targetSpeakerId);
    const currentIndex = LISTENING_SPEAKERS.findIndex((item) => item.id === targetSpeakerId);
    const nextSpeaker = LISTENING_SPEAKERS.slice(currentIndex + 1).find((item) => !nextCompleted.has(item.id))
      ?? LISTENING_SPEAKERS.find((item) => !nextCompleted.has(item.id));
    return nextSpeaker ? `听下一位：${nextSpeaker.name}` : '完成定向再听';
  }, [completedTargets, targetSpeakerId]);

  const dictationFields = getDictationFields(dictationSpeaker);
  const dictationReviewed = reviewedDictations.has(dictationSpeakerId);

  const checkOrAdvanceDictation = () => {
    if (!dictationReviewed) {
      const hasAnswer = dictationFields.some((field) => dictationInputs[field.id]?.trim());
      if (!hasAnswer) return;
      setReviewedDictations((current) => new Set(current).add(dictationSpeakerId));
      return;
    }

    const nextReviewed = new Set(reviewedDictations).add(dictationSpeakerId);
    const currentIndex = LISTENING_SPEAKERS.findIndex((item) => item.id === dictationSpeakerId);
    const nextSpeaker = LISTENING_SPEAKERS.slice(currentIndex + 1).find((item) => !nextReviewed.has(item.id))
      ?? LISTENING_SPEAKERS.find((item) => !nextReviewed.has(item.id));
    if (nextSpeaker) setDictationSpeakerId(nextSpeaker.id);
    else goToStep(5);
  };

  const dictationButtonLabel = useMemo(() => {
    if (!dictationReviewed) return `核对 ${dictationSpeaker.name}`;
    const currentIndex = LISTENING_SPEAKERS.findIndex((item) => item.id === dictationSpeakerId);
    const nextSpeaker = LISTENING_SPEAKERS.slice(currentIndex + 1).find((item) => !reviewedDictations.has(item.id))
      ?? LISTENING_SPEAKERS.find((item) => !reviewedDictations.has(item.id));
    return nextSpeaker ? `听写下一位：${nextSpeaker.name}` : '查看学习反思';
  }, [dictationReviewed, dictationSpeaker, dictationSpeakerId, reviewedDictations]);

  const summary = useMemo(() => {
    const errors: string[] = [];
    let matchCorrect = 0;
    let dictationCorrect = 0;
    let dictationTotal = 0;

    LISTENING_SPEAKERS.forEach((speaker) => {
      (['nationality', 'detail'] as const).forEach((type) => {
        const key = `${speaker.id}-${type}` as MatchKey;
        const selected = matches[key];
        const expected = expectedMatch(speaker, type);
        const label = `${speaker.name} 的${type === 'nationality' ? '国籍' : '关键信息'}`;
        if (selected === expected) matchCorrect += 1;
        else if (!selected) errors.push(`${label}：未选择`);
        else errors.push(`${label}：人物信息匹配错误`);
      });

      getDictationFields(speaker).forEach((field) => {
        dictationTotal += 1;
        const value = dictationInputs[field.id] ?? '';
        if (normalizeAnswer(value) === normalizeAnswer(field.answer)) {
          dictationCorrect += 1;
        } else if (!value.trim()) {
          errors.push(`${field.label}：未填写（${field.answer}）`);
        } else if (withoutAccents(value) === withoutAccents(field.answer)) {
          errors.push(`${field.label}：注意重音符号（${field.answer}）`);
        } else {
          errors.push(`${field.label}：拼写需复习（${field.answer}）`);
        }
      });
    });

    return { errors, matchCorrect, dictationCorrect, dictationTotal };
  }, [dictationInputs, matches]);

  useEffect(() => {
    if (step !== 5) return;
    localStorage.setItem('ouioui-listening-se-presenter-result', JSON.stringify({
      completedAt: new Date().toISOString(),
      gistAnswer,
      matchScore: summary.matchCorrect,
      dictationScore: summary.dictationCorrect,
      dictationTotal: summary.dictationTotal,
      errors: summary.errors,
      usedSupports: Array.from(usedSupports),
      vocabularyHelp: Array.from(openedVocabulary.values()).map((entry) => entry.lookupTerm),
    }));
  }, [gistAnswer, openedVocabulary, step, summary, usedSupports]);

  const renderMatchGroup = (speaker: ListeningSpeaker, type: 'nationality' | 'detail') => {
    const key = `${speaker.id}-${type}` as MatchKey;
    const selected = matches[key];
    const expected = expectedMatch(speaker, type);
    const options = type === 'nationality' ? NATIONALITY_OPTIONS : DETAIL_OPTIONS;
    return (
      <div>
        <p className="mb-2 text-xs font-bold text-gray-400">{type === 'nationality' ? '国籍' : '关键信息'}</p>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isSelected = selected === option;
            const isCorrect = matchSubmitted && option === expected;
            const isWrong = matchSubmitted && isSelected && option !== expected;
            return (
              <button
                key={option}
                type="button"
                disabled={matchSubmitted}
                onClick={() => chooseMatch(key, option)}
                className={`min-h-10 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                  isCorrect
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 font-bold'
                    : isWrong
                      ? 'border-red-300 bg-red-50 text-red-600 font-bold'
                      : isSelected
                        ? 'border-primary bg-indigo-50 text-primary font-bold'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {isCorrect && <Check className="w-4 h-4" />}
                  {isWrong && <X className="w-4 h-4" />}
                  {option}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTask = () => {
    if (step === 0) {
      return (
        <>
          <p className="text-sm font-bold text-primary">听前 · Anticipation</p>
          <h2 className="mt-2 text-2xl font-black text-gray-800">你预计会听到哪些信息？</h2>
          <p className="mt-2 text-sm text-gray-500">根据标题和画面作出预测，可以选择多项。</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {PREDICTION_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => togglePrediction(option)}
                className={`min-h-12 px-3 rounded-lg border text-sm font-bold transition-colors ${
                  predictions.has(option)
                    ? 'border-primary bg-indigo-50 text-primary'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!predictions.size}
            onClick={() => goToStep(1)}
            className="mt-7 w-full min-h-12 rounded-lg bg-primary text-white font-black disabled:bg-gray-200 disabled:text-gray-400"
          >
            带着预测去听
          </button>
        </>
      );
    }

    if (step === 1) {
      return (
        <>
          <p className="text-sm font-bold text-primary">第一遍 · Écoute globale</p>
          <h2 className="mt-2 text-2xl font-black text-gray-800">有几位学生进行自我介绍？</h2>
          <p className="mt-2 text-sm text-gray-500">完整听一遍，先抓住整体，不在没听懂的句子上停留。</p>
          <div className="mt-6 space-y-3">
            {[2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setGistAnswer(count)}
                className={`w-full min-h-12 px-4 rounded-lg border text-left font-bold ${
                  gistAnswer === count ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {count} 位
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={gistAnswer === null}
            onClick={() => goToStep(2)}
            className="mt-7 w-full min-h-12 rounded-lg bg-primary text-white font-black disabled:bg-gray-200 disabled:text-gray-400"
          >
            提交并核验
          </button>
        </>
      );
    }

    if (step === 2) {
      const selectedCount = Object.keys(matches).length;
      const correctCount = LISTENING_SPEAKERS.reduce((total, speaker) => {
        const nationality = matches[`${speaker.id}-nationality` as MatchKey] === speaker.nationality ? 1 : 0;
        const detail = matches[`${speaker.id}-detail` as MatchKey] === speaker.detail ? 1 : 0;
        return total + nationality + detail;
      }, 0);
      return (
        <>
          <p className="text-sm font-bold text-primary">第一次核验 · Vérification</p>
          <h2 className="mt-2 text-2xl font-black text-gray-800">把听到的信息与人物配对</h2>
          <p className="mt-2 text-sm text-gray-500">点击选择即可，不要求写出法语单词；不确定的信息可以暂时不选。</p>
          <div className="mt-6 divide-y divide-gray-100">
            {LISTENING_SPEAKERS.map((speaker) => (
              <section key={speaker.id} className="py-5 first:pt-0">
                <h3 className="mb-4 font-black text-gray-800">{speaker.name}</h3>
                <div className="space-y-4">
                  {renderMatchGroup(speaker, 'nationality')}
                  {renderMatchGroup(speaker, 'detail')}
                </div>
              </section>
            ))}
          </div>

          {matchSubmitted && (
            <div className="mt-5 border-l-4 border-primary bg-indigo-50 p-4 text-sm leading-7 text-gray-700">
              <p className="font-black text-primary">参考答案 · 答对 {correctCount} / 6</p>
              <p>Jeena：Coréenne · Séoul · Paris depuis 1 an</p>
              <p>Josh：Indien · France depuis 3 ans</p>
              <p>Daria：Ukrainienne · Études à la Sorbonne</p>
            </div>
          )}

          <button
            type="button"
            disabled={!matchSubmitted && selectedCount === 0}
            onClick={() => matchSubmitted ? goToStep(3) : setMatchSubmitted(true)}
            className="mt-7 w-full min-h-12 rounded-lg bg-primary text-white font-black disabled:bg-gray-200 disabled:text-gray-400"
          >
            {matchSubmitted ? '带着难点再次听' : '提交并查看答案'}
          </button>
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          <p className="text-sm font-bold text-primary">第二遍 · Écoute ciblée</p>
          <h2 className="mt-2 text-2xl font-black text-gray-800">重点听 {targetSpeaker.name}</h2>
          <p className="mt-2 text-sm text-gray-500">保持原速，按人物重听；需要时再逐级打开帮助。</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {LISTENING_SPEAKERS.map((speaker) => (
              <button
                key={speaker.id}
                type="button"
                onClick={() => setTargetSpeakerId(speaker.id)}
                className={`min-h-10 rounded-lg border text-sm font-bold ${
                  targetSpeakerId === speaker.id
                    ? 'border-primary bg-indigo-50 text-primary'
                    : 'border-gray-200 bg-white text-gray-500'
                }`}
              >
                {completedTargets.has(speaker.id) && <Check className="inline w-4 h-4 mr-1" />}
                {speaker.name}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {[
              { level: 1, label: '原速重听这一段', note: '可重复' },
              { level: 2, label: '显示关键词', note: '按需使用' },
              { level: 3, label: '显示缺词字幕', note: '按需使用' },
              { level: 4, label: '核对完整字幕', note: '法语核对' },
              { level: 5, label: '显示中文翻译', note: '理解核对' },
            ].map((support) => (
              <button
                key={support.level}
                type="button"
                onClick={() => useSupport(support.level)}
                className={`w-full min-h-12 px-3 rounded-lg border flex items-center justify-between gap-3 text-left ${
                  targetSupportLevel >= support.level
                    ? 'border-primary bg-indigo-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <span className="flex items-center gap-3 font-bold text-gray-700">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                    targetSupportLevel >= support.level ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {support.level}
                  </span>
                  {support.label}
                </span>
                <span className="text-xs text-gray-400">{support.note}</span>
              </button>
            ))}
          </div>

          {targetSupportLevel >= 2 && (
            <div className="mt-4 border-l-4 border-primary bg-gray-50 p-4 text-sm leading-7 text-gray-700">
              {targetSupportLevel === 2 && <><strong className="text-primary">关键词：</strong>{targetSpeaker.keywords.join(' · ')}</>}
              {targetSupportLevel === 3 && targetSpeaker.gapTranscript}
              {targetSupportLevel >= 4 && (
                <div>
                  <p className="text-xs font-bold text-primary">法语原文</p>
                  <p className="mt-1">{targetSpeaker.transcript}</p>
                  {targetSupportLevel >= 5 && (
                    <div className="mt-4 border-t border-gray-200 pt-3">
                      <p className="text-xs font-bold text-amber-600">中文翻译</p>
                      <p className="mt-1 text-gray-600">{targetSpeaker.translation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <VocabularyRescue
            speaker={targetSpeaker}
            onReplay={() => playerRef.current?.replay()}
            onOpen={recordVocabularyHelp}
          />

          <button
            type="button"
            onClick={selectNextTarget}
            className="mt-7 w-full min-h-12 rounded-lg bg-primary text-white font-black flex items-center justify-center gap-2"
          >
            {targetButtonLabel}<ChevronRight className="w-4 h-4" />
          </button>
        </>
      );
    }

    if (step === 4) {
      const fields = getDictationFields(dictationSpeaker);
      const hasAnyAnswer = fields.some((field) => dictationInputs[field.id]?.trim());
      return (
        <>
          <p className="text-sm font-bold text-primary">关键词听写 · Dictée ciblée</p>
          <h2 className="mt-2 text-2xl font-black text-gray-800">听写 {dictationSpeaker.name} 的关键词</h2>
          <p className="mt-2 text-sm text-gray-500">三位学生各完成一组填空。可以反复播放原句，保持原速。</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {LISTENING_SPEAKERS.map((speaker) => (
              <button
                key={speaker.id}
                type="button"
                onClick={() => setDictationSpeakerId(speaker.id)}
                className={`min-h-10 rounded-lg border text-sm font-bold ${
                  dictationSpeakerId === speaker.id
                    ? 'border-primary bg-indigo-50 text-primary'
                    : 'border-gray-200 bg-white text-gray-500'
                }`}
              >
                {reviewedDictations.has(speaker.id) && <Check className="inline w-4 h-4 mr-1" />}
                {speaker.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => playerRef.current?.replay()}
            className="mt-5 w-full min-h-12 px-4 rounded-lg border border-gray-200 bg-white flex items-center justify-between text-left"
          >
            <span className="flex items-center gap-3 font-bold text-gray-700"><Volume2 className="w-5 h-5 text-primary" />播放 {dictationSpeaker.name} 的原句</span>
            <span className="text-xs text-gray-400">原速</span>
          </button>

          <p className="mt-6 text-base leading-[3.1rem] text-gray-700">
            {dictationSpeaker.dictationTemplate.map((part, index) => {
              if (typeof part === 'string') return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
              const value = dictationInputs[part.id] ?? '';
              const isCorrect = normalizeAnswer(value) === normalizeAnswer(part.answer);
              return (
                <input
                  key={part.id}
                  aria-label={part.label}
                  type="text"
                  disabled={dictationReviewed}
                  value={value}
                  placeholder={part.placeholder}
                  onChange={(event) => setDictationInputs((current) => ({ ...current, [part.id]: event.target.value }))}
                  className={`mx-1 min-h-10 w-32 max-w-[42%] rounded-lg border px-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${
                    dictationReviewed
                      ? isCorrect
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-red-300 bg-red-50 text-red-600'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                />
              );
            })}
          </p>

          {dictationReviewed && (
            <div className="mt-4 border-l-4 border-primary bg-indigo-50 p-4 text-sm leading-7 text-gray-700">
              <strong className="text-primary">核对：</strong>{dictationSpeaker.transcript}
            </div>
          )}

          <VocabularyRescue
            speaker={dictationSpeaker}
            onReplay={() => playerRef.current?.replay()}
            onOpen={recordVocabularyHelp}
          />

          <button
            type="button"
            disabled={!dictationReviewed && !hasAnyAnswer}
            onClick={checkOrAdvanceDictation}
            className="mt-7 w-full min-h-12 rounded-lg bg-primary text-white font-black disabled:bg-gray-200 disabled:text-gray-400"
          >
            {dictationButtonLabel}
          </button>
        </>
      );
    }

    const visibleErrors = summary.errors.slice(0, 6);
    return (
      <>
        <p className="text-sm font-bold text-primary">课后 · Réflexion</p>
        <h2 className="mt-2 text-2xl font-black text-gray-800">这次你是怎样听懂的？</h2>
        <p className="mt-2 text-sm text-gray-500">结果既记录答案，也归纳你在理解和拼写上的具体困难。</p>

        <div className="mt-6 divide-y divide-gray-100">
          <div className="py-3 flex justify-between"><span className="text-gray-500">内容核验</span><strong className="text-primary">{summary.matchCorrect} / 6</strong></div>
          <div className="py-3 flex justify-between"><span className="text-gray-500">关键词听写</span><strong className="text-primary">{summary.dictationCorrect} / {summary.dictationTotal}</strong></div>
          <div className="py-3 flex justify-between"><span className="text-gray-500">使用的支持</span><strong className="text-primary">{usedSupports.size} 次</strong></div>
          <div className="py-3 flex justify-between"><span className="text-gray-500">查阅的词汇</span><strong className="text-primary">{openedVocabulary.size} 个</strong></div>
        </div>

        <section className="mt-6 pt-5 border-t border-gray-100">
          <h3 className="flex items-center gap-2 font-black text-gray-800"><ClipboardCheck className="w-5 h-5 text-amber-500" />本次错误归纳</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="border-l-4 border-primary bg-gray-50 p-3"><span className="block text-xs text-gray-400">内容核验</span><strong>{summary.matchCorrect} / 6 正确</strong></div>
            <div className="border-l-4 border-amber-400 bg-gray-50 p-3"><span className="block text-xs text-gray-400">关键词听写</span><strong>{summary.dictationCorrect} / {summary.dictationTotal} 正确</strong></div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-gray-500">
            {(visibleErrors.length ? visibleErrors : ['本次内容核验和关键词听写全部正确。']).map((error) => (
              <li key={error} className="flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />{error}</li>
            ))}
            {summary.errors.length > visibleErrors.length && <li>另有 {summary.errors.length - visibleErrors.length} 项需要复习。</li>}
            {openedVocabulary.size > 0 && (
              <li className="flex gap-2">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                词义求助：{Array.from(openedVocabulary.values()).map((entry) => entry.display).join('、')}
              </li>
            )}
          </ul>
        </section>

        <section className="mt-6 pt-5 border-t border-gray-100">
          <h3 className="font-black text-gray-800">对你最有帮助的是：</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {['先预测信息', '抓人名和地名', '按人物分段再听', '最后核对字幕'].map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setReflectionChoices((current) => {
                  const next = new Set(current);
                  if (next.has(choice)) next.delete(choice); else next.add(choice);
                  return next;
                })}
                className={`min-h-11 rounded-lg border px-3 text-sm font-bold ${
                  reflectionChoices.has(choice) ? 'border-primary bg-indigo-50 text-primary' : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
        </section>

        {completed ? (
          <div className="mt-7 bg-emerald-50 text-emerald-700 p-4 rounded-lg text-center font-bold">
            本节学习记录已保存在当前设备。
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCompleted(true)}
            className="mt-7 w-full min-h-12 rounded-lg bg-primary text-white font-black"
          >
            完成课程
          </button>
        )}
      </>
    );
  };

  return (
    <div className="py-5 sm:py-8">
      <header className="flex items-center justify-between gap-4">
        <Link to="/" className="w-10 h-10 rounded-lg bg-white border border-gray-200 text-gray-500 flex items-center justify-center" aria-label="返回首页">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-primary">真实素材听力 · A1+</p>
          <h1 className="truncate text-lg sm:text-xl font-black text-gray-800">Se présenter en France</h1>
        </div>
        <span className="hidden sm:inline-flex px-3 py-1.5 rounded-full bg-indigo-50 text-primary text-xs font-bold">Interview · 约 12 分钟</span>
      </header>

      <nav className="mt-5 grid grid-cols-6 gap-1.5 rounded-lg border border-gray-100 bg-white p-2" aria-label="课程步骤">
        {STEP_LABELS.map((label, index) => {
          const accessible = index <= maxStep;
          return (
            <button
              key={label}
              type="button"
              disabled={!accessible}
              onClick={() => accessible && goToStep(index)}
              className={`min-w-0 min-h-12 rounded-lg px-1 py-1 flex flex-col items-center justify-center gap-1 text-[10px] sm:text-xs font-bold ${
                index === step ? 'bg-indigo-50 text-primary' : index < step ? 'text-primary' : 'text-gray-400'
              } disabled:opacity-50`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                index <= step ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {index < step ? <Check className="w-3 h-3" /> : index + 1}
              </span>
              <span className="w-full whitespace-normal leading-tight">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-5 grid lg:grid-cols-[0.88fr_1.12fr] gap-5 items-start">
        <section className="lg:sticky lg:top-5">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <Headphones className="w-4 h-4" />原速真听力 · 分步策略训练
          </div>
          <p className="mt-2 mb-3 text-sm text-gray-500">外国学生分享他们在法国学习和生活的经历。</p>
          <SegmentVideoPlayer ref={playerRef} src={LISTENING_VIDEO} range={videoRange} />
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-400">
            <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {step === 0 && '先观察人物和场景，不提前显示目标词汇。'}
            {step === 1 && '第一遍连续播放，不要求听懂每个词。'}
            {step === 2 && '点击选择并匹配，不把拼写困难算作听力错误。'}
            {step === 3 && '按人物原速重听，提示按需要逐级打开。'}
            {step === 4 && '依次完成 Jeena、Josh 和 Daria 的关键词听写。'}
            {step === 5 && '核验与听写错误已分别归纳。'}
          </p>
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-5 sm:p-7 shadow-sm">
          {renderTask()}
        </section>
      </div>

      <footer className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-300">
        <ListChecks className="w-4 h-4" />本页为独立测试课程，不影响现有学习记录
      </footer>
    </div>
  );
};

export default ListeningLessonView;
