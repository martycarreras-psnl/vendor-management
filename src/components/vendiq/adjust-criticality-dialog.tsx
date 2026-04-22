import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useVendiq } from '@/services/vendiq/provider-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DataverseFieldLabel } from '@/components/ui/dataverse-field-label';
import { CRITICALITY_META } from '@/components/vendiq/criticality-pill';
import type { CriticalityLevel } from '@/types/vendiq';
import { cn } from '@/lib/utils';

export function AdjustCriticalityDialog({
  open,
  onOpenChange,
  vendorId,
  vendorName,
  currentLevel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vendorId: string;
  vendorName: string;
  currentLevel: CriticalityLevel | undefined;
}) {
  const provider = useVendiq();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<CriticalityLevel | undefined>(currentLevel);
  const [comment, setComment] = useState('');
  const disabled = !selected || comment.trim().length < 10;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a criticality level.');
      return provider.serviceNowAssessments.adjustCriticality({
        vendorId,
        level: selected,
        comment: comment.trim(),
      });
    },
    onSuccess: () => {
      toast.success(`${vendorName}: criticality set to ${selected} · ${selected ? CRITICALITY_META[selected].label : ''}`);
      queryClient.invalidateQueries({ queryKey: ['vendiq'] });
      setComment('');
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to adjust criticality.'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Criticality</DialogTitle>
          <DialogDescription>
            Write to the latest ServiceNow criticality assessment for <strong>{vendorName}</strong>.
            A new assessment is created if none exists.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Level</div>
            <div className="grid grid-cols-5 gap-2">
              {([1, 2, 3, 4, 5] as CriticalityLevel[]).map((lvl) => {
                const meta = CRITICALITY_META[lvl];
                const active = selected === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelected(lvl)}
                    className={cn(
                      'rounded-md border px-2 py-3 text-center transition-colors',
                      active ? 'border-primary ring-2 ring-primary' : 'border-border hover:bg-muted',
                      meta.bg,
                    )}
                  >
                    <div className={cn('text-lg font-bold', meta.text)}>{lvl}</div>
                    <div className="text-[10px] text-muted-foreground">{meta.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <DataverseFieldLabel
              htmlFor="adjust-crit-comment"
              required
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Reason / comment
            </DataverseFieldLabel>
            <Textarea
              id="adjust-crit-comment"
              placeholder="Document rationale (required, minimum 10 characters)…"
              value={comment}
              aria-required
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={disabled || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save criticality'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
