
import React, { Suspense, lazy, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Book, PenTool, GraduationCap, Languages, AlertCircle, Headphones, LogIn, LogOut, User, Volume2 } from 'lucide-react';
import { useAppContext } from '../App';
const VoiceCheckModal = lazy(() => import('./VoiceCheckModal'));

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isListeningRoute = location.pathname.startsWith('/listening');
  const { notebook, wrongAnswers, user, signOut } = useAppContext();
  const unmasteredCount = wrongAnswers.filter(w => !w.mastered).length;
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayCount = notebook.filter(item => item.createdAt >= todayStart).length;

  const navItems = [
    { path: '/', icon: Search, label: '智能查词', badge: 0 },
    { path: '/listening', icon: Headphones, label: '听力实战', badge: 0 },
    { path: '/notebook', icon: Book, label: '生词本', badge: 0 },
    { path: '/conjugation', icon: Languages, label: '变位练习', badge: 0 },
    { path: '/practice', icon: PenTool, label: '创意听写', badge: 0 },
    { path: '/wrong-answers', icon: AlertCircle, label: '错题本', badge: unmasteredCount },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar (Visible on md and up) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 sticky top-0 h-screen z-50">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <GraduationCap className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-800">OuiOui AI</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = item.path === '/listening' ? location.pathname.startsWith('/listening') : location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group ${
                  isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-primary'
                }`}
              >
                <div className="relative">
                  <item.icon className={`w-5 h-5 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6">
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-2xl border border-indigo-100/50">
            <p className="text-xs font-bold text-indigo-400 uppercase mb-1">学习进度</p>
            <p className="text-sm text-indigo-900 font-medium">今天已收藏 {todayCount} 个新词</p>
          </div>
          <button
            onClick={() => setVoiceModalOpen(true)}
            className="mt-3 w-full flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <Volume2 className="w-4 h-4" />
            <span className="text-sm font-bold">语音检测</span>
          </button>
        </div>

        {/* User section */}
        <div className="px-4 pb-6 border-t border-gray-100 pt-4">
          {user ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-gray-500 flex-1 truncate">{user.email}</span>
              <button
                onClick={signOut}
                title="退出登录"
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-2 w-full px-4 py-2.5 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span className="text-sm font-bold">登录 / 注册</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col relative overflow-x-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
              <GraduationCap className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-gray-800">OuiOui AI</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceModalOpen(true)}
              className="flex items-center justify-center w-8 h-8 text-amber-600 bg-amber-50 rounded-full"
              title="语音检测"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            {user ? (
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-red-50 hover:text-red-500 px-3 py-1.5 rounded-full transition-colors"
              >
                <User className="w-3 h-3" />
                <span className="max-w-[80px] truncate">{user.email?.split('@')[0]}</span>
                <LogOut className="w-3 h-3" />
              </button>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full font-bold transition-colors"
              >
                <LogIn className="w-3 h-3" />
                登录
              </Link>
            )}
          </div>
        </div>

        <div className={`flex-1 w-full mx-auto px-4 sm:px-6 md:px-8 pb-20 sm:pb-24 md:pb-10 ${isListeningRoute ? 'max-w-7xl' : 'max-w-4xl'}`}>
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation (Visible only on small screens) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 pt-3 px-3 pb-3 mobile-nav-safe flex justify-between items-center z-50 rounded-t-3xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)]" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        {navItems.map((item) => {
          const isActive = item.path === '/listening' ? location.pathname.startsWith('/listening') : location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                isActive ? 'text-primary scale-110' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="relative">
                <item.icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {voiceModalOpen && (
        <Suspense fallback={null}>
          <VoiceCheckModal onClose={() => setVoiceModalOpen(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default Layout;
