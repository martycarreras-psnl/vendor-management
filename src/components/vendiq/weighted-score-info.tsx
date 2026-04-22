// Info-icon tooltip that surfaces the locked weighted-score formula text.
// Source of truth: WEIGHTED_SCORE_FORMULA_TEXT in services/vendiq/weighted-score.ts.

import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WEIGHTED_SCORE_FORMULA_TEXT } from '@/services/vendiq/weighted-score';
import { cn } from '@/lib/utils';

export function WeightedScoreInfo({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Weighted score formula"
          className={cn(
            'inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs whitespace-normal text-xs leading-snug">
        {WEIGHTED_SCORE_FORMULA_TEXT}
      </TooltipContent>
    </Tooltip>
  );
}
