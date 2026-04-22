import { useConnectivity } from '@/hooks/vendiq/use-connectivity';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ConnectivityPill() {
  const { status, refetch } = useConnectivity();

  const config = (() => {
    switch (status.state) {
      case 'connected':
        return {
          label: 'Connected · Dataverse',
          Icon: CheckCircle2,
          bg: 'bg-signal-green/15 text-signal-green border-signal-green/30',
          dot: 'bg-signal-green',
        };
      case 'reconnecting':
        return {
          label: 'Reconnecting',
          Icon: Loader2,
          bg: 'bg-signal-amber/15 text-signal-amber border-signal-amber/30',
          dot: 'bg-signal-amber',
        };
      case 'offline':
        return {
          label: 'Offline',
          Icon: XCircle,
          bg: 'bg-signal-red/15 text-signal-red border-signal-red/30',
          dot: 'bg-signal-red',
        };
      default:
        return {
          label: 'Checking…',
          Icon: Loader2,
          bg: 'bg-muted text-muted-foreground border-border',
          dot: 'bg-muted-foreground',
        };
    }
  })();

  const Icon = config.Icon;
  const lastChecked = status.lastCheckedAt ? new Date(status.lastCheckedAt).toLocaleTimeString() : '—';

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={refetch}
            className={cn(
              'inline-flex w-full items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              config.bg,
            )}
            aria-label={`Dataverse connectivity: ${config.label}`}
          >
            <span className={cn('inline-block h-2 w-2 rounded-full', config.dot)} aria-hidden />
            <Icon className={cn('h-3.5 w-3.5', status.state === 'checking' || status.state === 'reconnecting' ? 'animate-spin' : '')} aria-hidden />
            <span className="truncate">{config.label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-0.5 text-xs">
            <div><strong>State:</strong> {status.state}</div>
            <div><strong>Last probe:</strong> {lastChecked}</div>
            {status.latencyMs !== undefined && <div><strong>Latency:</strong> {status.latencyMs} ms</div>}
            {status.environmentId && <div><strong>Env:</strong> {status.environmentId.slice(0, 8)}…</div>}
            {status.connectionIdSuffix && <div><strong>Conn:</strong> …{status.connectionIdSuffix}</div>}
            {status.error && <div className="text-signal-red"><strong>Error:</strong> {status.error.slice(0, 120)}</div>}
            <div className="pt-1 text-muted-foreground">Click to refresh</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
