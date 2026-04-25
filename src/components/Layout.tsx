import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, GitBranch, Activity } from 'lucide-react';
import { cn } from '../utils/cn';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/engineers', icon: Users, label: 'Engineers' },
  { to: '/activity', icon: Activity, label: 'Activity' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout() {
  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 md:w-56 flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-slate-700 gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center flex-shrink-0">
            <GitBranch size={16} className="text-white" />
          </div>
          <span className="hidden md:block font-semibold text-sm text-slate-100 leading-tight">
            Git Metrics
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-sky-500/20 text-sky-400 font-medium'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700',
                )
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="hidden md:block">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700">
          <p className="hidden md:block text-xs text-slate-500 text-center">Gitea Analytics</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
