'use client';

/**
 * @fileOverview "Why?" sheet for one meeting outcome (Phase 11 M2 · T6.2; Rule 41).
 *
 * Shows what a reviewer needs to trust or reject the outcome: what it is, the exact words it comes
 * from (with line jumps), which checks it passed or why it needs review, how it was produced
 * (prompt / model / when) and what has been done with it. Never shows model reasoning text.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { MeetingItem } from '@/lib/meetings/intelligence/intelligence-schemas';
import type { OutcomesView } from '@/app/actions/meeting-outcomes-actions';
import { OutcomeSheet } from './OutcomeSheet';
import { REVIEW_REASON_TEXT, TYPE_LABEL, lineNumber } from './outcome-labels';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="space-y-1.5 text-foreground">{children}</div>
    </section>
  );
}

export function WhySheet({
  item,
  header,
  taskId,
  proposal,
  onClose,
  onJumpToLine,
}: {
  item: MeetingItem | null;
  header: OutcomesView['header'];
  taskId?: string;
  proposal?: OutcomesView['proposals'][string];
  onClose: () => void;
  onJumpToLine: (segmentId: string) => void;
}) {
  return (
    <OutcomeSheet
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Why this outcome?"
      info="Where this came from in the meeting, the checks it passed, and what has been done with it."
    >
      {item && (
        <>
          <Section title="What">
            <p className="font-medium">{item.text}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">{TYPE_LABEL[item.type]}</Badge>
              {item.owner && <Badge variant="outline" className="text-[10px]">Owner: {item.owner.name}{item.owner.matched ? '' : ' (not a workspace user)'}</Badge>}
              {item.dueIso && <Badge variant="outline" className="text-[10px]">Due {item.dueIso}</Badge>}
              {item.amount && <Badge variant="outline" className="text-[10px]">{item.amount.value} {item.amount.currency ?? '(currency unclear)'}</Badge>}
            </div>
          </Section>

          <Section title="Said in the meeting">
            {item.evidence.map((e) => (
              <div key={e.quote} className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-1.5">
                <p className="italic">&ldquo;{e.quote}&rdquo;</p>
                <div className="flex flex-wrap gap-1.5">
                  {e.segmentIds.map((id) => {
                    const n = lineNumber(id);
                    return n ? (
                      <Button key={id} variant="outline" size="sm" className="h-8 rounded-lg text-[11px]" onClick={() => onJumpToLine(id)}>
                        Line {n}
                      </Button>
                    ) : null;
                  })}
                </div>
              </div>
            ))}
          </Section>

          <Section title="Checks">
            <p>✓ The quote was found word for word in the transcript lines it cites.</p>
            {item.needsReview ? (
              item.reviewReasons.map((r) => <p key={r} className="text-amber-600 dark:text-amber-400">Needs review: {REVIEW_REASON_TEXT[r]}</p>)
            ) : (
              <p>✓ Nothing needs a person&apos;s review before acting on it.</p>
            )}
            {item.contradicts.length > 0 && <p className="text-amber-600 dark:text-amber-400">It conflicts with {item.contradicts.length} other outcome(s) from this meeting.</p>}
            <p className="text-muted-foreground">Confidence {Math.round(item.confidence * 100)}%.</p>
          </Section>

          <Section title="How it was made">
            <p>Analysed {new Date(header.generatedAt).toLocaleString()} from the meeting transcript, with AI use allowed for it.</p>
            <p className="text-muted-foreground">Prompt {item.promptVersion}{header.modelId ? ` · model ${header.modelId}` : ''} · run {header.runId}</p>
            {header.truncated && <p className="text-amber-600 dark:text-amber-400">Only part of a very long transcript was analysed ({Math.round(header.coverage * 100)}%).</p>}
          </Section>

          <Section title="What has been done">
            {taskId ? <p>A task was created from it.</p> : null}
            {proposal ? (
              <p>
                A CRM update was proposed ({proposal.status})
                {proposal.executable ? '' : ' as a recommendation; it is not applied automatically'}.
              </p>
            ) : null}
            {!taskId && !proposal && <p className="text-muted-foreground">Nothing yet.</p>}
          </Section>
        </>
      )}
    </OutcomeSheet>
  );
}
