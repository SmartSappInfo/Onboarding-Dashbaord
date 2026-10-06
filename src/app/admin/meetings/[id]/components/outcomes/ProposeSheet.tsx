'use client';

/**
 * @fileOverview "Propose update" sheet for one decision (Phase 11 M2 · T6; plan §4.12, D17).
 *
 * A person proposes ONE CRM change from ONE checked outcome: a deal's stage (applied after someone
 * else approves it) or a note on the linked record (a recommendation: approved as guidance, never
 * applied automatically). Never amounts or owners. Approving happens in the Approvals inbox.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { MeetingItem } from '@/lib/meetings/intelligence/intelligence-schemas';
import { getProposalTargetsAction, proposeCrmUpdateAction } from '@/app/actions/meeting-outcomes-actions';
import { OutcomeSheet } from './OutcomeSheet';

type Targets = { entityId: string | null; deals: Array<{ dealId: string; name: string; stageId: string; stages: Array<{ stageId: string; name: string }> }> };

export function ProposeSheet({
  item,
  meetingId,
  workspaceId,
  expectedVersion,
  onClose,
  onProposed,
}: {
  item: MeetingItem | null;
  meetingId: string;
  workspaceId: string;
  expectedVersion: number;
  onClose: () => void;
  onProposed: () => void;
}) {
  const { toast } = useToast();
  const [targets, setTargets] = React.useState<Targets | null>(null);
  const [kind, setKind] = React.useState<'deal_stage' | 'entity_note'>('deal_stage');
  const [dealId, setDealId] = React.useState('');
  const [stageId, setStageId] = React.useState('');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setTargets(null);
    setNote(item.text);
    getProposalTargetsAction(workspaceId, meetingId).then((res) => {
      if (cancelled) return;
      const t = res.success ? res.data : { entityId: null, deals: [] };
      setTargets(t);
      const first = t.deals[0];
      setDealId(first?.dealId ?? '');
      setStageId('');
      setKind(first ? 'deal_stage' : 'entity_note');
    });
    return () => {
      cancelled = true;
    };
  }, [item, workspaceId, meetingId]);

  const deal = targets?.deals.find((d) => d.dealId === dealId);
  const canSubmit = item !== null && targets !== null && (
    kind === 'deal_stage' ? Boolean(deal && stageId && stageId !== deal.stageId) : Boolean(targets.entityId && note.trim())
  );

  const submit = async () => {
    if (!item || !targets) return;
    setSaving(true);
    try {
      const target = kind === 'deal_stage'
        ? { kind: 'deal_stage' as const, dealId, stageId }
        : { kind: 'entity_note' as const, entityId: targets.entityId ?? '', content: note.trim() };
      const res = await proposeCrmUpdateAction(workspaceId, meetingId, { itemHash: item.itemHash, target, expectedVersion });
      if (!res.success) {
        toast({ variant: 'destructive', title: "Couldn't propose the update", description: res.error });
        return;
      }
      toast({
        title: res.data.replayed ? 'Already proposed' : 'Update proposed',
        description: res.data.executable ? 'Someone else approves it in Approvals, then it is applied.' : 'Saved as a recommendation for review in Approvals.',
      });
      onProposed();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <OutcomeSheet
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Propose update"
      info="Asks for approval to change the CRM based on this outcome. Nothing changes until someone else approves it. Amounts and owners can't be proposed."
      footer={
        <Button onClick={submit} disabled={!canSubmit || saving} className="rounded-xl min-h-[44px] active:scale-[0.97]">
          {saving ? 'Proposing…' : 'Propose update'}
        </Button>
      }
    >
      {item && (
        <p className="rounded-xl border border-border/80 bg-muted/20 p-3 italic">&ldquo;{item.evidence[0]?.quote}&rdquo;</p>
      )}
      {targets === null ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : !targets.entityId ? (
        <p className="text-muted-foreground">This meeting isn&apos;t linked to a record, so there is nothing to update.</p>
      ) : (
        <>
          <RadioGroup value={kind} onValueChange={(v) => setKind(v === 'entity_note' ? 'entity_note' : 'deal_stage')} className="space-y-1">
            <label className="flex min-h-[44px] items-center gap-3 rounded-xl px-2 hover:bg-muted/40 cursor-pointer">
              <RadioGroupItem value="deal_stage" disabled={targets.deals.length === 0} />
              <span>Move a deal to another stage{targets.deals.length === 0 ? ' (no open deal for this record)' : ''}</span>
            </label>
            <label className="flex min-h-[44px] items-center gap-3 rounded-xl px-2 hover:bg-muted/40 cursor-pointer">
              <RadioGroupItem value="entity_note" />
              <span>Add a note to the record (recommendation)</span>
            </label>
          </RadioGroup>

          {kind === 'deal_stage' && targets.deals.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Deal</Label>
                <Select value={dealId} onValueChange={(v) => { setDealId(v); setStageId(''); }}>
                  <SelectTrigger className="rounded-xl min-h-[44px]"><SelectValue placeholder="Choose a deal" /></SelectTrigger>
                  <SelectContent>
                    {targets.deals.map((d) => <SelectItem key={d.dealId} value={d.dealId}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>New stage</Label>
                <Select value={stageId} onValueChange={setStageId} disabled={!deal}>
                  <SelectTrigger className="rounded-xl min-h-[44px]"><SelectValue placeholder="Choose a stage" /></SelectTrigger>
                  <SelectContent>
                    {(deal?.stages ?? []).map((s) => (
                      <SelectItem key={s.stageId} value={s.stageId} disabled={s.stageId === deal?.stageId}>
                        {s.name}{s.stageId === deal?.stageId ? ' (current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {kind === 'entity_note' && (
            <div className="space-y-1.5">
              <Label htmlFor="proposal-note">Note</Label>
              <Textarea id="proposal-note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} className="rounded-xl min-h-[96px] text-xs" />
            </div>
          )}
        </>
      )}
    </OutcomeSheet>
  );
}
