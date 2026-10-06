'use client';

/**
 * @fileOverview Prep brief card (Phase 11 M2 · T6.3; plan §4.5).
 *
 * Built on request (it reads several records and may call the AI). Every line cites the workspace
 * records it comes from ([1], [2] … listed under "Sources"). When AI is unavailable or not allowed
 * the brief is facts only, and says so.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import { NotebookPen } from 'lucide-react';
import { generateMeetingPrepBriefAction } from '@/app/actions/meeting-intelligence-actions';
import type { MeetingPrepBrief } from '@/lib/meetings/types/intelligence';

const SECTIONS: ReadonlyArray<{ key: 'history' | 'openDeals' | 'openCommitments' | 'risks' | 'agenda' | 'questions'; label: string }> = [
  { key: 'history', label: 'History' },
  { key: 'openDeals', label: 'Open deals' },
  { key: 'openCommitments', label: 'Open commitments' },
  { key: 'risks', label: 'Risks' },
  { key: 'agenda', label: 'Suggested agenda' },
  { key: 'questions', label: 'Questions to ask' },
];

export default function MeetingBriefCard({ meetingId, workspaceId }: { meetingId: string; workspaceId: string }) {
  const { toast } = useToast();
  const [brief, setBrief] = React.useState<MeetingPrepBrief | null>(null);
  const [loading, setLoading] = React.useState(false);

  const prepare = async () => {
    setLoading(true);
    try {
      const res = await generateMeetingPrepBriefAction(meetingId, workspaceId);
      if (res.success && res.brief) setBrief(res.brief);
      else toast({ variant: 'destructive', title: "Couldn't prepare the brief", description: res.error ?? 'Try again.' });
    } finally {
      setLoading(false);
    }
  };

  const citationNumber = new Map((brief?.citations ?? []).map((c, i) => [c.id, i + 1]));
  const cite = (ids: readonly string[]) => ids.map((id) => citationNumber.get(id)).filter((n): n is number => n !== undefined);

  return (
    <Card className="rounded-2xl border border-border/80 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/80">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <NotebookPen className="h-4 w-4 text-primary" />
            Prep brief
            <CardInfoTooltip text="A short brief from this workspace's records about the people and record in this meeting. Every line lists its sources." />
          </CardTitle>
          <Button size="sm" variant="outline" onClick={prepare} disabled={loading} className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs active:scale-[0.97]">
            {loading ? 'Preparing…' : brief ? 'Refresh' : 'Prepare brief'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4 text-xs">
        {loading && !brief && <Skeleton className="h-24 w-full rounded-xl" />}
        {!loading && !brief && <p className="text-muted-foreground">Prepare a brief before the meeting.</p>}
        {brief && (
          <>
            {brief.mode === 'facts_only' && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40">AI summary unavailable; showing facts only.</Badge>
            )}
            {brief.objective && <p className="font-medium">{brief.objective.text}</p>}
            {SECTIONS.map(({ key, label }) => brief[key].length > 0 && (
              <section key={key} className="space-y-1">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</h4>
                <ul className="space-y-1">
                  {brief[key].map((line) => (
                    <li key={line.text} className="leading-relaxed">
                      {line.text}
                      {cite(line.sourceIds).map((n) => <sup key={n} className="ml-0.5 text-primary">[{n}]</sup>)}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {brief.citations.length > 0 && (
              <section className="space-y-1 border-t border-border/80 pt-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sources</h4>
                <ol className="space-y-0.5 text-muted-foreground">
                  {brief.citations.map((c, i) => (
                    <li key={c.id}>[{i + 1}] {c.label}{c.at ? ` · ${new Date(c.at).toLocaleDateString()}` : ''}</li>
                  ))}
                </ol>
              </section>
            )}
            {brief.budget.found > brief.budget.used && (
              <p className="text-muted-foreground">Found {brief.budget.found} records, used the {brief.budget.used} most relevant.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
