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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState, type KeyboardEvent } from 'react';
import vendiqIconMarkup from '@/assets/vendiq_icon.svg?raw';

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
          <ConnectivityPill />
          <ModeToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Icon-only sidebar */}
        <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r bg-card py-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium transition-colors',
                        'text-muted-foreground hover:bg-muted hover:text-foreground',
                        isActive && 'bg-primary/10 text-primary',
                      )
                    }
                    aria-label={item.label}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                    <span>{item.label}</span>
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
          <div className="mt-auto text-[9px] text-muted-foreground opacity-70">v0.1</div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
