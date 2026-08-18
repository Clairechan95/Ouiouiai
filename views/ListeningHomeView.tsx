import React from 'react';
import { ArrowRight, CheckCircle2, Clock3, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';

const lessons = [
  {
    path: '/listening/se-presenter',
    number: '01',
    title: 'Se présenter',
    chinese: '用法语介绍自己',
    meta: '3位说话人 · 约30秒',
    description: '辨认姓名、国籍、城市和来法国的目的。',
    video: '/listening/se-presenter-full.mp4',
    action: '继续学习',
  },
  {
    path: '/listening/pourquoi-francais',
    number: '02',
    title: 'Pourquoi choisir le français ?',
    chinese: '为什么选择法语？',
    meta: '人物访谈 · 约42秒',
    description: '听懂语言意象、语言感受、文化探索与交流机会。',
    video: '/listening/pourquoi-francais.mp4',
    action: '开始学习',
  },
];

const ListeningHomeView: React.FC = () => (
  <div className="py-8 md:py-12">
    <header className="border-b border-gray-100 pb-7">
      <div className="flex items-center gap-3 text-primary">
        <Headphones className="h-6 w-6" />
        <span className="text-sm font-black">听力实战</span>
      </div>
      <h1 className="mt-3 text-3xl font-black text-gray-800 md:text-4xl">真实素材听力</h1>
      <p className="mt-2 text-sm font-bold text-gray-400">原速真听力 · 分步策略训练</p>
    </header>

    <div className="mt-7 grid gap-5 lg:grid-cols-2">
      {lessons.map((lesson) => (
        <article key={lesson.path} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="relative aspect-video overflow-hidden bg-gray-950">
            <video src={lesson.video} muted playsInline preload="metadata" className="h-full w-full object-cover" />
            <span className="absolute left-4 top-4 rounded-md bg-white/90 px-2.5 py-1 text-xs font-black text-gray-700">
              课程 {lesson.number}
            </span>
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-gray-800">{lesson.title}</h2>
                <p className="mt-1 text-sm font-bold text-primary">{lesson.chinese}</p>
              </div>
              <span className="flex flex-shrink-0 items-center gap-1 text-xs text-gray-400">
                <Clock3 className="h-3.5 w-3.5" />{lesson.meta}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-gray-500">{lesson.description}</p>
            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />六步训练
              </span>
              <Link to={lesson.path} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-white">
                {lesson.action}<ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  </div>
);

export default ListeningHomeView;
