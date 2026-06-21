
import React, { useState, useRef } from 'react';
import { Trash2, CheckCircle, Circle, Languages, PenTool, RotateCcw, Check, X } from 'lucide-react';
import { useAppContext } from '../App';
import AudioPlayer from '../components/AudioPlayer';

type FilterType = 'all' | 'conjugation' | 'cloze' | 'mastered';

// 每道题的重做状态
interface RetryState {
  input: string;
  submitted: boolean;  // 是否已提交过
  correct: boolean;
}

const WrongAnswerView: React.FC = () => {
  const { wrongAnswers, removeWrongAnswer, toggleMastered } = useAppContext();
  const [filter, setFilter] = useState<FilterType>('all');
  const [toast, setToast] = useState<string | null>(null);
  // 每道题独立的重做状态，key 为 item.id
  const [retryMap, setRetryMap] = useState<Record<string, RetryState>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const filtered = wrongAnswers.filter(w => {
    if (filter === 'all') return !w.mastered;
    if (filter === 'mastered') return w.mastered;
    return !w.mastered && w.sourceType === filter;
  });

  const unmasteredCount = wrongAnswers.filter(w => !w.mastered).length;
  const conjugationCount = wrongAnswers.filter(w => !w.mastered && w.sourceType === 'conjugation').length;
  const clozeCount = wrongAnswers.filter(w => !w.mastered && w.sourceType === 'cloze').length;
  const masteredCount = wrongAnswers.filter(w => w.mastered).length;

  const tabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: '待复习', count: unmasteredCount },
    { key: 'conjugation', label: '变位练习', count: conjugationCount },
    { key: 'cloze', label: '创意听写', count: clozeCount },
    { key: 'mastered', label: '已掌握', count: masteredCount },
  ];

  // 开启重做模式
  const startRetry = (id: string) => {
    setRetryMap(prev => ({ ...prev, [id]: { input: '', submitted: false, correct: false } }));
    setTimeout(() => inputRefs.current[id]?.focus(), 50);
  };

  // 提交重做答案
  const submitRetry = (id: string, answer: string) => {
    const retry = retryMap[id];
    if (!retry) return;
    const correct = retry.input.toLowerCase().trim() === answer.toLowerCase().trim();
    setRetryMap(prev => ({ ...prev, [id]: { ...prev[id], submitted: true, correct } }));
    if (correct) {
      setTimeout(() => {
        toggleMastered(id);
        showToast('答对了！已标记为已掌握 ✓');
      }, 800);
    }
  };

  // 重置重做状态（再试一次）
  const resetRetry = (id: string) => {
    setRetryMap(prev => ({ ...prev, [id]: { input: '', submitted: false, correct: false } }));
    setTimeout(() => inputRefs.current[id]?.focus(), 50);
  };

  return (
    <div className="p-6 pb-28 min-h-full bg-background">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-black text-gray-800 mb-1">错题本</h1>
        <p className="text-gray-400 text-sm">
          共 {wrongAnswers.length} 道错题，{unmasteredCount} 道待复习
        </p>
      </header>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl font-bold text-sm whitespace-nowrap transition-all ${
              filter === tab.key
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-white text-gray-500 border border-gray-100'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${
                filter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CheckCircle className="w-16 h-16 text-green-300 mb-4" />
          <p className="text-gray-400 font-bold text-lg">
            {filter === 'mastered' ? '还没有已掌握的题目' : '这里没有错题 🎉'}
          </p>
          <p className="text-gray-300 text-sm mt-1">
            {filter === 'mastered' ? '重做答对后会自动归入这里' : '去变位练习或创意听写挑战一下吧'}
          </p>
        </div>
      )}

      {/* Wrong Answer Cards */}
      <div className="space-y-4">
        {filtered.map(item => {
          const retry = retryMap[item.id];
          const isRetrying = !!retry;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-[2rem] border p-5 shadow-sm transition-all duration-300 ${
                item.mastered ? 'border-green-100 opacity-70' :
                retry?.submitted && retry.correct ? 'border-green-300 bg-green-50/30' :
                retry?.submitted && !retry.correct ? 'border-red-200' :
                'border-gray-100'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.sourceType === 'conjugation' ? (
                    <span className="flex items-center gap-1 bg-violet-50 text-violet-600 text-xs font-bold px-2.5 py-1 rounded-xl">
                      <Languages className="w-3 h-3" /> 变位练习
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-bold px-2.5 py-1 rounded-xl">
                      <PenTool className="w-3 h-3" /> 创意听写
                    </span>
                  )}
                  {item.tense && (
                    <span className="text-xs text-gray-400 font-semibold">{item.infinitive} · {item.tense}</span>
                  )}
                  {item.theme && (
                    <span className="text-xs text-gray-400 font-semibold">{item.theme}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* 重做按钮（非重做模式时显示） */}
                  {!isRetrying && !item.mastered && (
                    <button
                      onClick={() => startRetry(item.id)}
                      className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-xl transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> 重做
                    </button>
                  )}
                  <button
                    onClick={() => { toggleMastered(item.id); showToast(item.mastered ? '已取消掌握' : '已标记为掌握 ✓'); }}
                    className={`transition-colors ${item.mastered ? 'text-green-500' : 'text-gray-300 hover:text-green-400'}`}
                    title={item.mastered ? '取消掌握' : '标记为已掌握'}
                  >
                    {item.mastered ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => { removeWrongAnswer(item.id); showToast('已删除'); }}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Context Sentence */}
              <div className="flex items-start gap-3 mb-3">
                <AudioPlayer
                  text={item.context.replace(/_____/g, item.answer)}
                  className="shrink-0 bg-gray-50 text-gray-400 w-9 h-9"
                />
                <p className="text-base text-gray-700 font-medium leading-relaxed">
                  {item.context.split('_____').map((part, i, arr) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        isRetrying ? (
                          // 重做模式：显示输入框
                          <span className="inline-flex items-center gap-1 mx-1 align-middle">
                            {!retry.submitted ? (
                              <>
                                <input
                                  ref={el => { inputRefs.current[item.id] = el; }}
                                  type="text"
                                  value={retry.input}
                                  onChange={e => setRetryMap(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], input: e.target.value }
                                  }))}
                                  onKeyDown={e => e.key === 'Enter' && submitRetry(item.id, item.answer)}
                                  className="border-b-2 border-primary/40 bg-primary/5 text-center text-primary font-bold w-24 px-2 py-0.5 outline-none focus:border-primary rounded-t-lg text-sm"
                                  placeholder="___"
                                />
                                <button
                                  onClick={() => submitRetry(item.id, item.answer)}
                                  className="bg-primary text-white w-7 h-7 rounded-full flex items-center justify-center shrink-0 hover:bg-primary/80 transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : retry.correct ? (
                              <span className="bg-green-100 text-green-600 border border-green-200 px-2.5 py-0.5 rounded-lg font-bold text-sm flex items-center gap-1">
                                <Check className="w-3 h-3" /> {item.answer}
                              </span>
                            ) : (
                              <>
                                <span className="bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-lg font-bold text-sm line-through">
                                  {retry.input || '?'}
                                </span>
                                <span className="text-gray-400 text-xs">→</span>
                                <span className="bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-lg font-bold text-sm">
                                  {item.answer}
                                </span>
                              </>
                            )}
                          </span>
                        ) : (
                          // 查看模式：显示错误答案 → 正确答案
                          <span className="inline-flex items-center gap-1 mx-1">
                            <span className="bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-lg font-bold text-sm line-through">
                              {item.userAnswer || '?'}
                            </span>
                            <span className="text-gray-400 text-xs">→</span>
                            <span className="bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-lg font-bold text-sm">
                              {item.answer}
                            </span>
                          </span>
                        )
                      )}
                    </React.Fragment>
                  ))}
                </p>
              </div>

              {/* Chinese Translation */}
              <p className="text-gray-400 text-sm italic border-l-4 border-gray-100 pl-3 mb-3">
                {item.chinese}
              </p>

              {/* 重做反馈区 */}
              {isRetrying && retry.submitted && !retry.correct && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => resetRetry(item.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 px-4 py-2 rounded-2xl transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> 再试一次
                  </button>
                  <button
                    onClick={() => setRetryMap(prev => { const n = { ...prev }; delete n[item.id]; return n; })}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-2xl transition-colors"
                  >
                    <X className="w-3 h-3" /> 关闭
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WrongAnswerView;
