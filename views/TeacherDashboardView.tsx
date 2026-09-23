import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarDays,
  ChevronLeft,
  Clock3,
  Download,
  GraduationCap,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  Search,
  UsersRound,
} from 'lucide-react';
import { useAppContext } from '../App';
import { LearnerProfile, OuiOuiClass } from '../services/classService';
import {
  fetchTeacherClassData,
  TeacherClassData,
  TeacherEvent,
  TeacherListeningRecord,
  TeacherMembership,
  TeacherSession,
} from '../services/teacherAnalyticsService';

const DAY_MS = 24 * 60 * 60 * 1000;
const MODULE_LABELS: Record<string, string> = {
  search: '查词',
  notebook: '生词本',
  review: '复习',
  conjugation: '变位',
  dictation: '听写',
  listening: '听力',
  system: '会话',
};
const EVENT_LABELS: Record<string, string> = {
  session_started: '开始学习',
  session_ended: '结束学习',
  lookup_requested: '发起查词',
  lookup_succeeded: '完成查词',
  lookup_failed: '查词失败',
  word_saved: '收藏生词',
  word_removed: '移出生词',
  practice_started: '开始练习',
  practice_submitted: '提交练习',
  practice_completed: '完成练习',
  lesson_started: '开始听力课程',
  lesson_completed: '完成听力课程',
  media_error: '媒体播放失败',
  request_timeout: '请求超时',
};
const isLearningAction = (event: TeacherEvent) => event.module !== 'system'
  && !['lookup_failed', 'media_error', 'request_timeout'].includes(event.event_type);

const localDateKey = (iso: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(iso));

const formatDateTime = (iso: string) => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date(iso));

const csvCell = (value: unknown) => {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^(?:\s*[=+\-@]|[\t\r\n])/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

const downloadCsv = (filename: string, rows: unknown[][]) => {
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const TeacherDashboardView: React.FC = () => {
  const { user, authLoading, accountContext, accountLoading, accountError, refreshAccountContext } = useAppContext();
  const [rangeDays, setRangeDays] = useState(28);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [data, setData] = useState<TeacherClassData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const requestRef = useRef<AbortController | null>(null);

  const teachingClasses = accountContext?.teachingClasses ?? [];
  const selectedClass = teachingClasses.find((item) => item.id === selectedClassId) ?? teachingClasses[0];

  useEffect(() => {
    if (!selectedClassId && teachingClasses[0]) setSelectedClassId(teachingClasses[0].id);
  }, [selectedClassId, teachingClasses]);

  const loadData = async (classInfo: OuiOuiClass) => {
    if (accountContext?.profile?.role !== 'teacher') return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setLoading(true);
    setError('');
    setData(null);
    try {
      const midnight = Math.floor((Date.now() + 8 * 3600000) / DAY_MS) * DAY_MS - 8 * 3600000;
      const from = new Date(midnight - (rangeDays - 1) * DAY_MS);
      const result = await fetchTeacherClassData(classInfo, from.toISOString(), controller.signal);
      if (requestRef.current === controller && !controller.signal.aborted) setData(result);
    } catch (loadError) {
      if (requestRef.current === controller) setError('班级数据暂时无法完整读取，请缩短范围或重试');
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass) void loadData(selectedClass);
    return () => { requestRef.current?.abort(); requestRef.current = null; };
  }, [selectedClass?.id, rangeDays, user?.id]);

  const learnerRows = useMemo(() => {
    if (!data) return [];
    return data.memberships.map((membership) => {
      const profile = data.profiles.find((item) => item.user_id === membership.user_id);
      const sessions = data.sessions.filter((session) => session.user_id === membership.user_id);
      const events = data.events.filter((event) => event.user_id === membership.user_id);
      const listeningRecords = data.listeningRecords.filter((record) => record.user_id === membership.user_id && record.learning_archive);
      const activeDays = new Set(events.filter(isLearningAction).map((event) => localDateKey(event.occurred_at)));
      return {
        membership: { ...membership, research_id: membership.research_id || profile?.research_id || null },
        profile,
        sessions,
        events,
        listeningRecords,
        activeDays,
        lastActive: events[0]?.occurred_at || sessions[0]?.last_active_at || null,
      };
    });
  }, [data]);

  const filteredLearners = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-CN');
    if (!normalized) return learnerRows;
    return learnerRows.filter((row) => [
      row.profile?.display_name,
      row.membership.student_number,
      row.membership.research_id,
    ].some((value) => value?.toLocaleLowerCase('zh-CN').includes(normalized)));
  }, [learnerRows, query]);

  const selectedLearner = learnerRows.find((row) => row.membership.user_id === selectedUserId) ?? null;
  const learningEvents = data?.events.filter((event) => event.module !== 'system') ?? [];
  const activeLearners = new Set(learningEvents.filter(isLearningAction).map((event) => event.user_id)).size;
  const returningLearners = learnerRows.filter((row) => row.activeDays.size >= 2).length;
  const experienceErrors = data?.events.filter((event) => ['lookup_failed', 'media_error', 'request_timeout'].includes(event.event_type)).length ?? 0;
  const listeningArchiveCount = data?.listeningRecords.filter((record) => record.learning_archive).length ?? 0;

  const moduleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    learningEvents.forEach((event) => counts.set(event.module, (counts.get(event.module) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [learningEvents]);
  const maxModuleCount = Math.max(1, ...moduleCounts.map(([, count]) => count));

  const exportSummary = () => {
    const rows: unknown[][] = [[
      '班级', '研究编号', '状态', '活跃天数', '会话数', '已知活跃分钟', '最近使用（北京时间）', '统计天数', '时区',
    ]];
    filteredLearners.filter(row => !selectedUserId || row.membership.user_id === selectedUserId).forEach((row) => rows.push([
      data?.classInfo.name,
      row.membership.research_id,
      row.membership.status,
      row.activeDays.size,
      row.sessions.length,
      '',
      row.lastActive ? formatDateTime(row.lastActive) : '',
      rangeDays, 'Asia/Shanghai',
    ]));
    downloadCsv(`OuiOui_${data?.classInfo.name || '班级'}_${rangeDays}天汇总.csv`, rows);
  };

  const exportEvents = () => {
    if (!data) return;
    const membershipMap = new Map<string, TeacherMembership>(data.memberships.map((item) => [item.user_id, item]));
    const profileMap = new Map<string, LearnerProfile>(data.profiles.map((item) => [item.user_id, item]));
    const includedUsers = new Set(filteredLearners.filter(row => !selectedUserId || row.membership.user_id === selectedUserId).map(row => row.membership.user_id));
    const rows: unknown[][] = [['班级', '研究编号', '发生时间（北京时间）', '模块', '事件', '对象', '会话ID', '事件ID', 'UTC时间', '统计天数']];
    data.events.filter(event => includedUsers.has(event.user_id)).forEach((event) => {
      const membership = membershipMap.get(event.user_id);
      rows.push([
        data.classInfo.name,
        membership?.research_id || profileMap.get(event.user_id)?.research_id,
        formatDateTime(event.occurred_at),
        MODULE_LABELS[event.module] || event.module,
        EVENT_LABELS[event.event_type] || event.event_type,
        event.target_id,
        event.session_id,
        event.id, event.occurred_at, rangeDays,
      ]);
    });
    downloadCsv(`OuiOui_${data.classInfo.name}_${rangeDays}天事件明细.csv`, rows);
  };

  const exportListeningArchives = () => {
    if (!data) return;
    const membershipMap = new Map<string, TeacherMembership>(data.memberships.map((item) => [item.user_id, item]));
    const profileMap = new Map<string, LearnerProfile>(data.profiles.map((item) => [item.user_id, item]));
    const includedUsers = new Set(filteredLearners.filter(row => !selectedUserId || row.membership.user_id === selectedUserId).map(row => row.membership.user_id));
    const rows: unknown[][] = [['班级', '姓名', '学号', '研究编号', '课程', '完成时间（北京时间）', '成绩', '错误归纳', '学习策略', '个人表达']];
    data.listeningRecords.filter(record => includedUsers.has(record.user_id) && record.learning_archive).forEach((record) => {
      const archive = record.learning_archive!;
      const membership = membershipMap.get(record.user_id);
      rows.push([
        data.classInfo.name,
        profileMap.get(record.user_id)?.display_name,
        membership?.student_number,
        membership?.research_id || profileMap.get(record.user_id)?.research_id,
        archive.courseTitle,
        formatDateTime(archive.completedAt),
        archive.scores.map(score => `${score.label} ${score.score}/${score.total}`).join('；'),
        archive.errors.join('；'),
        archive.strategies.join('；'),
        archive.personalExpression || '',
      ]);
    });
    downloadCsv(`OuiOui_${data.classInfo.name}_听力学习档案.csv`, rows);
  };

  if (!authLoading && !user) return <Navigate to="/auth" replace />;
  if (accountError) return <div role="alert" className="py-12 text-sm text-red-600">{accountError}<button type="button" onClick={refreshAccountContext} className="ml-3 underline">重新加载</button></div>;
  if (!accountLoading && accountContext && accountContext.profile?.role !== 'teacher') return <Navigate to="/account" replace />;

  if (authLoading || accountLoading || !accountContext) {
    return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm font-bold text-gray-400"><Loader2 className="h-5 w-5 animate-spin" />正在验证教师权限</div>;
  }

  return (
    <div className="py-7 md:py-10">
      <header className="flex flex-col gap-5 border-b border-gray-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary"><GraduationCap className="h-5 w-5" /><span className="text-sm font-black">OuiOui 教师端</span></div>
          <h1 className="mt-2 text-3xl font-black text-gray-800">班级学习概况</h1>
          <p className="mt-2 text-sm text-gray-500">数据按北京时间统计，未登录使用不会归入具体学生。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportSummary} disabled={!data} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-black text-gray-600 disabled:opacity-40"><Download className="h-4 w-4" />导出汇总</button>
          <button type="button" onClick={exportEvents} disabled={!data} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gray-800 px-4 text-sm font-black text-white disabled:opacity-40"><Download className="h-4 w-4" />导出明细</button>
          <button type="button" onClick={exportListeningArchives} disabled={!data || listeningArchiveCount === 0} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-white disabled:opacity-40"><Download className="h-4 w-4" />导出听力档案</button>
        </div>
      </header>

      <section className="mt-5 flex flex-wrap items-end gap-3 border-b border-gray-100 pb-5">
        <label className="text-xs font-black text-gray-500">班级<select value={selectedClass?.id || ''} onChange={(event) => { setSelectedClassId(event.target.value); setSelectedUserId(null); }} className="mt-1 block h-11 min-w-52 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700">{teachingClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="text-xs font-black text-gray-500">统计范围<div className="mt-1 flex h-11 rounded-lg border border-gray-200 bg-white p-1">{[7, 14, 28].map((days) => <button key={days} type="button" onClick={() => setRangeDays(days)} className={`min-w-14 rounded-md px-2 text-sm ${rangeDays === days ? 'bg-primary text-white' : 'text-gray-500'}`}>{days}天</button>)}</div></div>
        <button type="button" onClick={() => selectedClass && loadData(selectedClass)} disabled={loading || !selectedClass} title="刷新数据" className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </section>

      {error && <div className="mt-5 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm font-bold text-red-600"><AlertTriangle className="h-5 w-5" />{error}</div>}
      {!selectedClass && <div className="mt-8 border-l-4 border-amber-400 bg-amber-50 p-5 text-sm text-amber-900">当前教师账号还没有可管理的班级。</div>}

      {selectedClass && (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              [UsersRound, '活跃学习者', activeLearners, `班级共 ${data?.memberships.length ?? 0} 人`],
              [CalendarDays, '跨日回访', returningLearners, `最近 ${rangeDays} 天`],
              [Clock3, '学习会话', data?.sessions.length ?? 0, '真实会话记录'],
              [BookOpenCheck, '听力档案', listeningArchiveCount, '已完成课程'],
              [AlertTriangle, '体验异常', experienceErrors, '失败与超时事件'],
            ].map(([Icon, label, value, note]) => {
              const MetricIcon = Icon as typeof UsersRound;
              return <div key={String(label)} className="border-l-4 border-primary bg-white px-4 py-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-black text-gray-400"><MetricIcon className="h-4 w-4" />{String(label)}</div><strong className="mt-2 block text-3xl font-black text-gray-800">{String(value)}</strong><span className="mt-1 block text-xs text-gray-400">{String(note)}</span></div>;
            })}
          </section>

          <section className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.7fr)]">
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-lg font-black text-gray-800">学习者</h2><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="姓名、学号或研究编号" className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-primary sm:w-64" /></label></div>
              <div className="mt-3 overflow-x-auto border border-gray-100 bg-white">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-400"><tr><th className="px-4 py-3">学习者</th><th className="px-4 py-3">研究编号</th><th className="px-4 py-3">活跃天数</th><th className="px-4 py-3">会话</th><th className="px-4 py-3">听力档案</th><th className="px-4 py-3">最近使用</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody className="divide-y divide-gray-100">{filteredLearners.map((row) => <tr key={row.membership.user_id}><td className="px-4 py-3"><strong className="block text-gray-800">{row.profile?.display_name || '未填写姓名'}</strong><span className="text-xs text-gray-400">{row.membership.student_number || '未填写学号'}</span></td><td className="px-4 py-3 font-mono text-xs text-gray-500">{row.membership.research_id || '待分配'}</td><td className="px-4 py-3 font-black text-gray-700">{row.activeDays.size}</td><td className="px-4 py-3 text-gray-600">{row.sessions.length}</td><td className="px-4 py-3 font-black text-primary">{row.listeningRecords.length}</td><td className="px-4 py-3 text-xs text-gray-500">{row.lastActive ? formatDateTime(row.lastActive) : '暂无记录'}</td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedUserId(row.membership.user_id)} className="min-h-9 rounded-md px-3 text-xs font-black text-primary hover:bg-indigo-50">查看时间线</button></td></tr>)}</tbody>
                </table>
                {!loading && filteredLearners.length === 0 && <p className="p-8 text-center text-sm text-gray-400">当前范围内没有匹配的学习者</p>}
              </div>
            </div>

            <aside>
              <h2 className="text-lg font-black text-gray-800">功能动作分布</h2>
              <div className="mt-3 space-y-4 border border-gray-100 bg-white p-4">{moduleCounts.map(([module, count]) => <div key={module}><div className="mb-1 flex justify-between text-xs font-bold text-gray-500"><span>{MODULE_LABELS[module] || module}</span><span>{count}</span></div><div className="h-2 bg-gray-100"><div className="h-2 bg-primary" style={{ width: `${Math.max(4, (count / maxModuleCount) * 100)}%` }} /></div></div>)}{moduleCounts.length === 0 && <p className="py-8 text-center text-sm text-gray-400">尚无学习动作</p>}</div>
              <div className="mt-4 border-l-4 border-amber-400 bg-amber-50 p-4 text-xs leading-5 text-amber-900">动作次数不等于学习时长，也不能直接判断学习能力或兴趣。</div>
            </aside>
          </section>
        </>
      )}

      {selectedLearner && <LearnerTimeline learner={selectedLearner} onClose={() => setSelectedUserId(null)} />}
    </div>
  );
};

interface LearnerTimelineProps {
  learner: {
    membership: TeacherMembership;
    profile: { display_name: string | null } | undefined;
    sessions: TeacherSession[];
    events: TeacherEvent[];
    listeningRecords: TeacherListeningRecord[];
    activeDays: Set<string>;
    lastActive: string | null;
  };
  onClose: () => void;
}

const LearnerTimeline: React.FC<LearnerTimelineProps> = ({ learner, onClose }) => {
  const sessionMap = new Map<string, TeacherSession>(learner.sessions.map((session) => [session.id, session]));
  return <section className="mt-8 border-t border-gray-200 pt-7">
    <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-1 text-sm font-black text-primary"><ChevronLeft className="h-4 w-4" />返回班级概况</button>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black text-gray-400">学习者时间线</p><h2 className="mt-1 text-2xl font-black text-gray-800">{learner.profile?.display_name || '未填写姓名'}</h2><p className="mt-1 text-sm text-gray-500">研究编号：{learner.membership.research_id || '待分配'} · 学号：{learner.membership.student_number || '未填写'}</p></div><div className="flex gap-4 text-sm text-gray-500"><span><strong className="text-gray-800">{learner.activeDays.size}</strong> 活跃天</span><span><strong className="text-gray-800">{learner.sessions.length}</strong> 次会话</span><span><strong className="text-gray-800">{learner.listeningRecords.length}</strong> 份听力档案</span></div></div>

    {learner.listeningRecords.length > 0 && <section className="mt-6"><h3 className="flex items-center gap-2 text-lg font-black text-gray-800"><BookOpenCheck className="h-5 w-5 text-primary" />听力学习档案</h3><div className="mt-3 grid gap-4 lg:grid-cols-2">{learner.listeningRecords.map((record) => {
      const archive = record.learning_archive!;
      return <article key={record.course_id} className="rounded-lg border border-gray-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><h4 className="font-black text-gray-800">{archive.courseTitle}</h4><time className="text-xs text-gray-400">{formatDateTime(archive.completedAt)}</time></div><div className="mt-3 flex flex-wrap gap-2">{archive.scores.map((score) => <span key={score.label} className="rounded-md bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-gray-600">{score.label} {score.score}/{score.total}</span>)}</div><p className="mt-3 text-sm leading-6 text-gray-600"><strong className="text-gray-800">错误归纳：</strong>{archive.errors.length ? archive.errors.join('；') : '本次练习全部正确。'}</p>{archive.strategies.length > 0 && <p className="mt-2 text-sm leading-6 text-gray-600"><strong className="text-gray-800">学习策略：</strong>{archive.strategies.join('；')}</p>}{archive.personalExpression && <div className="mt-3 border-l-4 border-primary bg-indigo-50 px-3 py-2 text-sm leading-6 text-gray-700"><strong className="block text-xs text-primary">个人表达</strong>{archive.personalExpression}</div>}</article>;
    })}</div></section>}

    <section className="mt-7"><h3 className="text-lg font-black text-gray-800">学习事件</h3><div className="mt-3 space-y-3">{learner.events.map((event) => { const session = sessionMap.get(event.session_id); return <article key={event.id} className="grid gap-2 border-l-4 border-gray-200 bg-white px-4 py-3 sm:grid-cols-[130px_1fr_auto]"><time className="text-xs font-bold text-gray-400">{formatDateTime(event.occurred_at)}</time><div><strong className="text-sm text-gray-800">{EVENT_LABELS[event.event_type] || event.event_type}</strong><p className="mt-1 text-xs text-gray-400">{MODULE_LABELS[event.module] || event.module}{event.target_id ? ` · ${event.target_id}` : ''}</p></div><span className="inline-flex items-center gap-1 text-xs text-gray-400"><MonitorSmartphone className="h-4 w-4" />{session?.site === 'domestic' ? '国内站' : session?.site === 'backup' ? '备用站' : session?.site === 'local' ? '本地' : '来源未知'} · {session?.device_category || '未知设备'}</span></article>; })}{learner.events.length === 0 && <p className="border border-gray-100 bg-white p-8 text-center text-sm text-gray-400">当前时间范围内没有学习事件</p>}</div></section>
  </section>;
};

export default TeacherDashboardView;
