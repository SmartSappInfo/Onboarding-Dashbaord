'use client';

/**
 * @fileOverview Follow-up draft sheet (Phase 11 M2 · T6.4; plan §4.7, D16).
 *
 * Recipients can only be chosen from the meeting's participants and the linked record's contacts.
 * The draft is written from checked outcomes and saved; there is NO send button here. "Open in
 * composer" loads the saved draft (server-side, permission-checked) where a person edits and sends.
 */

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { draftFollowupAction, getFollowupRecipientsAction } from '@/app/actions/meeting-outcomes-actions';
import type { MeetingDraftFollowupOutput } from '@/platform/domains/meetings_conversations';
import { OutcomeSheet } from './OutcomeSheet';
import { composerHref } from './outcome-labels';

type Recipient = { email: string; name?: string; source: 'participant' | 'record_contact' };

export function DraftSheet({
  open,
  onOpenChange,
  meetingId,
  workspaceId,
  expectedVersion,
  onDrafted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  workspaceId: string;
  expectedVersion: number;
  onDrafted: () => void;
}) {
  const { toast } = useToast();
  const [recipients, setRecipients] = React.useState<Recipient[] | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [draft, setDraft] = React.useState<MeetingDraftFollowupOutput | null>(null);
  const [writing, setWriting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDraft(null);
    getFollowupRecipientsAction(workspaceId, meetingId).then((res) => {
      if (cancelled) return;
      const list = res.success ? res.data : [];
      setRecipients(list);
      setSelected(new Set(list.filter((r) => r.source === 'participant').map((r) => r.email)));
      if (!res.success) toast({ variant: 'destructive', title: "Couldn't load recipients", description: res.error });
    });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, meetingId, toast]);

  const toggle = (email: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    return next;
  });

  const write = async () => {
    setWriting(true);
    try {
      const res = await draftFollowupAction(workspaceId, meetingId, { recipients: [...selected], expectedVersion });
      if (!res.success) {
        toast({ variant: 'destructive', title: "Couldn't write the draft", description: res.error });
        return;
      }
      setDraft(res.data);
      onDrafted();
    } finally {
      setWriting(false);
    }
  };

  return (
    <OutcomeSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Draft follow-up"
      info="Writes an email from this meeting's checked outcomes. Nothing is sent: open the draft in the composer to edit and send it."
      footer={draft ? (
        <Button asChild className="rounded-xl min-h-[44px] active:scale-[0.97]">
          <Link href={composerHref(meetingId, draft.draftId)}>Open in composer</Link>
        </Button>
      ) : (
        <Button onClick={write} disabled={writing || selected.size === 0} className="rounded-xl min-h-[44px] active:scale-[0.97]">
          {writing ? 'Writing…' : 'Write draft'}
        </Button>
      )}
    >
      {!draft ? (
        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Send to</h4>
          {recipients === null ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : recipients.length === 0 ? (
            <p className="text-muted-foreground">No participant or contact of the linked record has an email address.</p>
          ) : (
            <ul className="space-y-1">
              {recipients.map((r) => (
                <li key={r.email}>
                  <label className="flex min-h-[44px] items-center gap-3 rounded-xl px-2 hover:bg-muted/40 cursor-pointer">
                    <Checkbox checked={selected.has(r.email)} onCheckedChange={() => toggle(r.email)} aria-label={r.email} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-medium">{r.name || r.email}</span>
                      <span className="block truncate text-muted-foreground">{r.email} · {r.source === 'participant' ? 'participant' : 'record contact'}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">To</h4>
            <p>{draft.recipients.join(', ')}</p>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Subject</h4>
            <p className="font-medium">{draft.subject}</p>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Message</h4>
            <p className="whitespace-pre-line leading-relaxed">{draft.body}</p>
          </div>
          {draft.droppedSentences > 0 && (
            <p className="text-muted-foreground">{draft.droppedSentences} sentence(s) were left out because they weren&apos;t backed by the meeting.</p>
          )}
          <p className="text-muted-foreground">Saved as a draft. Edit and send it from the composer.</p>
        </section>
      )}
    </OutcomeSheet>
  );
}
