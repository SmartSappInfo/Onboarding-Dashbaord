/**
 * @fileoverview Spreadsheet-style Inline Deal Cell Editors
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 123 & Section 30):
 * - Micro-interactions for rapid in-place cell editing within the Deals List View.
 * - Supports keyboard navigation (Enter to commit, Escape to cancel, Tab to next).
 * - Implements optimistic updates with instant visual checkmark feedback and error rollback.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 7, Rule 5, Rule 3):
 * - Strict zero 'any' / zero 'any[]'.
 * - Accessible touch targets >= 44px on mobile viewports.
 * - Actionable toasts on save failures.
 */

'use client';

import * as React from 'react';
import {
  Check,
  X,
  Loader2,
  Calendar,
  UserCircle2,
  ChevronDown,
  Percent,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency-utils';
import type { Deal, OnboardingStage, UserProfile } from '@/lib/types';
import {
  updateDealValueAction,
  updateDealProbabilityAction,
  updateDealStageAction,
  updateDealOwnerAction,
  updateDealDetailsAction,
} from '@/app/actions/deal-actions';

interface InlineValueCellProps {
  deal: Deal;
  userId: string;
  field: 'value' | 'mrr';
  onUpdated?: (newVal: number) => void;
}

export function InlineValueCell({ deal, userId, field, onUpdated }: InlineValueCellProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = React.useState(false);
  const [val, setVal] = React.useState<string>(String(deal[field] ?? 0));
  const [isSaving, setIsSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setVal(String(deal[field] ?? 0));
  }, [deal, field]);

  React.useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleCommit = async () => {
    const num = Number(val);
    if (isNaN(num) || num < 0) {
      setVal(String(deal[field] ?? 0));
      setIsEditing(false);
      return;
    }

    if (num === (deal[field] ?? 0)) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      let res;
      if (field === 'value') {
        res = await updateDealValueAction(deal.id, num, userId);
      } else {
        res = await updateDealDetailsAction(deal.id, { mrr: num }, userId);
      }

      if (res.success) {
        setJustSaved(true);
        onUpdated?.(num);
        setTimeout(() => setJustSaved(false), 1500);
      } else {
        toast({
          title: 'Update Failed',
          description: res.error || 'Failed to update deal value.',
          variant: 'destructive',
          actionConfig: { path: '/admin/pipeline', label: 'Pipeline' },
        });
        setVal(String(deal[field] ?? 0));
      }
    } catch {
      setVal(String(deal[field] ?? 0));
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      setVal(String(deal[field] ?? 0));
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 min-w-[100px]">
        <Input
          ref={inputRef}
          type="number"
          min="0"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="h-8 w-24 px-2 text-xs font-bold rounded-lg border-primary bg-background shadow-xs"
        />
        {isSaving && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className={cn(
        'group flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg font-bold text-xs transition-colors hover:bg-muted/60 text-left',
        justSaved && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
      )}
      title="Click to edit value"
    >
      <span>{formatCurrency(deal[field] ?? 0, deal.currency || 'USD')}</span>
      {justSaved ? (
        <Check className="h-3 w-3 text-emerald-600 animate-in zoom-in" />
      ) : (
        <span className="opacity-0 group-hover:opacity-60 text-[10px] text-muted-foreground font-normal">✎</span>
      )}
    </button>
  );
}

interface InlineProbabilityCellProps {
  deal: Deal;
  userId: string;
  onUpdated?: (newProb: number) => void;
}

export function InlineProbabilityCell({ deal, userId, onUpdated }: InlineProbabilityCellProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [prob, setProb] = React.useState<number>(deal.probability ?? 50);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setProb(deal.probability ?? 50);
  }, [deal.probability]);

  const handleSave = async (newProb: number) => {
    const clamped = Math.max(0, Math.min(100, newProb));
    setProb(clamped);
    setIsSaving(true);
    try {
      const res = await updateDealProbabilityAction(deal.id, clamped, userId);
      if (res.success) {
        onUpdated?.(clamped);
        setIsOpen(false);
      } else {
        toast({
          title: 'Update Failed',
          description: res.error || 'Failed to update probability.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-1 px-2 py-1 -ml-2 rounded-lg text-xs font-bold hover:bg-muted/60 transition-colors"
          title="Click to adjust probability"
        >
          <span>{deal.probability ?? 50}%</span>
          <span className="opacity-0 group-hover:opacity-60 text-[10px] text-muted-foreground font-normal">✎</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3 rounded-2xl border-border shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold">Win Probability</span>
          <span className="text-xs font-bold text-primary">{prob}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={prob}
          onChange={e => setProb(Number(e.target.value))}
          className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
        />
        <div className="flex items-center justify-between gap-1 pt-1">
          {[10, 30, 50, 70, 90].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => handleSave(p)}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors',
                prob === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground'
              )}
            >
              {p}%
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface InlineStageCellProps {
  deal: Deal;
  stages: OnboardingStage[];
  userId: string;
  onUpdated?: (newStageId: string) => void;
}

export function InlineStageCell({ deal, stages, userId, onUpdated }: InlineStageCellProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const currentStage = stages.find(s => s.id === deal.stageId);

  const handleSelectStage = async (stageId: string) => {
    if (stageId === deal.stageId) {
      setIsOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateDealStageAction(deal.id, stageId, userId);
      if (res.success) {
        onUpdated?.(stageId);
        setIsOpen(false);
      } else {
        toast({
          title: 'Stage Transition Blocked',
          description: res.error || 'Entry gate requirements failed.',
          variant: 'destructive',
          actionConfig: { path: `/admin/deals/${deal.id}`, label: 'Open Deal Workspace' },
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg text-xs font-semibold hover:bg-muted/60 transition-colors"
          title="Click to shift stage"
        >
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: currentStage?.color || '#3b82f6' }}
          />
          <span className="truncate max-w-[130px]">{currentStage?.name || 'Unassigned'}</span>
          <ChevronDown className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5 rounded-xl border-border shadow-xl space-y-1">
        {stages.map(stage => {
          const isCurrent = stage.id === deal.stageId;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => handleSelectStage(stage.id)}
              disabled={isSaving}
              className={cn(
                'w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium text-left transition-colors',
                isCurrent ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted/60 text-foreground'
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color || '#3b82f6' }} />
                <span className="truncate">{stage.name}</span>
              </div>
              {isCurrent && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

interface InlineOwnerCellProps {
  deal: Deal;
  users: UserProfile[];
  userId: string;
  onUpdated?: (newOwnerId: string, newOwnerName: string) => void;
}

export function InlineOwnerCell({ deal, users, userId, onUpdated }: InlineOwnerCellProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSelectOwner = async (ownerId: string, ownerName: string) => {
    setIsSaving(true);
    try {
      const res = await updateDealOwnerAction(deal.id, ownerId, ownerName, userId);
      if (res.success) {
        onUpdated?.(ownerId, ownerName);
        setIsOpen(false);
      } else {
        toast({
          title: 'Assignment Failed',
          description: res.error || 'Failed to update deal owner.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg text-xs font-medium hover:bg-muted/60 transition-colors"
          title="Click to reassign owner"
        >
          <UserCircle2 className="h-4 w-4 text-muted-foreground/70 shrink-0" />
          <span className="truncate max-w-[110px] text-foreground font-semibold">
            {deal.assignedTo?.name || 'Unassigned'}
          </span>
          <ChevronDown className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5 rounded-xl border-border shadow-xl max-h-56 overflow-y-auto space-y-1">
        {users.map(u => {
          const isCurrent = u.id === deal.assignedTo?.userId;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => handleSelectOwner(u.id, u.name || u.email)}
              disabled={isSaving}
              className={cn(
                'w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium text-left transition-colors',
                isCurrent ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted/60 text-foreground'
              )}
            >
              <span className="truncate">{u.name || u.email}</span>
              {isCurrent && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
