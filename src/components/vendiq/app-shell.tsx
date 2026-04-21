import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  ShieldCheck,
  BarChart3,
  Settings,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectivityPill } from '@/components/vendiq/connectivity-pill';
import { ModeToggle } from '@/components/mode-toggle';
import { Input } from '@/components/ui/input';
import { useState, type KeyboardEvent } from 'react';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/vendors', label: 'Vendors', icon: Users, end: false },
  { to: '/contracts', label: 'Contracts', icon: FileText, end: false },
  { to: '/risk', label: 'Risk', icon: ShieldCheck, end: false },
  { to: '/reports', label: 'Reports', icon: BarChart3, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

export function AppShell() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && searchText.trim().length > 0) {
      navigate(`/vendors?q=${encodeURIComponent(searchText.trim())}`);
      setSearchText('');
    }
  }

  return (
    <div className="min-h-dvh grid grid-cols-[auto_1fr] bg-background">
      {/* Sidebar */}
      <aside className="flex min-h-dvh flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground font-bold">V</div>
          <div>
            <div className="text-sm font-semibold leading-tight">VendIQ</div>
            <div className="text-[10px] uppercase tracking-wider opacity-70">Radiology Partners</div>
          </div>
        </div>
        <nav className="flex-1 p-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-[11px] opacity-70">
          v0.1 · Code App · Dev
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-6">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Search vendors, aliases, contracts…"
                className="pl-8"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={onSearchKey}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ConnectivityPill />
            <ModeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
