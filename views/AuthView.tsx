
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const AuthView: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);

  useEffect(() => {
    if (loginSuccess) {
      const t = setTimeout(() => navigate('/'), 1500);
      return () => clearTimeout(t);
    }
  }, [loginSuccess, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccessMsg('注册成功！请查收验证邮件，点击链接后即可登录。');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setLoginSuccess(true);
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials')) setError('邮箱或密码错误，请重试');
      else if (msg.includes('Email not confirmed')) setError('邮箱尚未验证，请查收验证邮件');
      else if (msg.includes('User already registered')) setError('该邮箱已注册，请直接登录');
      else if (msg.includes('Password should be')) setError('密码至少需要6位');
      else setError(msg || '操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (loginSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-black text-gray-800">登录成功！</h2>
          <p className="text-gray-400 text-sm">正在跳转...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 mb-4">
            <GraduationCap className="text-white w-9 h-9" />
          </div>
          <h1 className="text-2xl font-black text-gray-800">OuiOui AI</h1>
          <p className="text-gray-400 text-sm mt-1">法语智能学习平台</p>
        </div>

        {/* Tab */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-8">
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
                mode === m ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
              }`}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
            <input
              type="email"
              placeholder="邮箱地址"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl text-gray-800 font-medium placeholder-gray-300 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
            <input
              type={showPwd ? 'text' : 'password'}
              placeholder={mode === 'register' ? '设置密码（至少6位）' : '密码'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full pl-12 pr-12 py-4 bg-white border border-gray-100 rounded-2xl text-gray-800 font-medium placeholder-gray-300 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
              <span className="text-red-500 text-lg leading-none">✕</span>
              <p className="text-red-500 text-sm font-medium">{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 px-4 py-3 rounded-xl">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="text-green-600 text-sm font-medium">{successMsg}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'login' ? '登录' : '创建账号'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Skip */}
        <p className="text-center mt-6 text-gray-400 text-sm">
          不登录也可以{' '}
          <a href="#/" className="text-primary font-bold hover:underline">
            直接使用
          </a>
          （数据仅存本地）
        </p>
      </div>
    </div>
  );
};

export default AuthView;
