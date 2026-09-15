import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BarChart3, CheckCircle2, GraduationCap, Hash, Loader2, Mail, Save, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { useAppContext } from '../App';
import { joinClassByInvite, updateMyProfile } from '../services/classService';

const AccountView: React.FC = () => {
  const { user, authLoading, accountContext, accountLoading, accountError, refreshAccountContext } = useAppContext();
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDisplayName(accountContext?.profile?.display_name || String(user?.user_metadata?.display_name ?? ''));
  }, [accountContext?.profile?.display_name, user?.user_metadata?.display_name]);

  const activeMemberships = useMemo(
    () => accountContext?.memberships.filter((membership) => membership.status === 'active') ?? [],
    [accountContext?.memberships],
  );

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const classFor = (membership: (typeof activeMemberships)[number]) => {
    if (Array.isArray(membership.classes)) return membership.classes[0] ?? null;
    return membership.classes;
  };

  const saveProfile = async () => {
    if (!displayName.trim()) return;
    setSavingProfile(true);
    setError('');
    setMessage('');
    try {
      await updateMyProfile(displayName.trim());
      await refreshAccountContext();
      setMessage('个人资料已更新');
    } catch {
      setError('资料暂时无法保存，请稍后重试');
    } finally {
      setSavingProfile(false);
    }
  };

  const joinClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteCode.trim()) return;
    setJoining(true);
    setError('');
    setMessage('');
    try {
      const result = await joinClassByInvite(inviteCode, displayName, studentNumber);
      await refreshAccountContext();
      setInviteCode('');
      setMessage(`已加入“${result?.class_name || '班级'}”`);
    } catch (joinError: any) {
      const detail = String(joinError?.message || '');
      setError(detail.includes('Invalid class invite code') ? '邀请码无效，请向教师确认后重试' : '暂时无法加入班级，请稍后重试');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-8 md:py-12">
      <header className="border-b border-gray-100 pb-6">
        <div className="flex items-center gap-2 text-primary">
          <UserRound className="h-5 w-5" />
          <span className="text-sm font-black">账号与班级</span>
        </div>
        <h1 className="mt-2 text-3xl font-black text-gray-800">我的账号</h1>
      </header>

      {accountError && <div role="alert" className="mt-4 text-sm text-red-600">{accountError}<button type="button" onClick={refreshAccountContext} className="ml-3 underline">重新加载</button></div>}

      {(accountLoading || authLoading) && !accountContext ? (
        <div className="flex min-h-64 items-center justify-center gap-2 text-sm font-bold text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />正在读取账号信息
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {(message || error) && (
            <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
              {!error && <CheckCircle2 className="h-4 w-4" />}
              {error || message}
            </div>
          )}

          <section className="border-b border-gray-100 pb-8">
            <h2 className="text-lg font-black text-gray-800">个人资料</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-gray-600">
                <span className="mb-2 flex items-center gap-2"><Mail className="h-4 w-4 text-gray-400" />登录邮箱</span>
                <input value={user?.email || ''} disabled className="h-12 w-full rounded-lg border border-gray-100 bg-gray-50 px-4 text-gray-400" />
              </label>
              <label className="block text-sm font-bold text-gray-600">
                <span className="mb-2 flex items-center gap-2"><UserRound className="h-4 w-4 text-gray-400" />姓名或常用称呼</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} className="h-12 w-full rounded-lg border border-gray-200 bg-white px-4 outline-none focus:border-primary focus:ring-2 focus:ring-indigo-100" />
              </label>
            </div>
            <button type="button" onClick={saveProfile} disabled={savingProfile || !displayName.trim()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-black text-white disabled:bg-gray-200">
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存资料
            </button>
          </section>

          <section>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-gray-800">班级信息</h2>
                <p className="mt-1 text-sm text-gray-500">加入班级后，任课教师可查看你的查词、练习及听力学习记录。</p>
              </div>
              {accountContext?.profile?.role === 'teacher' && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-primary">
                    <ShieldCheck className="h-4 w-4" />教师账号
                  </span>
                  <Link to="/teacher" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gray-800 px-4 text-xs font-black text-white">
                    <BarChart3 className="h-4 w-4" />进入教师端
                  </Link>
                </div>
              )}
            </div>

            {accountContext?.teachingClasses.map((classItem) => (
              <div key={classItem.id} className="mt-4 border-l-4 border-primary bg-indigo-50/60 px-4 py-4">
                <div className="flex items-center gap-2 font-black text-gray-800"><GraduationCap className="h-5 w-5 text-primary" />{classItem.name}</div>
                <p className="mt-2 text-sm text-gray-500">班级邀请码：<strong className="select-all font-mono text-gray-800">{classItem.invite_code}</strong></p>
              </div>
            ))}

            {activeMemberships.map((membership) => {
              const classItem = classFor(membership);
              return (
                <div key={membership.class_id} className="mt-4 border-l-4 border-emerald-400 bg-emerald-50/60 px-4 py-4">
                  <div className="flex items-center gap-2 font-black text-gray-800"><UsersRound className="h-5 w-5 text-emerald-600" />{classItem?.name || '已加入班级'}</div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
                    {membership.student_number && <span>学号：{membership.student_number}</span>}
                    {membership.research_id && <span>研究编号：{membership.research_id}</span>}
                  </div>
                </div>
              );
            })}

            <form onSubmit={joinClass} className="mt-6 grid gap-3 border-t border-gray-100 pt-6 sm:grid-cols-[1fr_1fr_auto]">
              <label className="block text-sm font-bold text-gray-600">
                <span className="mb-2 flex items-center gap-2"><UsersRound className="h-4 w-4 text-gray-400" />班级邀请码</span>
                <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} required maxLength={20} className="h-12 w-full rounded-lg border border-gray-200 px-4 font-mono uppercase outline-none focus:border-primary focus:ring-2 focus:ring-indigo-100" />
              </label>
              <label className="block text-sm font-bold text-gray-600">
                <span className="mb-2 flex items-center gap-2"><Hash className="h-4 w-4 text-gray-400" />学号（选填）</span>
                <input value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} maxLength={40} className="h-12 w-full rounded-lg border border-gray-200 px-4 outline-none focus:border-primary focus:ring-2 focus:ring-indigo-100" />
              </label>
              <button type="submit" disabled={joining || !inviteCode.trim()} className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gray-800 px-5 text-sm font-black text-white disabled:bg-gray-200">
                {joining && <Loader2 className="h-4 w-4 animate-spin" />}加入班级
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default AccountView;
