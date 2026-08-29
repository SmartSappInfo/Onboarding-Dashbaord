'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  RotateCw, 
  Trash2, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Zap, 
  Terminal, 
  Search 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  listAutomationDeadLettersAction, 
  retryAutomationDeadLetterAction, 
  dismissAutomationDeadLetterAction 
} from '@/lib/automations/dead-letter-service';
import type { AutomationDeadLetter } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface AutomationDeadLettersModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  userId: string;
}

/**
 * ARCHITECTURAL POINTER (Dead-Letter Queue Management Console):
 * Allows administrators to inspect automation step execution failures, review error stack traces,
 * inspect trigger payloads, and replay failed actions with 1 click.
 *
 * WORKSPACE RULES & ACCESSIBILITY:
 * - Strict zero 'any' / zero 'any[]'.
 * - Minimum 44px touch targets on all interactive triggers.
 * - Actionable toasts on failure recovery.
 */
export function AutomationDeadLettersModal({
  isOpen,
  onClose,
  workspaceId,
  userId,
}: AutomationDeadLettersModalProps) {
  const { toast } = useToast();
  const [deadLetters, setDeadLetters] = useState<AutomationDeadLetter[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchDeadLetters = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const res = await listAutomationDeadLettersAction(workspaceId, 'pending');
      if (res.success && res.items) {
        setDeadLetters(res.items);
      } else if (res.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to load dead-letter items',
          description: res.error,
          actionConfig: { path: '/admin/automations', label: 'Refresh Automations' },
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Network Error',
        description: 'Failed to load dead-letter items.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, toast]);

  useEffect(() => {
    if (isOpen) {
      void fetchDeadLetters();
    }
  }, [isOpen, fetchDeadLetters]);

  const handleRetry = async (item: AutomationDeadLetter) => {
    setRetryingId(item.id);
    try {
      const res = await retryAutomationDeadLetterAction(item.id, userId);
      if (res.success) {
        toast({
          title: 'Step Replayed Successfully ✓',
          description: `Resumed "${item.nodeLabel || item.actionType || 'Step'}".`,
          actionConfig: { path: `/admin/automations/${item.automationId}`, label: 'View Automation' },
        });
        setDeadLetters(prev => prev.filter(d => d.id !== item.id));
      } else {
        toast({
          variant: 'destructive',
          title: 'Replay execution failed',
          description: res.error || 'The step encountered another error.',
          duration: 10000,
          actionConfig: { path: `/admin/automations/${item.automationId}`, label: 'Edit Workflow' },
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Replay Error',
        description: 'Unexpected error during replay.',
      });
    } finally {
      setRetryingId(null);
    }
  };

  const handleDismiss = async (item: AutomationDeadLetter) => {
    setDismissingId(item.id);
    try {
      const res = await dismissAutomationDeadLetterAction(item.id, userId);
      if (res.success) {
        toast({
          title: 'Item Dismissed',
          description: 'Dead-letter record dismissed.',
        });
        setDeadLetters(prev => prev.filter(d => d.id !== item.id));
      } else {
        toast({
          variant: 'destructive',
          title: 'Dismissal Failed',
          description: res.error,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Dismissal Error',
        description: 'Unexpected error during dismissal.',
      });
    } finally {
      setDismissingId(null);
    }
  };

  const filteredItems = deadLetters.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.automationName?.toLowerCase().includes(q) ||
      item.error?.toLowerCase().includes(q) ||
      item.nodeLabel?.toLowerCase().includes(q) ||
      item.actionType?.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] rounded-3xl p-6 bg-background border border-border/60 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <DialogHeader className="space-y-1.5 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight">
                  Automation Dead-Letter Queue
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Inspect failed workflow step executions and replay them with original context
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-destructive/5 text-destructive border-destructive/20">
              {deadLetters.length} Failed {deadLetters.length === 1 ? 'Step' : 'Steps'}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-3 pt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by automation, error message, or step..."
              className="pl-10 h-10 rounded-xl bg-muted/30 border-border/60 text-xs font-medium"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDeadLetters}
            disabled={isLoading}
            className="h-10 min-h-[44px] px-3.5 rounded-xl border-border/60 font-semibold text-xs active:scale-[0.97]"
          >
            <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6 mt-3">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <RotateCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground/60" />
              <p className="text-xs font-semibold text-muted-foreground">Loading dead-letter items...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold">No Failed Automations</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                All automation triggers and actions are executing cleanly without runtime dead-letters.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {filteredItems.map(item => {
                const isExpanded = expandedId === item.id;
                const isRetrying = retryingId === item.id;
                const isDismissing = dismissingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border/60 bg-card/60 p-4 transition-all hover:border-border hover:shadow-md space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground truncate">
                            {item.automationName}
                          </span>
                          <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5">
                            {item.nodeLabel || item.actionType || 'Action Step'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-destructive font-medium line-clamp-2">
                          {item.error}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRetry(item)}
                          disabled={isRetrying || isDismissing}
                          className="h-9 min-h-[44px] px-3 rounded-xl bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary font-semibold text-xs active:scale-[0.97]"
                        >
                          <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${isRetrying ? 'animate-spin' : ''}`} />
                          Replay
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDismiss(item)}
                          disabled={isRetrying || isDismissing}
                          className="h-9 min-h-[44px] px-2.5 rounded-xl text-muted-foreground hover:text-destructive active:scale-[0.97]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors pt-1 min-h-[44px]"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      <span>{isExpanded ? 'Hide Diagnostics' : 'View Payload & Diagnostics'}</span>
                    </button>

                    {isExpanded && (
                      <div className="space-y-2 pt-2 border-t border-border/40 animate-in fade-in-50 duration-200">
                        {item.errorStack && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                              <Terminal className="h-3 w-3" /> Stack Trace
                            </span>
                            <pre className="p-3 rounded-xl bg-muted/60 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-32 border border-border/40 whitespace-pre-wrap">
                              {item.errorStack}
                            </pre>
                          </div>
                        )}

                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                            <Zap className="h-3 w-3" /> Trigger Payload
                          </span>
                          <pre className="p-3 rounded-xl bg-muted/60 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-32 border border-border/40">
                            {JSON.stringify(item.payload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
