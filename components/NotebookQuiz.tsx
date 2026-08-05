import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Languages,
  RefreshCw,
  RotateCcw,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { NotebookItem } from '../types';
import AudioPlayer from './AudioPlayer';

type QuizDirection = 'fr-zh' | 'zh-fr';
type QuizPhase = 'main' | 'retry' | 'results';

interface QuizQuestion {
  id: string;
  item: NotebookItem;
  direction: QuizDirection;
  options: string[];
  correctAnswer: string;
}

interface NotebookQuizProps {
  items: NotebookItem[];
  onExit: () => void;
}

const shuffle = <T,>(values: T[]): T[] => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const answerFor = (item: NotebookItem, direction: QuizDirection) =>
  direction === 'fr-zh' ? item.chineseDefinition.trim() : item.text.trim();

const buildQuestion = (
  item: NotebookItem,
  pool: NotebookItem[],
  direction: QuizDirection,
  suffix: string,
): QuizQuestion => {
  const correctAnswer = answerFor(item, direction);
  const distractors = shuffle(pool)
    .filter(candidate => candidate.id !== item.id)
    .map(candidate => answerFor(candidate, direction))
    .filter((answer, index, answers) => answer && answer !== correctAnswer && answers.indexOf(answer) === index)
    .slice(0, 3);

  return {
    id: `${item.id}-${direction}-${suffix}`,
    item,
    direction,
    correctAnswer,
    options: shuffle([correctAnswer, ...distractors]),
  };
};

const buildSession = (items: NotebookItem[]): QuizQuestion[] => {
  const selectedItems = shuffle(items).slice(0, 10);
  const startsWithFrench = Math.random() >= 0.5;
  return selectedItems.map((item, index) => {
    const direction: QuizDirection = (index % 2 === 0) === startsWithFrench ? 'fr-zh' : 'zh-fr';
    return buildQuestion(item, items, direction, `main-${index}`);
  });
};

const NotebookQuiz: React.FC<NotebookQuizProps> = ({ items, onExit }) => {
  const [sessionNumber, setSessionNumber] = useState(1);
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => buildSession(items));
  const [phase, setPhase] = useState<QuizPhase>('main');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [mainCorrect, setMainCorrect] = useState(0);
  const [retryCorrect, setRetryCorrect] = useState(0);
  const [missedQuestions, setMissedQuestions] = useState<QuizQuestion[]>([]);
  const [remainingMisses, setRemainingMisses] = useState<QuizQuestion[]>([]);
  const [mainTotal, setMainTotal] = useState(questions.length);

  const currentQuestion = questions[currentIndex];
  const answeredCorrectly = selectedAnswer === currentQuestion?.correctAnswer;

  const resetSession = () => {
    const nextQuestions = buildSession(items);
    setSessionNumber(value => value + 1);
    setQuestions(nextQuestions);
    setPhase('main');
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setMainCorrect(0);
    setRetryCorrect(0);
    setMissedQuestions([]);
    setRemainingMisses([]);
    setMainTotal(nextQuestions.length);
  };

  const selectAnswer = (answer: string) => {
    if (selectedAnswer || !currentQuestion) return;
    setSelectedAnswer(answer);

    if (answer === currentQuestion.correctAnswer) {
      if (phase === 'main') setMainCorrect(value => value + 1);
      else setRetryCorrect(value => value + 1);
      return;
    }

    if (phase === 'main') {
      setMissedQuestions(previous => [...previous, currentQuestion]);
    } else {
      setRemainingMisses(previous => [...previous, currentQuestion]);
    }
  };

  const goNext = () => {
    if (!selectedAnswer) return;
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(index => index + 1);
      setSelectedAnswer(null);
      return;
    }

    if (phase === 'main' && missedQuestions.length > 0) {
      const retryQuestions = missedQuestions.map((question, index) =>
        buildQuestion(question.item, items, question.direction, `retry-${sessionNumber}-${index}`),
      );
      setQuestions(retryQuestions);
      setPhase('retry');
      setCurrentIndex(0);
      setSelectedAnswer(null);
      return;
    }

    setPhase('results');
    setSelectedAnswer(null);
  };

  if (phase === 'results') {
    const accuracy = mainTotal > 0 ? Math.round((mainCorrect / mainTotal) * 100) : 0;
    const masteredCount = mainCorrect + retryCorrect;
    const weakWords = Array.from(new Map(remainingMisses.map(question => [question.item.id, question.item])).values());

    return (
      <div className="min-h-[85vh] bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-primary font-bold mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回生词本
          </button>

          <section className="bg-white border border-gray-100 rounded-[2rem] p-6 sm:p-10 shadow-xl shadow-gray-200/50 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
              <Trophy className="w-10 h-10" />
            </div>
            <p className="text-sm font-black text-primary mb-2">本轮复习完成</p>
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-8">正确率 {accuracy}%</h1>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
              <div className="bg-gray-50 rounded-2xl px-2 py-4">
                <p className="text-2xl sm:text-3xl font-black text-gray-900">{mainTotal}</p>
                <p className="text-xs sm:text-sm text-gray-400 font-bold mt-1">本轮词数</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl px-2 py-4">
                <p className="text-2xl sm:text-3xl font-black text-emerald-600">{masteredCount}</p>
                <p className="text-xs sm:text-sm text-emerald-600/70 font-bold mt-1">已答对</p>
              </div>
              <div className="bg-rose-50 rounded-2xl px-2 py-4">
                <p className="text-2xl sm:text-3xl font-black text-rose-500">{weakWords.length}</p>
                <p className="text-xs sm:text-sm text-rose-500/70 font-bold mt-1">仍需巩固</p>
              </div>
            </div>

            {weakWords.length > 0 ? (
              <div className="text-left border-t border-gray-100 pt-6 mb-8">
                <p className="font-black text-gray-700 mb-3">仍需巩固</p>
                <div className="flex flex-wrap gap-2">
                  {weakWords.map(item => (
                    <span key={item.id} className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 font-bold text-sm">
                      {item.text}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold mb-8">
                <CheckCircle2 className="w-5 h-5" />
                本轮词汇已经全部答对
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={resetSession}
                className="h-14 rounded-2xl bg-primary text-white font-black inline-flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
              >
                <RefreshCw className="w-5 h-5" />
                再来一组
              </button>
              <button
                type="button"
                onClick={onExit}
                className="h-14 rounded-2xl bg-gray-100 text-gray-600 font-black inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                返回生词本
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const progress = ((currentIndex + 1) / questions.length) * 100;
  const isFrenchPrompt = currentQuestion.direction === 'fr-zh';

  return (
    <div className="min-h-[85vh] bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-6">
          <button
            type="button"
            onClick={onExit}
            className="w-11 h-11 rounded-full bg-white border border-gray-100 text-gray-500 flex items-center justify-center hover:text-primary shadow-sm transition-colors"
            aria-label="退出复习"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-black ${phase === 'retry' ? 'text-amber-600' : 'text-primary'}`}>
                {phase === 'retry' ? '错词回炉' : '双向选择复习'}
              </span>
              <span className="text-xs font-black text-gray-400">{currentIndex + 1} / {questions.length}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${phase === 'retry' ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        {phase === 'retry' && currentIndex === 0 && !selectedAnswer && (
          <div className="mb-5 px-4 py-3 rounded-2xl bg-amber-50 text-amber-700 flex items-center gap-3 text-sm font-bold">
            <RotateCcw className="w-5 h-5 shrink-0" />
            再答一次刚才的错词，巩固记忆。
          </div>
        )}

        <main className="bg-white border border-gray-100 rounded-[2rem] p-5 sm:p-8 shadow-xl shadow-gray-200/50">
          <div className="min-h-44 flex flex-col items-center justify-center text-center border-b border-gray-100 pb-6 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-primary text-xs font-black mb-5">
              <Languages className="w-4 h-4" />
              {isFrenchPrompt ? '法语 → 中文' : '中文 → 法语'}
            </div>
            {isFrenchPrompt ? (
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <h1 className="text-4xl sm:text-5xl font-black text-gray-900 break-words">{currentQuestion.item.text}</h1>
                <AudioPlayer text={currentQuestion.item.text} className="w-12 h-12 bg-primary/10 text-primary" />
              </div>
            ) : (
              <h1 className="text-2xl sm:text-4xl font-black text-gray-900 leading-tight break-words">
                {currentQuestion.item.chineseDefinition}
              </h1>
            )}
            {isFrenchPrompt && currentQuestion.item.ipa && (
              <p className="mt-3 text-gray-400 font-mono italic">{currentQuestion.item.ipa}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQuestion.options.map((option, index) => {
              const isCorrect = option === currentQuestion.correctAnswer;
              const isSelected = option === selectedAnswer;
              const revealedClass = selectedAnswer
                ? isCorrect
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : isSelected
                    ? 'border-rose-400 bg-rose-50 text-rose-600'
                    : 'border-gray-100 bg-gray-50 text-gray-400'
                : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:bg-indigo-50/50';

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => selectAnswer(option)}
                  disabled={selectedAnswer !== null}
                  className={`min-h-20 rounded-2xl border-2 px-4 py-3 text-left font-bold leading-snug flex items-center gap-3 transition-all ${revealedClass}`}
                >
                  <span className="w-7 h-7 shrink-0 rounded-full border border-current/20 flex items-center justify-center text-xs font-black">
                    {selectedAnswer && isCorrect ? <Check className="w-4 h-4" /> : selectedAnswer && isSelected ? <X className="w-4 h-4" /> : String.fromCharCode(65 + index)}
                  </span>
                  <span className="break-words min-w-0">{option}</span>
                </button>
              );
            })}
          </div>

          {selectedAnswer && (
            <div className={`mt-6 rounded-2xl p-4 sm:p-5 ${answeredCorrectly ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <div className={`flex items-center gap-2 font-black mb-2 ${answeredCorrectly ? 'text-emerald-700' : 'text-rose-600'}`}>
                {answeredCorrectly ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                {answeredCorrectly ? '回答正确' : `正确答案：${currentQuestion.correctAnswer}`}
              </div>
              {!answeredCorrectly && (
                <p className="text-sm text-gray-600 leading-relaxed">
                  <span className="font-black">{currentQuestion.item.text}</span>
                  {' · '}{currentQuestion.item.chineseDefinition}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={goNext}
            disabled={!selectedAnswer}
            className="w-full h-14 mt-6 rounded-2xl bg-primary text-white font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none active:scale-[0.98] transition-all"
          >
            {currentIndex === questions.length - 1 && phase === 'retry' ? '查看复习结果' : '下一题'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </main>
      </div>
    </div>
  );
};

export default NotebookQuiz;
