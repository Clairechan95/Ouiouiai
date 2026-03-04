
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Book, PenTool, GraduationCap, Languages } from 'lucide-react';
import { useAppContext } from '../App';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { notebook } = useAppContext();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayCount = notebook.filter(item => item.createdAt >= todayStart).length;

  const navItems = [
    { path: '/', icon: Search, label: '智能查词' },
    { path: '/notebook', icon: Book, label: '生词本' },
    { path: '/conjugation', icon: Languages, label: '变位练习' },
    { path: '/practice', icon: PenTool, label: '创意听写' },
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
            const isActive = location.pathname === item.path;
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
                <item.icon className={`w-5 h-5 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} />
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
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col relative overflow-x-hidden">
        <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pb-20 sm:pb-24 md:pb-10">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation (Visible only on small screens) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 py-3 px-8 flex justify-between items-center z-50 rounded-t-3xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                isActive ? 'text-primary scale-110' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
