'use client';

/**
 * @fileOverview Backoffice: meeting transcription & retention operations (Phase 11 M1 · T9).
 *
 * Operators can pause transcription, block audio leaving SmartSapp, set a workspace's daily quota,
 * recover failed jobs, see usage and retention runs, and run retention now after a preview.
 * Shows ids, states and counts only (no transcript text or media links).
 */

import * as React from 'react';
import { RefreshCw, ShieldAlert, Trash2, RotateCcw, Gauge } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import {
  discardDeadLetterAction,
  getMeetingOpsSnapshotAction,
  previewWorkspaceRetentionAction,
  reprocessDeadLetterAction,
  runWorkspaceRetentionNowAction,
  setMeetingControlsAction,
  setTranscriptionQuotaAction,
  type MeetingOpsSnapshot,
} from '@/lib/backoffice/backoffice-meeting-ops-actions';

export default function TranscriptionOpsPanel() {
  const getToken = useBackofficeToken();
  const { toast } = useToast();
  const [snapshot, setSnapshot] = React.useState<MeetingOpsSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [quotaWs, setQuotaWs] = React.useState('');
  const [quotaMinutes, setQuotaMinutes] = React.useState('120');
  const [retentionWs, setRetentionWs] = React.useState('');
  const [preview, setPreview] = React.useState<{ mode: string; counts: Record<string, number>; candidateSetHash: string; truncated: boolean } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMeetingOpsSnapshotAction(await getToken());
      if (res.success) setSnapshot(res.data);
      else toast({ variant: 'destructive', title: "Couldn't load", description: res.error });
    } finally {
      setLoading(false);
    }
  }, [getToken, toast]);

  React.useEffect(() => { void load(); }, [load]);

  const run = async (fn: (token: string) => Promise<{ success: boolean; error?: string }>, okTitle: string) => {
    setBusy(true);
    try {
      const res = await fn(await getToken());
      if (res.success) {
        toast({ title: okTitle });
        await load();
      } else {
        toast({ variant: 'destructive', title: 'Not saved', description: res.error });
      }
    } finally {
      setBusy(false);
    }
  };

  const doPreview = async () => {
    if (!retentionWs.trim()) return;
    setBusy(true);
    try {
      const res = await previewWorkspaceRetentionAction(await getToken(), retentionWs.trim());
      if (res.success) setPreview(res.data);
      else toast({ variant: 'destructive', title: "Couldn't preview", description: res.error });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" /> Transcription & retention
          <CardInfoTooltip text="Controls for meeting transcription (audio sent to an AI service) and automatic removal of old meeting data." />
        </h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="rounded-xl min-h-[40px] gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        <Card className="rounded-2xl border border-border/80 p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-500" /> Emergency controls</h3>
          <label className="flex min-h-[44px] items-center justify-between gap-3">
            <span>Pause transcription</span>
            <Switch
              checked={snapshot?.controls.transcriptionPaused ?? false}
              disabled={!snapshot || busy}
              onCheckedChange={(v) => run((t) => setMeetingControlsAction(t, { transcriptionPaused: v }), v ? 'Transcription paused' : 'Transcription resumed')}
            />
          </label>
          <label className="flex min-h-[44px] items-center justify-between gap-3">
            <span>Block audio leaving SmartSapp</span>
            <Switch
              checked={snapshot?.controls.blockAudioEgress ?? false}
              disabled={!snapshot || busy}
              onCheckedChange={(v) => run((t) => setMeetingControlsAction(t, { blockAudioEgress: v }), v ? 'Audio blocked' : 'Audio allowed')}
            />
          </label>
        </Card>

        <Card className="rounded-2xl border border-border/80 p-4 space-y-3">
          <h3 className="font-semibold">Daily limit per workspace</h3>
          <p className="text-muted-foreground">Default {snapshot?.defaultDailyMinutes ?? 120} minutes.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={quotaWs} onChange={(e) => setQuotaWs(e.target.value)} placeholder="Workspace id" className="rounded-xl min-h-[44px] text-xs" aria-label="Workspace id" />
            <Input value={quotaMinutes} onChange={(e) => setQuotaMinutes(e.target.value)} type="number" min={0} className="rounded-xl min-h-[44px] text-xs sm:w-28" aria-label="Minutes per day" />
            <Button disabled={busy || !quotaWs.trim()} onClick={() => run((t) => setTranscriptionQuotaAction(t, quotaWs.trim(), Number(quotaMinutes)), 'Limit saved')} className="rounded-xl min-h-[44px]">Save</Button>
          </div>
        </Card>

        <Card className="rounded-2xl border border-border/80 p-4 space-y-2">
          <h3 className="font-semibold">In progress ({snapshot?.queue.length ?? 0})</h3>
          {snapshot?.queue.length ? snapshot.queue.map((q) => (
            <div key={q.transcriptId} className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
              <span className="truncate font-mono">{q.workspaceId} · {q.meetingId}</span>
              <Badge variant="secondary">{q.status} · try {q.attempts}</Badge>
            </div>
          )) : <p className="text-muted-foreground">Nothing in progress.</p>}
        </Card>

        <Card className="rounded-2xl border border-border/80 p-4 space-y-2">
          <h3 className="font-semibold">Failed jobs ({snapshot?.deadLetters.length ?? 0})</h3>
          {snapshot?.deadLetters.length ? snapshot.deadLetters.map((d) => (
            <div key={d.transcriptId} className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
              <span className="truncate">{d.code}: {d.message}</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run((t) => reprocessDeadLetterAction(t, d.transcriptId), 'Requeued')} className="rounded-xl min-h-[40px] gap-1"><RotateCcw className="h-3.5 w-3.5" /> Retry</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run((t) => discardDeadLetterAction(t, d.transcriptId), 'Discarded')} className="rounded-xl min-h-[40px] gap-1"><Trash2 className="h-3.5 w-3.5" /> Discard</Button>
              </div>
            </div>
          )) : <p className="text-muted-foreground">No failed jobs.</p>}
        </Card>

        <Card className="rounded-2xl border border-border/80 p-4 space-y-2">
          <h3 className="font-semibold">Minutes used today</h3>
          {snapshot?.usageToday.length ? snapshot.usageToday.map((u) => (
            <div key={u.workspaceId} className="flex items-center justify-between border-t border-border/60 pt-2">
              <span className="font-mono truncate">{u.workspaceId}</span><strong>{u.minutes}</strong>
            </div>
          )) : <p className="text-muted-foreground">No transcription today.</p>}
        </Card>

        <Card className="rounded-2xl border border-border/80 p-4 space-y-3">
          <h3 className="font-semibold">Retention</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={retentionWs} onChange={(e) => { setRetentionWs(e.target.value); setPreview(null); }} placeholder="Workspace id" className="rounded-xl min-h-[44px] text-xs" aria-label="Retention workspace id" />
            <Button variant="outline" disabled={busy || !retentionWs.trim()} onClick={doPreview} className="rounded-xl min-h-[44px]">Preview</Button>
          </div>
          {preview && (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
              <p>Mode: <strong>{preview.mode === 'enforced' ? 'Delete on schedule' : 'Preview only'}</strong></p>
              <p>Would remove {preview.counts.transcripts ?? 0} transcripts and {preview.counts.recordings ?? 0} recordings from {preview.counts.meetings ?? 0} meetings{preview.truncated ? ' (first batch)' : ''}.</p>
              <Button
                variant="destructive"
                disabled={busy || preview.mode !== 'enforced'}
                onClick={() => run((t) => runWorkspaceRetentionNowAction(t, retentionWs.trim(), preview.candidateSetHash), 'Retention run finished')}
                className="rounded-xl min-h-[44px]"
              >
                Run now
              </Button>
              {preview.mode !== 'enforced' && <p className="text-muted-foreground">This workspace is in preview-only mode, so nothing would be deleted.</p>}
            </div>
          )}
          {snapshot?.retentionRuns.slice(0, 5).map((r, i) => (
            <div key={`${r.workspaceId}-${r.at}-${i}`} className="flex items-center justify-between border-t border-border/60 pt-2">
              <span className="font-mono truncate">{r.workspaceId}</span>
              <Badge variant={r.verified ? 'secondary' : 'destructive'}>{r.mode} · {Object.values(r.deleted).reduce((a, b) => a + (Number(b) || 0), 0)} removed</Badge>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
