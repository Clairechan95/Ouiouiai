import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpenCheck, CheckCircle2, ChevronDown, ChevronUp, Clock3, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../App';
import {
  fetchCloudListeningRecords,
  ListeningCourseId,
  ListeningProgressRecord,
  listLocalListeningRecords,
  mergeListeningRecords,
  saveLocalListeningRecord,
} from '../services/listeningProgressService';

const lessons: Array<{
  id: ListeningCourseId;
  path: string;
  number: string;
  title: string;
  chinese: string;
  meta: string;
  description: string;
  video: string;
  cover?: string;
}> = [
  {
    id: 'se-presenter', path: '/listening/se-presenter', number: '01', title: 'Se présenter',
    chinese: '用法语介绍自己', meta: '3位说话人 · 约30秒',
    description: '辨认姓名、国籍、城市和来法国的目的。', video: '/listening/se-presenter-full.mp4',
  },
  {
    id: 'pourquoi-francais', path: '/listening/pourquoi-francais', number: '02', title: 'Pourquoi choisir le français ?',
    chinese: '为什么选择法语？', meta: '人物访谈 · 约42秒',
    description: '听懂语言意象、语言感受、文化探索与交流机会。', video: '/listening/pourquoi-francais.mp4',
  },
  {
    id: 'demander-son-chemin', path: '/listening/demander-son-chemin', number: '03', title: 'Demander son chemin',
    chinese: '问路与指路', meta: '2个真实情境 · 约34秒',
    description: '听懂方向、路口顺序、距离和沿途地标。', video: '/listening/banque-de-paris.mp4',
    cover: '/listening/demander-son-chemin-cover.jpg',
  },
];

const formatDateTime = (iso: string) => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(iso));

const ListeningHomeView: React.FC = () => {
  const { user } = useAppContext();
  const [records, setRecords] = useState<ListeningProgressRecord[]>(() => listLocalListeningRecords(user?.id));
  const [portfolioOpen, setPortfolioOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refreshLocal = () => setRecords(listLocalListeningRecords(user?.id));
    refreshLocal();
    window.addEventListener('ouioui:listening-record-updated', refreshLocal);
    if (user?.id) {
      void fetchCloudListeningRecords(user.id).then((cloudRecords) => {
        if (cancelled) return;
        const merged = mergeListeningRecords(listLocalListeningRecords(user.id), cloudRecords);
        merged.forEach((record) => saveLocalListeningRecord(record, user.id));
        setRecords(merged);
      });
    }
    return () => {
      cancelled = true;
      window.removeEventListener('ouioui:listening-record-updated', refreshLocal);
    };
  }, [user?.id]);

  const recordMap = useMemo(() => new Map(records.map((record) => [record.courseId, record])), [records]);
  const archives = records.filter((record) => record.learningArchive);

  return (
    <div className="py-8 md:py-12">
      <header className="flex flex-col gap-4 border-b border-gray-100 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3 text-primary"><Headphones className="h-6 w-6" /><span className="text-sm font-black">听力实战</span></div>
          <h1 className="mt-3 text-3xl font-black text-gray-800 md:text-4xl">真实素材听力</h1>
          <p className="mt-2 text-sm font-bold text-gray-400">原速真听力 · 分步策略训练</p>
        </div>
        <button type="button" onClick={() => setPortfolioOpen((current) => !current)} aria-expanded={portfolioOpen} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-black text-gray-700">
          <BookOpenCheck className="h-4 w-4 text-primary" />学习档案 {archives.length > 0 && `(${archives.length})`}{portfolioOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </header>

      {portfolioOpen && (
        <section className="border-b border-gray-100 py-7">
          <h2 className="text-xl font-black text-gray-800">我的听力学习档案</h2>
          <p className="mt-1 text-sm text-gray-500">完成课程后，成绩、错误归纳、学习策略和个人表达会保存在这里。</p>
          {archives.length > 0 ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{archives.map((record) => {
            const archive = record.learningArchive!;
            const lesson = lessons.find((item) => item.id === record.courseId);
            return <article key={record.courseId} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-primary">课程 {lesson?.number}</p><h3 className="mt-1 text-lg font-black text-gray-800">{archive.courseTitle}</h3></div><time className="text-xs text-gray-400">{formatDateTime(archive.completedAt)}</time></div>
              <div className="mt-4 flex flex-wrap gap-2">{archive.scores.map((score) => <span key={score.label} className="rounded-md bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600">{score.label} {score.score}/{score.total}</span>)}</div>
              <div className="mt-4 border-t border-gray-100 pt-4 text-sm leading-6 text-gray-600"><strong className="text-gray-800">错误归纳：</strong>{archive.errors.length ? archive.errors.slice(0, 3).join('；') : '本次练习全部正确。'}</div>
              {archive.strategies.length > 0 && <p className="mt-2 text-sm leading-6 text-gray-600"><strong className="text-gray-800">有效策略：</strong>{archive.strategies.join('；')}</p>}
              {archive.personalExpression && <div className="mt-3 border-l-4 border-primary bg-indigo-50 px-3 py-2 text-sm leading-6 text-gray-700"><strong className="block text-xs text-primary">个人表达</strong>{archive.personalExpression}</div>}
              {lesson && <Link to={lesson.path} className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-black text-primary">回顾课程<ArrowRight className="h-4 w-4" /></Link>}
            </article>;
          })}</div> : <p className="mt-5 border-l-4 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">完成一节听力课程后，这里会生成第一份学习档案。</p>}
        </section>
      )}

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        {lessons.map((lesson) => {
          const record = recordMap.get(lesson.id);
          const action = record?.status === 'completed' ? '回顾课程' : record && record.maxStep > 0 ? '继续学习' : '开始学习';
          const progressLabel = record?.status === 'completed'
            ? '已完成 · 已保存档案'
            : record && record.maxStep > 0 ? `已到第 ${Math.min(6, record.maxStep + 1)} 步 · 自动保存` : '六步训练';
          return <article key={lesson.path} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="relative aspect-video overflow-hidden bg-gray-950">
              {lesson.cover ? <img src={lesson.cover} alt="" className="h-full w-full object-cover" /> : <video src={lesson.video} muted playsInline preload="metadata" className="h-full w-full object-cover" />}
              <span className="absolute left-4 top-4 rounded-md bg-white/90 px-2.5 py-1 text-xs font-black text-gray-700">课程 {lesson.number}</span>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black text-gray-800">{lesson.title}</h2><p className="mt-1 text-sm font-bold text-primary">{lesson.chinese}</p></div><span className="flex flex-shrink-0 items-center gap-1 text-xs text-gray-400"><Clock3 className="h-3.5 w-3.5" />{lesson.meta}</span></div>
              <p className="mt-4 text-sm leading-6 text-gray-500">{lesson.description}</p>
              <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${record ? 'text-emerald-600' : 'text-gray-500'}`}><CheckCircle2 className="h-4 w-4" />{progressLabel}</span>
                <Link to={lesson.path} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-white">{action}<ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
          </article>;
        })}
      </div>
    </div>
  );
};

export default ListeningHomeView;
