import React, { useMemo, useState } from 'react';
import { BookOpen, BookmarkPlus, Check, ExternalLink, LifeBuoy, Volume2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../App';
import { ListeningVocabulary } from '../data/listeningLesson';
import { WordEntry } from '../types';

interface VocabularyRescueProps {
  speaker: { name: string; vocabulary: ListeningVocabulary[] };
  onReplay: () => void;
  onOpen: (entry: ListeningVocabulary) => void;
  courseName?: string;
  themes?: string[];
}

const normalizeTerm = (value: string) => value.trim().toLocaleLowerCase('fr-FR');

const toNotebookEntry = (entry: ListeningVocabulary, courseName: string, themes: string[]): WordEntry => ({
  id: entry.id,
  text: entry.lookupTerm,
  chineseDefinition: entry.chinese,
  frenchDefinition: entry.note,
  examples: [{ french: entry.sourceSentence, chinese: entry.sourceChinese, level: 'A1' }],
  funNote: `来自听力课程 ${courseName}：${entry.note}`,
  imageUrls: [],
  themes,
  createdAt: Date.now(),
  pos: entry.pos,
  isVerb: entry.pos.startsWith('v.'),
  detectedForm: entry.display === 'installé'
    ? { infinitive: "s'installer", tense: 'passé composé', person: 'je' }
    : undefined,
});

const VocabularyRescue: React.FC<VocabularyRescueProps> = ({
  speaker,
  onReplay,
  onOpen,
  courseName = 'Se présenter',
  themes = ['听力课', '自我介绍'],
}) => {
  const { addToNotebook, notebook } = useAppContext();
  const [selected, setSelected] = useState<ListeningVocabulary | null>(null);

  const savedTerms = useMemo(
    () => new Set(notebook.map((item) => normalizeTerm(item.text))),
    [notebook],
  );

  const openEntry = (entry: ListeningVocabulary) => {
    setSelected(entry);
    onOpen(entry);
  };

  const isSaved = selected ? savedTerms.has(normalizeTerm(selected.lookupTerm)) : false;

  return (
    <>
      <section className="mt-5 border-t border-gray-100 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black text-gray-800">
              <LifeBuoy className="h-4 w-4 text-amber-500" />词汇救援
            </h3>
            <p className="mt-1 text-xs text-gray-400">只在词义妨碍理解时查看，不要求第一次听就会拼写。</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {speaker.vocabulary.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => openEntry(entry)}
              className="min-h-10 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-800 hover:border-amber-300"
            >
              {entry.display}
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-gray-950/35 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vocabulary-rescue-title"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[calc(100dvh-0.5rem)] w-full max-w-lg overflow-y-auto rounded-t-lg bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-lg sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-600">{speaker.name} · 听力词汇</p>
                <h2 id="vocabulary-rescue-title" className="mt-1 text-2xl font-black text-gray-800">
                  {selected.display}
                </h2>
                {selected.display !== selected.lookupTerm && (
                  <p className="mt-1 text-sm text-gray-400">词典形式：{selected.lookupTerm}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500"
                aria-label="关闭词汇救援"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 border-l-4 border-amber-400 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-700">{selected.pos}</p>
              <p className="mt-1 text-lg font-black text-gray-800">{selected.chinese}</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">{selected.note}</p>
            </div>

            <div className="mt-5">
              <p className="text-xs font-bold text-gray-400">视频原句</p>
              <p className="mt-1 text-sm leading-6 text-gray-700">{selected.sourceSentence}</p>
              <button
                type="button"
                onClick={onReplay}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700"
              >
                <Volume2 className="h-4 w-4 text-primary" />重听所在片段
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isSaved}
                onClick={() => addToNotebook(toNotebookEntry(selected, courseName, themes))}
                className="min-h-12 rounded-lg bg-primary px-3 text-sm font-black text-white disabled:bg-emerald-50 disabled:text-emerald-700"
              >
                <span className="inline-flex items-center gap-2">
                  {isSaved ? <Check className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
                  {isSaved ? '已在生词本' : '加入生词本'}
                </span>
              </button>
              <Link
                to={`/result/${encodeURIComponent(selected.lookupTerm)}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-black text-gray-700"
              >
                <BookOpen className="h-4 w-4 text-primary" />完整查词<ExternalLink className="h-3.5 w-3.5 text-gray-400" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VocabularyRescue;
