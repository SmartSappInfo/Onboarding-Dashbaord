'use client';

/**
 * @fileOverview Meeting outcomes panel (Phase 11 M2 · T6.1; plan §13; Rules 7, 41, 54).
 *
 * The evidence-checked analysis of a meeting, grouped by kind. Every outcome shows the words it
 * comes from with a "Line N" jump into the transcript, a "Needs review" badge (no one-click action
 * until reviewed), and its actions: Create task / Undo, Propose update (decisions), Why?.
 * Header actions: create tasks for every checked item, draft a follow-up; saved drafts open in
 * the composer.
 *
 * Every change goes through the governed capabilities (see meeting-outcomes-actions.ts) and is
 * bound to the analysis version shown here: if the meeting was re-analysed meanwhile, the change
 * is refused and the panel reloads.
 *
 * PERFORMANCE (Rule 54): lazy-loaded by the intelligence tab; renders at most 50 outcomes at a
 * time ("Show more"); one read per load.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import { ListChecks, Mail, Undo2, Plus, HelpCircle, GitPullRequestArrow, Trash2 } from 'lucide-react';
import type { MeetingItem } from '@/lib/meetings/intelligence/intelligence-schemas';
import {
  createFollowupTasksAction,
  deleteFollowupDraftAction,
  getMeetingOutcomesAction,
  undoFollowupTaskAction,
  type OutcomesView,
} from '@/app/actions/meeting-outcomes-actions';
import { WhySheet } from './WhySheet';
import { DraftSheet } from './DraftSheet';
import { ProposeSheet } from './ProposeSheet';
import { OUTCOME_GROUPS, PAGE_STEP, REVIEW_REASON_TEXT, composerHref, isActionable, lineNumber } from './outcome-labels';

export interface MeetingOutcomesPanelProps {
  meetingId: string;
  workspaceId: string;
  /** Bump to reload (e.g. when a new analysis completes). */
  refreshKey: number;
  onJumpToLine: (segmentId: string, transcriptId: string) => void;
  /** Tells the tab whether a v2 analysis exists (it then hides the older summary cards). */
  onAvailability?: (available: boolean) => void;
}

const actionBtn = 'rounded-xl min-h-[44px] sm:min-h-[36px] text-xs gap-1.5 active:scale-[0.97]';

export default function MeetingOutcomesPanel({ meetingId, workspaceId, refreshKey, onJumpToLine, onAvailability }: MeetingOutcomesPanelProps) {
  const { toast } = useToast();
  const [view, setView] = React.useState<OutcomesView | null | undefined>(undefined);
  const [visible, setVisible] = React.useState(PAGE_STEP);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [whyItem, setWhyItem] = React.useState<MeetingItem | null>(null);
  const [proposeItem, setProposeItem] = React.useState<MeetingItem | null>(null);
  const [draftOpen, setDraftOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await getMeetingOutcomesAction(workspaceId, meetingId);
    if (!res.success) {
      toast({ variant: 'destructive', title: "Couldn't load the outcomes", description: res.error });
      setView(null);
      onAvailability?.(false);
      return;
    }
    setView(res.data);
    onAvailability?.(res.data !== null);
  }, [workspaceId, meetingId, toast, onAvailability]);

  React.useEffect(() => {
    load();
  }, [load, refreshKey]);

  const version = view?.header.version ?? 0;

  /** Runs a change; a refused change reloads the panel (the analysis may have changed). */
  const run = async (key: string, work: () => Promise<{ success: true } | { success: false; error: string }>, done: string) => {
    setBusy(key);
    try {
      const res = await work();
      if (res.success) toast({ title: done });
      else toast({ variant: 'destructive', title: "That didn't work", description: res.error });
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (view === undefined) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (view === null) return null;

  const pending = view.items.filter((i) => isActionable(i.type) && !i.needsReview && !view.tasks[i.itemHash]);
  const byType = new Map<string, MeetingItem[]>();
  for (const item of view.items) byType.set(item.type, [...(byType.get(item.type) ?? []), item]);
  let shown = 0;

  return (
    <Card className="rounded-2xl border border-border/80 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Meeting outcomes
            <CardInfoTooltip text="Decisions, commitments and other outcomes found in the transcript. Each one quotes the words it comes from; outcomes marked 'Needs review' must be checked by a person before acting on them." />
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending.length === 0 || busy !== null}
              className={actionBtn}
              onClick={() => run('bulk', () => createFollowupTasksAction(workspaceId, meetingId, { itemHashes: pending.map((i) => i.itemHash), expectedVersion: version }), 'Tasks created')}
            >
              <Plus className="h-3.5 w-3.5" /> {busy === 'bulk' ? 'Creating…' : `Create tasks (${pending.length})`}
            </Button>
            <Button size="sm" disabled={view.items.length === 0} className={actionBtn} onClick={() => setDraftOpen(true)}>
              <Mail className="h-3.5 w-3.5" /> Draft follow-up
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {view.header.kept} outcome{view.header.kept === 1 ? '' : 's'}
          {view.header.needsReview > 0 ? ` · ${view.header.needsReview} need review` : ''}
          {view.header.dropped > 0 ? ` · ${view.header.dropped} left out (not backed by the transcript)` : ''}
          {view.header.truncated ? ` · only ${Math.round(view.header.coverage * 100)}% of a very long transcript analysed` : ''}
        </p>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-5">
        {view.header.summary && view.header.summary.sentences.length > 0 && (
          <section className="space-y-1.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</h4>
            <p className="text-sm leading-relaxed">{view.header.summary.sentences.map((s) => s.text).join(' ')}</p>
          </section>
        )}

        {view.drafts.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Saved follow-up drafts</h4>
            {view.drafts.map((d) => (
              <div key={d.draftId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/20 p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{d.subject}</p>
                  <p className="truncate text-[11px] text-muted-foreground">To {d.recipients.join(', ')}{d.intelligenceVersion !== version ? ' · from an earlier analysis' : ''}</p>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className={actionBtn}>
                    <Link href={composerHref(meetingId, d.draftId)}>Open in composer</Link>
                  </Button>
                  <Button
                    size="sm" variant="ghost" aria-label="Delete draft" disabled={busy !== null} className={actionBtn}
                    onClick={() => run(`draft:${d.draftId}`, () => deleteFollowupDraftAction(workspaceId, meetingId, d.draftId), 'Draft deleted')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}

        {view.items.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No clear decisions or actions were found.</p>
        ) : (
          OUTCOME_GROUPS.map(({ type, label }) => {
            const items = byType.get(type) ?? [];
            const room = Math.max(0, visible - shown);
            const rows = items.slice(0, room);
            shown += rows.length;
            if (rows.length === 0) return null;
            return (
              <section key={type} className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label} ({items.length})</h4>
                <ul className="space-y-2">
                  {rows.map((item) => {
                    const taskId = view.tasks[item.itemHash];
                    const proposal = view.proposals[item.itemHash];
                    const quote = item.evidence[0];
                    const firstLine = quote?.segmentIds.map(lineNumber).find((n): n is number => n !== null);
                    return (
                      <li key={item.itemHash} className="rounded-xl border border-border/80 bg-muted/10 p-3 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground flex-1 min-w-[12rem]">{item.text}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.needsReview && (
                              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40 gap-1">
                                Needs review
                                <CardInfoTooltip text={item.reviewReasons.map((r) => REVIEW_REASON_TEXT[r]).join(' ')} />
                              </Badge>
                            )}
                            {item.contradicts.length > 0 && <Badge variant="outline" className="text-[10px]">Conflicts with another outcome</Badge>}
                          </div>
                        </div>
                        {quote && (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="italic line-clamp-2">&ldquo;{quote.quote}&rdquo;</span>
                            {firstLine && quote.segmentIds[0] && (
                              <Button variant="link" size="sm" className="h-auto p-0 text-[11px]" onClick={() => onJumpToLine(quote.segmentIds[0] ?? '', view.header.transcriptId)}>
                                Line {firstLine}
                              </Button>
                            )}
                          </div>
                        )}
                        {(item.owner || item.dueIso) && (
                          <p className="text-[11px] text-muted-foreground">
                            {item.owner ? `Owner: ${item.owner.name}${item.owner.matched ? '' : ' (not a workspace user)'}` : 'Owner: Unassigned'}
                            {item.dueIso ? ` · due ${item.dueIso}` : ''}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {isActionable(item.type) && (taskId ? (
                            <>
                              <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Task created</Badge>
                              <Button
                                size="sm" variant="ghost" disabled={busy !== null} className={actionBtn}
                                onClick={() => run(`undo:${item.itemHash}`, () => undoFollowupTaskAction(workspaceId, meetingId, item.itemHash), 'Task removed')}
                              >
                                <Undo2 className="h-3.5 w-3.5" /> {busy === `undo:${item.itemHash}` ? 'Undoing…' : 'Undo'}
                              </Button>
                            </>
                          ) : !item.needsReview ? (
                            <Button
                              size="sm" variant="outline" disabled={busy !== null} className={actionBtn}
                              onClick={() => run(`task:${item.itemHash}`, () => createFollowupTasksAction(workspaceId, meetingId, { itemHashes: [item.itemHash], expectedVersion: version }), 'Task created')}
                            >
                              <Plus className="h-3.5 w-3.5" /> {busy === `task:${item.itemHash}` ? 'Creating…' : 'Create task'}
                            </Button>
                          ) : null)}
                          {item.type === 'decision' && !item.needsReview && (proposal ? (
                            <Badge variant="secondary" className="text-[10px]">Update proposed · {proposal.status}</Badge>
                          ) : (
                            <Button size="sm" variant="outline" disabled={busy !== null} className={actionBtn} onClick={() => setProposeItem(item)}>
                              <GitPullRequestArrow className="h-3.5 w-3.5" /> Propose update
                            </Button>
                          ))}
                          <Button size="sm" variant="ghost" className={actionBtn} onClick={() => setWhyItem(item)}>
                            <HelpCircle className="h-3.5 w-3.5" /> Why?
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}

        {view.items.length > visible && (
          <Button variant="outline" size="sm" className={actionBtn} onClick={() => setVisible((v) => v + PAGE_STEP)}>
            Show more ({view.items.length - visible} more)
          </Button>
        )}
      </CardContent>

      <WhySheet
        item={whyItem}
        header={view.header}
        {...(whyItem && view.tasks[whyItem.itemHash] ? { taskId: view.tasks[whyItem.itemHash] } : {})}
        {...(whyItem && view.proposals[whyItem.itemHash] ? { proposal: view.proposals[whyItem.itemHash] } : {})}
        onClose={() => setWhyItem(null)}
        onJumpToLine={(id) => {
          setWhyItem(null);
          onJumpToLine(id, view.header.transcriptId);
        }}
      />
      <ProposeSheet
        item={proposeItem}
        meetingId={meetingId}
        workspaceId={workspaceId}
        expectedVersion={version}
        onClose={() => setProposeItem(null)}
        onProposed={load}
      />
      <DraftSheet
        open={draftOpen}
        onOpenChange={setDraftOpen}
        meetingId={meetingId}
        workspaceId={workspaceId}
        expectedVersion={version}
        onDrafted={load}
      />
    </Card>
  );
}
