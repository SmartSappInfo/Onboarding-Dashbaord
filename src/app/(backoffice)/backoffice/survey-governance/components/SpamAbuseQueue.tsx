/**
 * @fileoverview Survey Spam & Bot Abuse Moderation Queue Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Table for inspecting flagged spam survey submissions.
 * - Allows purging spam via `purgeSpamSubmissionAction` and unflagging via `unflagSubmissionAction`.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import { ShieldAlert, Trash2, CheckCircle, CheckCircle2, Loader2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { useBackoffice } from '../../context/BackofficeProvider';
import {
  purgeSpamSubmissionAction,
  unflagSubmissionAction,
} from '@/lib/backoffice/backoffice-survey-actions';
import type { FlaggedSurveySubmission } from '@/lib/backoffice/backoffice-types';

interface SpamAbuseQueueProps {
  readonly flaggedSubmissions: FlaggedSurveySubmission[];
  readonly onRefresh: () => void;
}

export default function SpamAbuseQueue({
  flaggedSubmissions,
  onRefresh,
}: SpamAbuseQueueProps) {
  const { can } = useBackoffice();
  const getToken = useBackofficeToken();
  const { toast } = useToast();

  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const handlePurge = async (subId: string) => {
    setProcessingId(subId);
    try {
      const idToken = await getToken();
      const res = await purgeSpamSubmissionAction(subId, idToken);

      if (res.success) {
        toast({ title: 'Spam Purged', description: 'Submission permanently removed.' });
        onRefresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Purge Failed',
          description: res.error || 'Failed to purge submission.',
        });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to purge spam.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnflag = async (subId: string) => {
    setProcessingId(subId);
    try {
      const idToken = await getToken();
      const res = await unflagSubmissionAction(subId, idToken);

      if (res.success) {
        toast({ title: 'Submission Verified', description: 'Submission marked as authentic.' });
        onRefresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Unflag Failed',
          description: res.error || 'Failed to unflag submission.',
        });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to unflag submission.' });
    } finally {
      setProcessingId(null);
    }
  };

  if (flaggedSubmissions.length === 0) {
    return (
      <div className="p-12 rounded-2xl border border-border bg-card text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-foreground">Zero Spam Submissions</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          No automated bots, flood attempts, or rate-limited submissions detected.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs font-bold uppercase tracking-wider py-4">Survey Form</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Origin IP</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Detection Flag</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Content Snippet</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flaggedSubmissions.map((sub) => (
              <TableRow key={sub.id} className="border-border/60 hover:bg-muted/40 transition-colors">
                <TableCell className="py-4">
                  <div>
                    <span className="font-bold text-xs text-foreground block">{sub.surveyTitle}</span>
                    <span className="text-[11px] text-muted-foreground">{sub.organizationName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {sub.ipAddress}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] rounded-lg border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10">
                    {sub.reason}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p className="font-mono text-[11px] text-muted-foreground line-clamp-1 max-w-xs">
                    {sub.contentSnippet}
                  </p>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex items-center justify-end gap-1.5">
                    {can('survey_governance', 'edit') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnflag(sub.id)}
                        disabled={processingId === sub.id}
                        className="h-8 px-2.5 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 active:scale-[0.97] gap-1"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Restore</span>
                      </Button>
                    )}

                    {can('survey_governance', 'execute') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePurge(sub.id)}
                        disabled={processingId === sub.id}
                        className="h-8 px-2.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:scale-[0.97] gap-1"
                      >
                        {processingId === sub.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        <span>Purge</span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
