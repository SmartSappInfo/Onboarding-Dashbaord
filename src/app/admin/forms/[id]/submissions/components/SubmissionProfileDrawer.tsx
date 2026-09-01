'use client';

/**
 * SmartSapp Forms 2.0: Response Center Submission Profile Drawer
 * 
 * Deep respondent intelligence drawer showing form answers, linked CRM entities,
 * automated deal pipelines, lead score breakdown, session attribution, and staff notes.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  User, 
  ExternalLink, 
  Flame, 
  Clock, 
  Globe, 
  Briefcase, 
  CheckSquare, 
  Sparkles,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagSelector } from '@/components/tags/TagSelector';
import { formatFieldValue, parseDateSafe } from '@/lib/forms-utils';
import { updateSubmissionStatusAction } from '@/lib/forms/form-response-actions';
import SubmissionNotesSection from './SubmissionNotesSection';
import SubmissionAiIntelligenceSection from './SubmissionAiIntelligenceSection';
import { useToast } from '@/hooks/use-toast';
import type { Form, FormSubmission } from '@/lib/types';
import type { SubmissionStatus } from '@/lib/forms/form-response-types';
import { cn } from '@/lib/utils';

interface SubmissionProfileDrawerProps {
  submission: FormSubmission | null;
  form: Form;
  onClose: () => void;
  onStatusUpdated?: (submissionId: string, newStatus: SubmissionStatus) => void;
}

function FieldRow({ label, value, type }: { label: string; value: unknown; type?: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-border/30 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground break-words">{formatFieldValue(value, type) || '—'}</span>
    </div>
  );
}

export default function SubmissionProfileDrawer({
  submission,
  form,
  onClose,
  onStatusUpdated,
}: SubmissionProfileDrawerProps) {
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = useState<SubmissionStatus>(
    (submission?.status as SubmissionStatus) || 'new'
  );
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  React.useEffect(() => {
    if (submission?.status) {
      setCurrentStatus(submission.status as SubmissionStatus);
    } else {
      setCurrentStatus('new');
    }
  }, [submission]);

  if (!submission) return null;

  const entityHref = submission.entityId
    ? form.contactScope === 'institution'
      ? `/admin/schools/${submission.entityId}`
      : `/admin/entities/${submission.entityId}`
    : null;

  const handleStatusChange = async (newStatus: SubmissionStatus) => {
    setCurrentStatus(newStatus);
    setIsUpdatingStatus(true);
    try {
      const res = await updateSubmissionStatusAction(submission.id, newStatus);
      if (res.success) {
        toast({
          title: 'Status Updated',
          description: `Submission marked as ${newStatus}.`,
        });
        if (onStatusUpdated) onStatusUpdated(submission.id, newStatus);
      } else {
        toast({
          title: 'Update Failed',
          description: res.error || 'Could not update status.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update submission status.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const statusColors: Record<SubmissionStatus, string> = {
    new: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    processing: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    qualified: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    unqualified: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    contacted: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
    converted: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    rejected: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    needs_review: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    ai_flagged: 'bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20',
  };

  return (
    <Sheet open={!!submission} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl bg-card border-l border-border/40 overflow-y-auto p-0"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-6 border-b border-border/40 bg-muted/10">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                  {submission.id}
                </span>
                {submission.totalScore !== undefined && (
                  <Badge variant="outline" className="text-[10px] font-bold px-2 py-0 bg-rose-500/10 text-rose-600 border-rose-500/20 gap-1">
                    <Flame className="h-3 w-3" /> Score: {submission.totalScore}
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
                Respondent Profile
              </SheetTitle>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Submitted on {(() => {
                  const d = parseDateSafe(submission.submittedAt);
                  return d ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                })()}
              </p>
            </div>

            {/* Qualification Status Dropdown */}
            <div className="space-y-1 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Qualification Status
              </span>
              <Select
                value={currentStatus}
                onValueChange={(val) => handleStatusChange(val as SubmissionStatus)}
                disabled={isUpdatingStatus}
              >
                <SelectTrigger className={cn("h-8 text-xs font-bold rounded-xl border w-[140px]", statusColors[currentStatus])}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New Intake</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="qualified">Qualified Lead</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="needs_review">Needs Review</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="unqualified">Unqualified</SelectItem>
                  <SelectItem value="ai_flagged">AI Flagged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* ── 0. AI Response Intelligence (Phase 10) ── */}
          <SubmissionAiIntelligenceSection
            submission={submission}
            form={form}
          />

          {/* ── 1. Linked CRM Record & Automated Pipeline ── */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              CRM & Pipeline Context
            </h3>

            <div className="space-y-2">
              {entityHref ? (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">CRM Entity Resolved</p>
                      <p className="text-[10px] font-mono text-emerald-600/80 dark:text-emerald-400/80">{submission.entityId}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-8 rounded-xl text-xs font-bold gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20">
                    <Link href={entityHref} target="_blank">
                      View Contact <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl bg-muted/20 border border-border/40 p-3.5 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Anonymous / Unlinked Respondent</span>
                  <Badge variant="outline" className="text-[10px]">No CRM Match</Badge>
                </div>
              )}

              {/* Deal Pipeline Context */}
              {submission.dealId && (
                <div className="rounded-2xl bg-purple-500/10 border border-purple-500/20 p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-xs font-bold text-purple-700 dark:text-purple-300">Automated Pipeline Deal</p>
                      <p className="text-[10px] font-mono text-purple-600/80 dark:text-purple-400/80">{submission.dealId}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-7 rounded-xl text-xs font-bold border-purple-500/30 text-purple-700 dark:text-purple-300">
                    <Link href="/admin/deals" target="_blank">
                      Deals <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              )}

              {/* Applied Contact Tags */}
              {form.actions?.tags && form.actions.tags.length > 0 && (
                <div className="pt-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1.5">
                    Applied Contact Tags
                  </span>
                  <TagSelector
                    currentTagIds={form.actions.tags}
                    onTagsChange={() => {}}
                  />
                </div>
              )}
            </div>
          </section>

          <Separator className="bg-border/40" />

          {/* ── 2. Captured Form Answers ── */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              Captured Form Responses
            </h3>
            <div className="rounded-2xl border border-border/50 bg-background/50 px-4 divide-y divide-border/30">
              {Object.entries(submission.data || {}).map(([key, value]) => {
                const field = form.fields?.find(f => f.id === key);
                const label = field?.labelOverride || field?.appFieldId || key;
                return <FieldRow key={key} label={label} value={value} />;
              })}
              {Object.keys(submission.data || {}).length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No form answers captured.</p>
              )}
            </div>
          </section>

          {/* ── 3. Lead Scoring Breakdown (if rules applied) ── */}
          {submission.scoreBreakdown && Object.keys(submission.scoreBreakdown).length > 0 && (
            <>
              <Separator className="bg-border/40" />
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Lead Score Category Breakdown
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(submission.scoreBreakdown).map(([category, points]) => (
                    <div key={category} className="p-2.5 rounded-xl bg-muted/20 border border-border/40 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground capitalize">{category}</span>
                      <Badge variant="outline" className="text-xs font-bold text-foreground">
                        +{points} pts
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <Separator className="bg-border/40" />

          {/* ── 4. Attribution & Session Metadata ── */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Attribution & Technical Metadata
            </h3>
            <div className="rounded-2xl border border-border/50 bg-background/50 p-3 space-y-1.5 text-xs">
              {submission.utmSource && <FieldRow label="UTM Source" value={submission.utmSource} />}
              {submission.utmMedium && <FieldRow label="UTM Medium" value={submission.utmMedium} />}
              {submission.utmCampaign && <FieldRow label="UTM Campaign" value={submission.utmCampaign} />}
              {submission.ipAddress && <FieldRow label="IP Address" value={submission.ipAddress} />}
              {submission.userAgent && <FieldRow label="User Agent" value={submission.userAgent} />}
              {!submission.utmSource && !submission.ipAddress && (
                <p className="text-xs text-muted-foreground text-center py-2">Direct organic intake.</p>
              )}
            </div>
          </section>

          <Separator className="bg-border/40" />

          {/* ── 5. Internal Staff Notes Thread ── */}
          <SubmissionNotesSection
            submissionId={submission.id}
            workspaceId={submission.workspaceId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
