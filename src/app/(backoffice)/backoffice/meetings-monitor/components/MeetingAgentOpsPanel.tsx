'use client';

/**
 * @fileOverview Backoffice Meeting Agent & Pipeline Operations Panel (Phase 11 M2 · T7).
 *
 * Provides comprehensive, code-free Backoffice observability and emergency intervention
 * for the Meeting Agent runtime (/backoffice/meetings-monitor), satisfying Rules 60–63.
 *
 * 4 Sub-sections:
 * 1. Emergency Kill Switches (Rule 60): pause analyst, pipeline queue, auto-trigger, CRM proposals.
 * 2. Pipeline Runs & DLQ Stream: active runs stream and DLQ retry/discard actions.
 * 3. Shadow Comparison & Canary Ladder: shadow metrics, prompt versions and workspace pinning.
 * 4. Security & Poisoning Feed (Rule 62): real-time audit feed of security events.
 *
 * UI Architecture: theme.md §8 (tactile cards, single-circle info tooltip, min-h-[44px] touch targets).
 */

import * as React from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  Layers,
  Pin,
  PinOff,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Terminal,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import {
  discardPipelineDeadLetterAction,
  getMeetingOpsSnapshotAction,
  pinMeetingPromptVersionAction,
  reprocessPipelineDeadLetterAction,
  setMeetingControlsAction,
  unpinMeetingPromptVersionAction,
  type MeetingOpsSnapshot,
} from '@/lib/backoffice/backoffice-meeting-ops-actions';

interface ShadowComparisonDetails {
  agent?: { items: number; actionable: number; needsReview: number };
  heuristic?: { items: number; alsoFoundByAgent: number };
  humanTasks?: { total: number; coveredByAgent: number };
  blastRadius?: { oneClickTasks: number; reviewFirst: number; crmProposalCandidates: number };
}

export default function MeetingAgentOpsPanel() {
  const getToken = useBackofficeToken();
  const { toast } = useToast();
  const [snapshot, setSnapshot] = React.useState<MeetingOpsSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [pinWs, setPinWs] = React.useState('');
  const [pinPromptVersion, setPinPromptVersion] = React.useState('mi_extract_v1');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMeetingOpsSnapshotAction(await getToken());
      if (res.success) {
        setSnapshot(res.data);
      } else {
        toast({ variant: 'destructive', title: "Couldn't load Meeting Agent ops", description: res.error });
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: (token: string) => Promise<{ success: boolean; error?: string }>, okTitle: string) => {
    setBusy(true);
    try {
      const res = await fn(await getToken());
      if (res.success) {
        toast({ title: okTitle });
        await load();
      } else {
        toast({ variant: 'destructive', title: 'Action failed', description: res.error });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" /> Meeting Agent & Pipeline Operations
          <CardInfoTooltip text="Live operations control plane for Meeting Intelligence pipelines, shadow evaluation, canary ladders, prompt versioning, and Rule 60 emergency kill switches." />
        </h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="rounded-xl min-h-[40px] gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Agent Ops
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        {/* Sub-section 1: Emergency Kill Switches (Rule 60) */}
        <Card className="rounded-2xl border border-border/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" /> Emergency Kill Switches (Rule 60)
            </h3>
            <Badge variant={snapshot?.controls.pipelineQueuePaused ? 'destructive' : 'secondary'}>
              {snapshot?.controls.pipelineQueuePaused ? 'PIPELINE PAUSED' : 'ACTIVE'}
            </Badge>
          </div>
          <p className="text-muted-foreground text-[11px]">
            Instant circuit breakers. Failing closed prevents unauthorized mutations or model cost spikes without requiring code redeployment.
          </p>

          <label className="flex min-h-[44px] items-center justify-between gap-3 border-t border-border/60 pt-2">
            <div>
              <span className="font-medium text-foreground block">Pause Meeting Analyst Persona</span>
              <span className="text-muted-foreground text-[10px]">Blocks meeting_analyst from running autonomously</span>
            </div>
            <Switch
              checked={snapshot?.controls.meetingAnalystPaused ?? false}
              disabled={!snapshot || busy}
              onCheckedChange={(v) =>
                run(
                  (t) => setMeetingControlsAction(t, { meetingAnalystPaused: v }),
                  v ? 'Meeting Analyst persona paused' : 'Meeting Analyst persona resumed'
                )
              }
            />
          </label>

          <label className="flex min-h-[44px] items-center justify-between gap-3 border-t border-border/60 pt-2">
            <div>
              <span className="font-medium text-foreground block">Pause Intelligence Pipeline Queue</span>
              <span className="text-muted-foreground text-[10px]">Cloud Tasks meeting-intelligence-queue halts new analysis runs</span>
            </div>
            <Switch
              checked={snapshot?.controls.pipelineQueuePaused ?? false}
              disabled={!snapshot || busy}
              onCheckedChange={(v) =>
                run(
                  (t) => setMeetingControlsAction(t, { pipelineQueuePaused: v }),
                  v ? 'Pipeline queue paused' : 'Pipeline queue resumed'
                )
              }
            />
          </label>

          <label className="flex min-h-[44px] items-center justify-between gap-3 border-t border-border/60 pt-2">
            <div>
              <span className="font-medium text-foreground block">Disable Auto-Trigger Post-Transcript</span>
              <span className="text-muted-foreground text-[10px]">Transcripts won&apos;t automatically start analysis upon completion</span>
            </div>
            <Switch
              checked={snapshot?.controls.autoTriggerDisabled ?? false}
              disabled={!snapshot || busy}
              onCheckedChange={(v) =>
                run(
                  (t) => setMeetingControlsAction(t, { autoTriggerDisabled: v }),
                  v ? 'Auto-trigger disabled' : 'Auto-trigger enabled'
                )
              }
            />
          </label>

          <label className="flex min-h-[44px] items-center justify-between gap-3 border-t border-border/60 pt-2">
            <div>
              <span className="font-medium text-foreground block">Pause CRM Update Proposals</span>
              <span className="text-muted-foreground text-[10px]">Stops generation of new CRM stage or tag proposals from meetings</span>
            </div>
            <Switch
              checked={snapshot?.controls.proposalsPaused ?? false}
              disabled={!snapshot || busy}
              onCheckedChange={(v) =>
                run(
                  (t) => setMeetingControlsAction(t, { proposalsPaused: v }),
                  v ? 'CRM proposals paused' : 'CRM proposals resumed'
                )
              }
            />
          </label>
        </Card>

        {/* Sub-section 2: Pipeline Runs & DLQ Recovery */}
        <Card className="rounded-2xl border border-border/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-500" /> Pipeline Runs & Dead Letters
            </h3>
            <Badge variant="outline">DLQ: {snapshot?.pipelineDlq.length ?? 0}</Badge>
          </div>

          <div className="space-y-2">
            <span className="font-semibold text-muted-foreground block text-[11px]">
              Active & Recent Analyses ({snapshot?.pipelineRuns.length ?? 0})
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {snapshot?.pipelineRuns.length ? (
                snapshot.pipelineRuns.map((r) => (
                  <div key={r.runId} className="flex items-center justify-between gap-2 border border-border/60 rounded-xl p-2 bg-muted/10">
                    <div className="truncate font-mono text-[11px]">
                      <span className="font-semibold text-foreground">{r.workspaceId}</span> · {r.meetingId}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">{r.step}</Badge>
                      <Badge
                        variant={r.status === 'completed' ? 'default' : r.status === 'dead_lettered' ? 'destructive' : 'outline'}
                        className="text-[10px]"
                      >
                        {r.status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-[11px]">No active pipeline runs.</p>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-2">
            <span className="font-semibold text-muted-foreground block text-[11px]">
              Failed Runs / DLQ Recovery (Rule 25)
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {snapshot?.pipelineDlq.length ? (
                snapshot.pipelineDlq.map((d) => (
                  <div key={d.runId} className="flex items-center justify-between gap-2 border border-border/60 rounded-xl p-2 bg-destructive/5">
                    <div className="truncate">
                      <span className="font-mono text-foreground font-semibold">{d.code}</span>
                      <p className="text-muted-foreground text-[10px] truncate">{d.message}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => run((t) => reprocessPipelineDeadLetterAction(t, d.runId), 'Pipeline run requeued')}
                        className="rounded-xl min-h-[36px] gap-1 text-[11px]"
                      >
                        <RotateCcw className="h-3 w-3" /> Retry
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => run((t) => discardPipelineDeadLetterAction(t, d.runId), 'Pipeline dead letter discarded')}
                        className="rounded-xl min-h-[36px] text-destructive gap-1 text-[11px]"
                      >
                        <Trash2 className="h-3 w-3" /> Discard
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-[11px]">No dead-lettered intelligence runs.</p>
              )}
            </div>
          </div>
        </Card>

        {/* Sub-section 3: Shadow Comparison & Canary Ladder */}
        <Card className="rounded-2xl border border-border/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-purple-500" /> Shadow Comparison & Canary Ladder
            </h3>
            <Badge variant="secondary">Canary Stage</Badge>
          </div>
          <p className="text-muted-foreground text-[11px]">
            Shadow runs execute with dryRun=true and compare agent predictions against keyword heuristics and human-created tasks.
          </p>

          <div className="space-y-1.5 border-t border-border/60 pt-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Recent Shadow Records</span>
              <span className="font-bold">{snapshot?.shadowRuns.length ?? 0}</span>
            </div>
            {snapshot?.shadowRuns.length ? (
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {snapshot.shadowRuns.slice(0, 3).map((s) => {
                  const comp = s.comparison as ShadowComparisonDetails | undefined;
                  return (
                    <div key={s.runId} className="p-2 rounded-xl bg-muted/15 border border-border/60 text-[10px] space-y-1">
                      <div className="flex justify-between font-mono font-semibold">
                        <span>{s.workspaceId}</span>
                        <span className="text-muted-foreground">{s.promptVersion}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Agent Items: {comp?.agent?.items ?? 0}</span>
                        <span>Heuristic Found: {comp?.heuristic?.alsoFoundByAgent ?? 0}</span>
                        <span>Human Tasks Covered: {comp?.humanTasks?.coveredByAgent ?? 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-[11px]">No shadow records logged yet.</p>
            )}
          </div>

          {/* Prompt Version Control */}
          <div className="space-y-2 border-t border-border/60 pt-2">
            <span className="font-semibold text-muted-foreground block text-[11px]">
              Prompt Pinning & Overrides (Rule 65)
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={pinWs}
                onChange={(e) => setPinWs(e.target.value)}
                placeholder="Workspace ID"
                className="rounded-xl min-h-[44px] text-xs"
                aria-label="Pin workspace ID"
              />
              <select
                value={pinPromptVersion}
                onChange={(e) => setPinPromptVersion(e.target.value)}
                className="h-[44px] rounded-xl border border-input bg-background px-3 text-xs"
                aria-label="Prompt Version"
              >
                {snapshot?.promptVersions.map((p) => (
                  <option key={p.version} value={p.version}>
                    {p.name} ({p.version})
                  </option>
                ))}
              </select>
              <Button
                disabled={busy || !pinWs.trim()}
                onClick={() =>
                  run(
                    (t) => pinMeetingPromptVersionAction(t, pinWs.trim(), pinPromptVersion),
                    `Workspace pinned to ${pinPromptVersion}`
                  )
                }
                className="rounded-xl min-h-[44px] gap-1 shrink-0"
              >
                <Pin className="h-3.5 w-3.5" /> Pin
              </Button>
            </div>

            {snapshot?.workspaceOverrides.length ? (
              <div className="space-y-1 pt-1">
                {snapshot.workspaceOverrides.map((o) => (
                  <div key={o.workspaceId} className="flex items-center justify-between text-[11px] border border-border/60 rounded-xl px-2.5 py-1.5 bg-muted/10">
                    <span className="font-mono">{o.workspaceId} ➔ {o.promptVersion}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => run((t) => unpinMeetingPromptVersionAction(t, o.workspaceId), 'Override unpinned')}
                      className="h-7 px-2 rounded-lg text-xs gap-1"
                    >
                      <PinOff className="h-3 w-3" /> Reset
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Card>

        {/* Sub-section 4: Security & Poisoning Feed (Rule 62) */}
        <Card className="rounded-2xl border border-border/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-500" /> Security & Poisoning Feed (Rule 62)
            </h3>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Protected
            </Badge>
          </div>
          <p className="text-muted-foreground text-[11px]">
            Live audit of adversarial prompts, fabricated quote rejections, unauthorized recipient egress blocks, and self-approval attempts.
          </p>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {snapshot?.securityFeed.length ? (
              snapshot.securityFeed.map((sec) => (
                <div key={sec.alertId} className="border border-border/60 rounded-xl p-2.5 bg-muted/15 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="destructive" className="text-[9px] uppercase tracking-wider">
                      {sec.type.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(sec.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-foreground text-[11px] font-medium">{sec.reason}</p>
                  <p className="text-muted-foreground text-[10px] font-mono">
                    ws: {sec.workspaceId} {sec.meetingId ? `· mtg: ${sec.meetingId}` : ''}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-center space-y-1">
                <AlertTriangle className="h-5 w-5 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground text-[11px]">No security incidents detected.</p>
                <p className="text-muted-foreground text-[10px]">The pipeline is operating within normal parameters.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
