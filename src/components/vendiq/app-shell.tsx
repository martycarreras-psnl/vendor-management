import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  ShieldCheck,
  Sparkles,
  Settings,
  Search,
  AppWindow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectivityPill } from '@/components/vendiq/connectivity-pill';
import { useState, type KeyboardEvent } from 'react';
import vendiqIconMarkup from '@/assets/vendiq_icon.svg?raw';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/vendors', label: 'Vendors', icon: Users, end: false },
  { to: '/contracts', label: 'Contracts', icon: FileText, end: false },
  { to: '/risk', label: 'Risk', icon: ShieldCheck, end: false },
  { to: '/chat', label: 'Ask vendIQ', icon: Sparkles, end: false },
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
    <div className="min-h-dvh flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-4 bg-sidebar px-4 text-sidebar-foreground">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center [&>svg]:h-7 [&>svg]:w-7 [&>svg]:rounded"
            aria-label="VendIQ"
            dangerouslySetInnerHTML={{ __html: vendiqIconMarkup }}
          />
          <span className="text-sm font-semibold">Radiology Partners</span>
          <span className="text-sm opacity-60">|</span>
          <span className="text-sm opacity-80">Vendor Management</span>
        </div>
        <div className="mx-auto w-full max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden />
            <input
              placeholder="Search vendors, contracts, aliases…"
              className="h-8 w-full rounded-full border border-white/10 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/60 outline-none focus:border-white/30 focus:bg-white/15"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={onSearchKey}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://m365.cloud.microsoft/"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:border-white/30 hover:bg-white/15"
            title="Open Microsoft 365 in a new tab"
          >
            <AppWindow className="h-3.5 w-3.5" aria-hidden />
            Microsoft 365
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Expanded sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
          <nav className="flex-1 p-2 pt-3">
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
          <div className="mt-auto flex flex-col gap-2 border-t border-sidebar-border p-3">
            <ConnectivityPill />
            <div className="text-[11px] opacity-70">v0.1 · Code App · Dev</div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
