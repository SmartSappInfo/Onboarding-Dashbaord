'use client';

import * as React from 'react';
import Link from 'next/link';
import { X, Tag, Zap, Globe, Building2, User, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import type { Form, FormSubmission } from '@/lib/types';
import { formatFieldValue } from '@/lib/forms-utils';

interface Props {
  submission: FormSubmission | null;
  form: Form;
  onClose: () => void;
}

function FieldRow({ label, value, type }: { label: string; value: unknown; type?: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-border/30 last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-words">{formatFieldValue(value, type) || '—'}</span>
    </div>
  );
}

export default function SubmissionDrawer({ submission, form, onClose }: Props) {
  const entityHref = submission?.entityId
    ? form.contactScope === 'institution'
      ? `/admin/schools/${submission.entityId}`
      : `/admin/entities/${submission.entityId}`
    : null;

  return (
    <Sheet open={!!submission} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-card border-l border-border/40 overflow-y-auto p-0"
      >
        {submission && (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="text-base font-semibold">Submission Detail</SheetTitle>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{submission.id}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(submission.submittedAt).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </SheetHeader>

            <div className="px-6 py-4 space-y-6">
              {/* CRM Record */}
              {entityHref && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">CRM Record Resolved</p>
                      <p className="text-[10px] font-mono text-emerald-600/70 dark:text-emerald-500/70">{submission.entityId}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 text-xs rounded-lg border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                    <Link href={entityHref} target="_blank">
                      View <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              )}

              {/* Submission Data */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Form Responses</h3>
                <div className="rounded-xl border border-border/40 bg-background/50 px-4 divide-y divide-border/20">
                  {Object.entries(submission.data).map(([key, value]) => (
                    <FieldRow key={key} label={key} value={value} />
                  ))}
                  {Object.keys(submission.data).length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No data captured.</p>
                  )}
                </div>
              </section>

              <Separator className="bg-border/30" />

              {/* Actions Summary */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Actions Executed</h3>

                {/* Tags */}
                {form.actions?.tags?.length ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {form.actions.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                ) : null}

                {/* Webhooks */}
                {form.actions?.webhooks?.length ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" /> {form.actions.webhooks.length} webhook{form.actions.webhooks.length !== 1 ? 's' : ''} dispatched
                    </p>
                  </div>
                ) : null}

                {/* Source page */}
                {submission.sourcePageId && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" /> Via campaign page · <span className="font-mono">{submission.sourcePageId.slice(-8)}</span>
                  </p>
                )}

                {!form.actions?.tags?.length && !form.actions?.webhooks?.length && !submission.sourcePageId && (
                  <p className="text-xs text-muted-foreground">No actions configured for this form.</p>
                )}
              </section>

              {/* Source metadata */}
              {(submission.ipAddress || submission.userAgent) && (
                <>
                  <Separator className="bg-border/30" />
                  <section className="space-y-1">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Source</h3>
                    {submission.ipAddress && <FieldRow label="IP Address" value={submission.ipAddress} />}
                    {submission.userAgent && <FieldRow label="User Agent" value={submission.userAgent} />}
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
