/**
 * @fileoverview Propagate Template Dialog
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Allows Super Admins to fan out a platform template to all matching tenant workspaces.
 * - Displays live progress, total targets, and execution status.
 * - Mobile accessible with >= 44px buttons and Emil Kowalski easing animations.
 *
 * @testability Client component consuming `propagateTemplateToWorkspaces`.
 */

'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CheckCircle2, AlertTriangle, Building2, Layers } from 'lucide-react';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { propagateTemplateAction } from '@/lib/backoffice/backoffice-template-actions';
import { getEnabledIndustries } from '@/lib/industry-config';
import type { PlatformTemplate } from '@/lib/backoffice/backoffice-types';

interface PropagateTemplateDialogProps {
  readonly template: PlatformTemplate | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess: () => void;
}

export default function PropagateTemplateDialog({
  template,
  open,
  onOpenChange,
  onSuccess,
}: PropagateTemplateDialogProps) {
  const getToken = useBackofficeToken();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedIndustries, setSelectedIndustries] = React.useState<string[]>([]);
  const [resultSummary, setResultSummary] = React.useState<{
    success: boolean;
    totalUpdated: number;
    totalSkipped: number;
    errors: string[];
  } | null>(null);

  const enabledIndustries = React.useMemo(() => getEnabledIndustries(), []);

  React.useEffect(() => {
    if (open) {
      setSelectedIndustries(template?.visibilityRules?.workspaceTypes || []);
      setResultSummary(null);
    }
  }, [open, template]);

  const toggleIndustry = (industryKey: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(industryKey) ? prev.filter((k) => k !== industryKey) : [...prev, industryKey]
    );
  };

  const handlePropagate = async () => {
    if (!template) return;

    setIsSubmitting(true);
    setResultSummary(null);

    try {
      const idToken = await getToken();
      const res = await propagateTemplateAction(
        template.id,
        {
          industryVerticals: selectedIndustries.length > 0 ? selectedIndustries : undefined,
        },
        idToken
      );

      if (res.success) {
        setResultSummary({
          success: true,
          totalUpdated: res.totalUpdatedWorkspaces,
          totalSkipped: res.totalSkippedWorkspaces,
          errors: res.errors,
        });
        toast({
          title: 'Propagation Complete',
          description: `Successfully updated ${res.totalUpdatedWorkspaces} workspace(s).`,
        });
        onSuccess();
      } else {
        setResultSummary({
          success: false,
          totalUpdated: res.totalUpdatedWorkspaces,
          totalSkipped: res.totalSkippedWorkspaces,
          errors: res.errors,
        });
        toast({
          variant: 'destructive',
          title: 'Propagation Encountered Errors',
          description: res.errors[0] || 'Failed to propagate template.',
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      toast({
        variant: 'destructive',
        title: 'Propagation Failed',
        description: errorMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Propagate Template to Tenants
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Fan out &quot;{template.name}&quot; (v{template.version}) to tenant workspaces.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target Filter Scope */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Target Industries / Verticals
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Select which tenant industries receive this template. Leave empty to target all workspaces.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-1.5 p-3 rounded-xl border border-border bg-muted/20">
              {enabledIndustries.map((ind) => {
                const isChecked = selectedIndustries.includes(ind);
                return (
                  <div
                    key={ind}
                    onClick={() => toggleIndustry(ind)}
                    className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      id={`prop-ind-${ind}`}
                      checked={isChecked}
                      onCheckedChange={() => toggleIndustry(ind)}
                    />
                    <label
                      htmlFor={`prop-ind-${ind}`}
                      className="text-xs font-medium leading-none cursor-pointer select-none"
                    >
                      {ind}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Result Banner */}
          {resultSummary && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                resultSummary.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
              }`}
            >
              {resultSummary.success ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-1">
                <p className="font-semibold">
                  {resultSummary.success ? 'Propagation Successful' : 'Propagation Completed with Warnings'}
                </p>
                <p className="text-muted-foreground">
                  Updated: <span className="font-bold text-foreground">{resultSummary.totalUpdated}</span> workspaces
                  {resultSummary.totalSkipped > 0 && ` • Skipped: ${resultSummary.totalSkipped}`}
                </p>
                {resultSummary.errors.length > 0 && (
                  <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-rose-500">
                    {resultSummary.errors.slice(0, 3).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-11 rounded-xl text-xs font-semibold active:scale-[0.97] transition-all"
          >
            {resultSummary ? 'Close' : 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={handlePropagate}
            disabled={isSubmitting || template.status !== 'published'}
            className="h-11 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.97] transition-all gap-2"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isSubmitting ? 'Propagating...' : 'Push to Workspaces'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
