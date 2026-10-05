'use client';

/**
 * Meeting intelligence tab.
 *
 * Phase 11 M1 · T8 (honest data, Rule 47): every number and sentence on this tab now comes from this
 * meeting's real transcript or stored analysis. Removed: a hard-coded "Ask AI" answer, a fixed
 * "High Intent (88%)" banner, a fixed speech-coach card and a toast claiming outcomes were logged to
 * the CRM. Added: add-transcript flow, transcript + consent panel, signed recording playback,
 * recording upload and transcription with status/cancel.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Check,
  Video,
  ListTodo,
  TrendingUp,
  FileText,
  Plus,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AddTranscriptModal } from './AddTranscriptModal';
import { MeetingTranscriptPanel } from './MeetingTranscriptPanel';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { analyzeConversationDynamics } from '@/lib/meetings/speech-coach-service';
import type { MeetingGetTranscriptOutput } from '@/platform/domains/meetings_conversations';
import {
  getMeetingLegalHoldAction,
  getWorkspaceCompliancePolicyAction,
  setMeetingLegalHoldAction,
} from '@/app/actions/meeting-compliance-actions';
import { Switch } from '@/components/ui/switch';
import {
  cancelTranscriptionAction,
  getTranscriptionStatusAction,
  transcribeRecordingAction,
} from '@/app/actions/meeting-transcript-actions';
import {
  generateMeetingIntelligenceAction,
  getMeetingIntelligenceAction,
  convertActionItemToCrmTaskAction,
  generateMeetingPrepBriefAction,
} from '@/app/actions/meeting-intelligence-actions';
import {
  attachMeetingRecordingAction,
  createRecordingUploadAction,
  generateRecordingPlaybackUrlAction,
  getMeetingRecordingsAction,
} from '@/app/actions/meeting-recording-actions';
import type {
  MeetingIntelligence,
  MeetingActionItem,
  MeetingRecording,
  MeetingPrepBrief,
} from '@/lib/meetings/types/intelligence';
import { formatRecordingDuration } from '@/lib/meetings/recording-service';

interface MeetingIntelligenceTabProps {
  meetingId: string;
  workspaceId: string;
  organizationId?: string;
  meetingTitle: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function MeetingIntelligenceTab({
  meetingId,
  workspaceId,
  organizationId,
  meetingTitle: _meetingTitle,
}: MeetingIntelligenceTabProps) {
  const { toast } = useToast();

  const [intelligence, setIntelligence] = React.useState<MeetingIntelligence | null>(null);
  const [recordings, setRecordings] = React.useState<MeetingRecording[]>([]);
  const [_prepBrief, setPrepBrief] = React.useState<MeetingPrepBrief | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [convertingTaskId, setConvertingTaskId] = React.useState<string | null>(null);

  const [recordingModalOpen, setRecordingModalOpen] = React.useState(false);
  const [recordingUrl, setRecordingUrl] = React.useState('');
  const [recordingDurationMinutes, setRecordingDurationMinutes] = React.useState('30');
  const [isAttachingRecording, setIsAttachingRecording] = React.useState(false);

  const [selectedOutcome, setSelectedOutcome] = React.useState<string | null>(null);

  // M1 · T8 state.
  const [addTranscriptOpen, setAddTranscriptOpen] = React.useState(false);
  const [transcript, setTranscript] = React.useState<MeetingGetTranscriptOutput | null>(null);
  const [transcriptRefresh, setTranscriptRefresh] = React.useState(0);
  const [consentEnforced, setConsentEnforced] = React.useState(false);
  const [playback, setPlayback] = React.useState<{ url: string; kind: 'signed' | 'external_link' } | null>(null);
  const [recordingFile, setRecordingFile] = React.useState<File | null>(null);
  const [job, setJob] = React.useState<{ transcriptId: string; status: string } | null>(null);
  const [isStartingTranscription, setIsStartingTranscription] = React.useState(false);
  const [legalHold, setLegalHold] = React.useState<{ on: boolean } | null>(null);
  const [savingHold, setSavingHold] = React.useState(false);

  const handleSelectOutcome = (outcome: string) => {
    // Local selection only: saving outcomes to the CRM is not built yet, so we don't claim it.
    setSelectedOutcome(outcome);
  };

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [intelRes, recRes, policyRes] = await Promise.all([
        getMeetingIntelligenceAction(meetingId, workspaceId),
        getMeetingRecordingsAction(meetingId, workspaceId),
        getWorkspaceCompliancePolicyAction(workspaceId).catch(() => null),
      ]);
      setConsentEnforced(Boolean(policyRes?.success && policyRes.policy?.enforceHostConsentForAI));
      const holdRes = await getMeetingLegalHoldAction(workspaceId, meetingId).catch(() => null);
      setLegalHold(holdRes?.success && holdRes.hold ? { on: holdRes.hold.on } : null);

      if (intelRes.success && intelRes.intelligence) {
        setIntelligence(intelRes.intelligence);
      }
      if (recRes.success && recRes.recordings) {
        setRecordings(recRes.recordings);
        const first = recRes.recordings[0];
        if (first) {
          const play = await generateRecordingPlaybackUrlAction(first.id, workspaceId);
          setPlayback(play.success && play.playbackUrl && play.kind ? { url: play.playbackUrl, kind: play.kind } : null);
        } else {
          setPlayback(null);
        }
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error loading meeting intelligence',
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, workspaceId, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateIntelligence = async () => {
    setIsGenerating(true);
    try {
      const res = await generateMeetingIntelligenceAction(meetingId, workspaceId);
      if (res.success && res.intelligence) {
        setIntelligence(res.intelligence);
        toast({
          title: 'AI Intelligence Generated',
          description: 'Executive summary, action items, and buying signals extracted successfully.',
        });
      } else if (res.code === 'NO_TRANSCRIPT') {
        setAddTranscriptOpen(true);
      } else {
        throw new Error(res.error || 'Failed to generate intelligence');
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConvertToCrmTask = async (item: MeetingActionItem) => {
    setConvertingTaskId(item.id);
    try {
      const res = await convertActionItemToCrmTaskAction(meetingId, workspaceId, item.id);
      if (res.success) {
        setIntelligence(prev => {
          if (!prev) return null;
          return {
            ...prev,
            actionItems: prev.actionItems.map(i =>
              i.id === item.id ? { ...i, status: 'converted_to_crm_task', crmTaskId: res.crmTaskId } : i
            ),
          };
        });
        toast({
          title: 'CRM Task Created',
          description: `Action item converted into an active workspace task.`,
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Conversion Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setConvertingTaskId(null);
    }
  };

  const handleAttachRecording = async () => {
    if (!recordingFile && !recordingUrl.trim()) {
      toast({ variant: 'destructive', title: 'Add a file or link', description: 'Choose a recording file or paste a secure link.' });
      return;
    }

    setIsAttachingRecording(true);
    try {
      const durationSeconds = Math.max(60, parseInt(recordingDurationMinutes || '30', 10) * 60);
      let storagePath: string | undefined;
      if (recordingFile) {
        // Upload straight to the meeting's own Storage folder (signed, 10 minutes, size-bound).
        const policy = await createRecordingUploadAction(workspaceId, meetingId, { name: recordingFile.name, size: recordingFile.size });
        if (!policy.success || !policy.url || !policy.fields || !policy.storagePath) throw new Error(policy.error || 'Upload failed.');
        const form = new FormData();
        for (const [key, value] of Object.entries(policy.fields)) form.append(key, value);
        form.append('file', recordingFile);
        const upload = await fetch(policy.url, { method: 'POST', body: form });
        if (!upload.ok) throw new Error('Upload failed. Check your connection and try again.');
        storagePath = policy.storagePath;
      }
      const res = await attachMeetingRecordingAction({
        workspaceId,
        organizationId,
        meetingId,
        provider: storagePath ? 'smart_sapp' : 'google_meet',
        mediaUrl: storagePath ? '' : recordingUrl.trim(),
        ...(storagePath ? { storagePath, format: recordingFile?.name.split('.').pop()?.toLowerCase() } : {}),
        durationSeconds,
      });

      if (res.success) {
        toast({ title: 'Recording Attached' });
        setRecordingModalOpen(false);
        setRecordingUrl('');
        setRecordingFile(null);
        fetchData();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Attachment Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsAttachingRecording(false);
    }
  };

  const firstRecording = recordings[0];
  const canTranscribe = Boolean(firstRecording?.storagePath && /\.(mp3|wav|aac|ogg|flac|aiff)$/i.test(firstRecording.storagePath));

  const handleTranscribe = async () => {
    if (!firstRecording) return;
    setIsStartingTranscription(true);
    try {
      const res = await transcribeRecordingAction(workspaceId, meetingId, firstRecording.id);
      if (!res.success) {
        toast({ variant: 'destructive', title: "Couldn't start transcription", description: res.error });
        return;
      }
      setJob({ transcriptId: res.data.transcriptId, status: res.data.status });
      toast({ title: res.data.status === 'completed' ? 'Already transcribed' : 'Transcribing…', description: res.data.status === 'completed' ? undefined : "We'll show the transcript when it's ready." });
      if (res.data.status === 'completed') setTranscriptRefresh((n) => n + 1);
    } finally {
      setIsStartingTranscription(false);
    }
  };

  const handleCancelTranscription = async () => {
    if (!job) return;
    const res = await cancelTranscriptionAction(workspaceId, meetingId, job.transcriptId);
    toast({ title: res.success && res.data.cancelRequested ? 'Cancelling…' : 'Nothing to cancel' });
  };

  // Poll the job every 5 s while it runs (bounded: stops on any final state or unmount).
  React.useEffect(() => {
    if (!job || (job.status !== 'pending' && job.status !== 'processing')) return;
    const timer = setInterval(async () => {
      const res = await getTranscriptionStatusAction(workspaceId, meetingId, job.transcriptId);
      if (!res.success) return;
      setJob((j) => (j ? { ...j, status: res.data.status } : j));
      if (res.data.status === 'completed') setTranscriptRefresh((n) => n + 1);
      if (['failed', 'dead_lettered', 'cancelled'].includes(res.data.status)) {
        toast({ variant: 'destructive', title: "Couldn't transcribe", description: res.data.error ?? 'Try again.' });
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [job, workspaceId, meetingId, toast]);

  // Real conversation dynamics from the transcript (no placeholder numbers).
  const coach = React.useMemo(() => {
    if (!transcript || transcript.segments.length < 2) return null;
    return analyzeConversationDynamics(transcript.segments, transcript.speakers, meetingId, workspaceId);
  }, [transcript, meetingId, workspaceId]);

  const strongestSignal = intelligence?.buyingSignals?.reduce<string | null>((best, sig) => {
    const order = ['weak', 'moderate', 'strong'];
    return best === null || order.indexOf(sig.strength) > order.indexOf(best) ? sig.strength : best;
  }, null) ?? null;

  const handleLoadPrepBrief = async () => {
    try {
      const res = await generateMeetingPrepBriefAction(meetingId, workspaceId);
      if (res.success && res.brief) {
        setPrepBrief(res.brief);
      }
    } catch (err) {
      console.warn('[handleLoadPrepBrief]', err);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border border-primary/20">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">AI Meeting Intelligence & Recordings</h3>
            <p className="text-xs text-muted-foreground">
              Automated executive digestion, buying signals, and 1-click CRM task execution.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddTranscriptOpen(true)}
            className="rounded-xl min-h-[44px] text-xs gap-1.5 active:scale-[0.97]"
          >
            <FileText className="h-3.5 w-3.5" />
            {transcript ? 'Add another transcript' : 'Add transcript'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecordingModalOpen(true)}
            className="rounded-xl min-h-[40px] text-xs gap-1.5 active:scale-[0.97]"
          >
            <Video className="h-3.5 w-3.5" />
            Attach Recording
          </Button>
          <Button
            size="sm"
            onClick={handleGenerateIntelligence}
            disabled={isGenerating}
            className="rounded-xl min-h-[40px] text-xs gap-2 font-semibold shadow-sm active:scale-[0.97]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {intelligence ? 'Regenerate AI Digest' : 'Generate AI Digest'}
          </Button>
        </div>
      </div>

      {/* Recording Player Card if attached */}
      {recordings.length > 0 && (
        <Card className="rounded-2xl border shadow-sm overflow-hidden">
          <CardHeader className="py-3 px-5 bg-muted/20 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Session Recording</CardTitle>
            </div>
            <Badge variant="secondary" className="text-[10px] font-bold">
              {formatRecordingDuration(recordings[0].durationSeconds)}
            </Badge>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {playback?.kind === 'signed' ? (
              <div className="aspect-video bg-black/90 rounded-xl overflow-hidden flex items-center justify-center">
                <video src={playback.url} controls preload="metadata" className="w-full h-full object-contain" />
              </div>
            ) : playback?.kind === 'external_link' ? (
              <a href={playback.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-xs font-semibold hover:bg-muted/40">
                <Video className="h-4 w-4" /> Open recording (external link)
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">This recording can&apos;t be played here.</p>
            )}
            {canTranscribe && !transcript && (
              <div className="flex flex-wrap items-center gap-2">
                {job && (job.status === 'pending' || job.status === 'processing') ? (
                  <>
                    <Badge variant="secondary" className="text-[10px] gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Transcribing…</Badge>
                    <Button variant="ghost" size="sm" onClick={handleCancelTranscription} className="rounded-xl min-h-[40px] text-xs">Cancel</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={handleTranscribe} disabled={isStartingTranscription} className="rounded-xl min-h-[44px] text-xs gap-1.5 active:scale-[0.97]">
                    <FileText className="h-3.5 w-3.5" /> {isStartingTranscription ? 'Starting…' : 'Transcribe recording'}
                  </Button>
                )}
                <CardInfoTooltip text="Turns the recording into a transcript. Works for MP3, WAV, AAC, OGG, FLAC or AIFF files up to 14 MB." />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legal hold (M1 review R6b): held meetings are never removed by retention. */}
      {legalHold && (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between gap-3 min-h-[56px]">
            <div className="flex items-center gap-2 text-xs">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <span className="font-semibold">Legal hold</span>
              <CardInfoTooltip text="Keep this meeting's recordings and transcripts even when old data is removed automatically." />
            </div>
            <Switch
              checked={legalHold.on}
              disabled={savingHold}
              aria-label="Legal hold"
              onCheckedChange={async (on) => {
                setSavingHold(true);
                try {
                  const res = await setMeetingLegalHoldAction(workspaceId, meetingId, { on });
                  if (res.success) {
                    setLegalHold({ on });
                    toast({ title: on ? 'Legal hold on' : 'Legal hold off' });
                  } else {
                    toast({ variant: 'destructive', title: "Couldn't change legal hold", description: res.error });
                  }
                } catch (err) {
                  toast({ variant: 'destructive', title: "Couldn't change legal hold", description: getErrorMessage(err) });
                } finally {
                  setSavingHold(false);
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      <MeetingTranscriptPanel
        meetingId={meetingId}
        workspaceId={workspaceId}
        consentEnforced={consentEnforced}
        refreshKey={transcriptRefresh}
        onTranscriptChange={setTranscript}
      />

      {/* Main Intelligence Grid */}
      {!intelligence ? (
        <Card className="rounded-2xl border-dashed p-8 sm:p-10 text-center space-y-3">
          <Sparkles className="h-10 w-10 mx-auto text-primary opacity-40" />
          {transcript ? (
            <>
              <h4 className="text-base font-semibold text-foreground">Ready to analyse</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">Get a summary, action items and signals from this meeting&apos;s transcript.</p>
              <Button onClick={handleGenerateIntelligence} disabled={isGenerating} className="rounded-xl min-h-[44px] text-xs gap-2 active:scale-[0.97]">
                <Sparkles className="h-4 w-4" />
                {isGenerating ? 'Analysing…' : 'Analyse meeting'}
              </Button>
            </>
          ) : (
            <>
              <h4 className="text-base font-semibold text-foreground">Add a transcript to analyse this meeting</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">Upload a file, paste text{canTranscribe ? ', or transcribe the recording' : ''}.</p>
              <Button onClick={() => setAddTranscriptOpen(true)} className="rounded-xl min-h-[44px] text-xs gap-2 active:scale-[0.97]">
                <FileText className="h-4 w-4" />
                Add transcript
              </Button>
            </>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Summary & Action Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Executive Summary Card */}
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Executive Summary
                  </CardTitle>
                  {intelligence.sentiment && (
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-bold uppercase ${
                        intelligence.sentiment.category === 'positive'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : intelligence.sentiment.category === 'negative'
                          ? 'bg-rose-500/10 text-rose-600'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {intelligence.sentiment.category} Sentiment ({Math.round(intelligence.sentiment.score * 100)}%)
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {/* Buying signals summary: from this meeting's analysis only */}
                {strongestSignal && (
                  <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      {intelligence.buyingSignals.length} buying signal{intelligence.buyingSignals.length === 1 ? '' : 's'}
                    </span>
                    <Badge className="bg-purple-600 text-white font-bold text-[10px] uppercase px-3 py-1">Strongest: {strongestSignal}</Badge>
                  </div>
                )}

                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                  {intelligence.executiveSummary}
                </p>

                {intelligence.keyDecisions && intelligence.keyDecisions.length > 0 && (
                  <div className="pt-3 border-t space-y-2">
                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Key Decisions & Next Steps
                    </h5>
                    <ul className="space-y-1.5">
                      {intelligence.keyDecisions.map((dec, i) => (
                        <li key={i} className="text-xs text-foreground flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{dec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Items Matrix */}
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-primary" />
                    Action Items ({intelligence.actionItems?.length || 0})
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">1-Click CRM Sync</span>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                {(!intelligence.actionItems || intelligence.actionItems.length === 0) ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No action items detected.</p>
                ) : (
                  intelligence.actionItems.map(item => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 flex-1">
                        <p className="text-xs font-semibold text-foreground">{item.text}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {item.assigneeName && <span>Assignee: <strong>{item.assigneeName}</strong></span>}
                          <Badge variant="outline" className="text-[9px] uppercase font-bold">
                            {item.priority} priority
                          </Badge>
                        </div>
                      </div>

                      <div>
                        {item.status === 'converted_to_crm_task' ? (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 gap-1 text-[10px]">
                            <Check className="h-3 w-3" />
                            CRM Task Created
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConvertToCrmTask(item)}
                            disabled={convertingTaskId === item.id}
                            className="rounded-lg h-8 text-xs gap-1.5 active:scale-[0.97]"
                          >
                            <Plus className="h-3 w-3" />
                            {convertingTaskId === item.id ? 'Creating...' : 'Convert to Task'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Buying Signals, Objections & Follow-Up */}
          <div className="space-y-6">
            {/* Buying Signals Card */}
            {intelligence.buyingSignals && intelligence.buyingSignals.length > 0 && (
              <Card className="rounded-2xl border shadow-sm">
                <CardHeader className="pb-3 border-b bg-emerald-500/5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-600">
                    <TrendingUp className="h-4 w-4" />
                    Buying Signals Detected
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {intelligence.buyingSignals.map((sig, i) => (
                    <div key={i} className="p-3 rounded-xl bg-muted/30 border space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">{sig.topic}</span>
                        <Badge variant="secondary" className="text-[9px] uppercase font-bold bg-emerald-500/10 text-emerald-600">
                          {sig.strength}
                        </Badge>
                      </div>
                      {sig.quote && (
                        <p className="text-xs text-muted-foreground italic">&quot;{sig.quote}&quot;</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Objections & Risks Card */}
            {intelligence.objections && intelligence.objections.length > 0 && (
              <Card className="rounded-2xl border shadow-sm">
                <CardHeader className="pb-3 border-b bg-amber-500/5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-600">
                    <ShieldAlert className="h-4 w-4" />
                    Objections & Hesitations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {intelligence.objections.map((obj, i) => (
                    <div key={i} className="p-3 rounded-xl bg-muted/30 border space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground capitalize">{obj.category}</span>
                        <Badge variant="outline" className="text-[9px] uppercase text-amber-600 border-amber-300">
                          {obj.severity} severity
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{obj.statement}</p>
                      {obj.suggestedResponse && (
                        <p className="text-[11px] text-primary pt-1 border-t">
                          <strong>Talking Point:</strong> {obj.suggestedResponse}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Conversation dynamics: computed from this meeting's transcript (hidden without one) */}
            {coach && (
              <Card className="rounded-2xl border shadow-sm bg-gradient-to-br from-card to-muted/20">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between text-foreground">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Conversation balance
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold text-amber-600 bg-amber-500/10">
                      Score {coach.overallCoachScore}/100
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between font-medium text-muted-foreground text-[11px]">
                      <span>Talk time</span>
                      <strong className="text-foreground">{coach.talkToListenRatio.hostPercentage}% host / {coach.talkToListenRatio.attendeesPercentage}% others</strong>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex">
                      <div className="h-full bg-primary" style={{ width: `${coach.talkToListenRatio.hostPercentage}%` }} />
                      <div className="h-full bg-emerald-500" style={{ width: `${coach.talkToListenRatio.attendeesPercentage}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 rounded-xl bg-muted/40 border text-[11px]">
                      <span className="text-muted-foreground block">Host pace</span>
                      <strong className="text-foreground">{coach.pacingEvaluation.avgWordsPerMinute} words/min</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-muted/40 border text-[11px]">
                      <span className="text-muted-foreground block">Long monologues (&gt;2 min)</span>
                      <strong className="text-foreground">{coach.monologueAlerts.length}</strong>
                    </div>
                  </div>
                  {coach.tacticalRecommendations[0] && (
                    <p className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground leading-relaxed">
                      {coach.tacticalRecommendations[0]}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Meeting Outcome Selector Card */}
            <Card className="rounded-2xl border shadow-sm bg-card">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Meeting Outcome & Next Step
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <span className="font-semibold text-muted-foreground block text-[11px]">
                  What was the final outcome of this meeting?
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {['Qualified Lead', 'Proposal Requested', 'Follow-up Needed', 'Deal Won'].map(outcome => {
                    const isSelected = selectedOutcome === outcome;
                    return (
                      <button
                        key={outcome}
                        type="button"
                        onClick={() => handleSelectOutcome(outcome)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all active:scale-[0.97] ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
                            : 'border-border/80 hover:border-primary/40 hover:bg-muted/40 text-foreground'
                        }`}
                      >
                        {isSelected ? `✓ ${outcome}` : outcome}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-border/60">
                  <Link href="/admin/meetings/event-types">
                    <Button className="w-full rounded-xl min-h-[38px] text-xs font-bold gap-1.5 active:scale-[0.97]">
                      <Calendar className="w-3.5 h-3.5" /> Schedule Follow-Up Session
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Recommended Follow-up */}
            {intelligence.recommendedFollowUp && (
              <Card className="rounded-2xl border shadow-sm bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">
                    Recommended Follow-up
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-xs text-foreground/90 leading-relaxed">
                  {intelligence.recommendedFollowUp}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <AddTranscriptModal
        open={addTranscriptOpen}
        onOpenChange={setAddTranscriptOpen}
        meetingId={meetingId}
        workspaceId={workspaceId}
        onAdded={() => setTranscriptRefresh((n) => n + 1)}
      />

      {/* Attach Recording Modal */}
      <Dialog open={recordingModalOpen} onOpenChange={setRecordingModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 border-border/80 bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Attach recording</DialogTitle>
            <DialogDescription className="sr-only">Upload a recording file or paste a secure link.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Upload a file</Label>
              <Input
                type="file"
                accept=".mp3,.wav,.aac,.ogg,.flac,.aiff,.m4a,.mp4,.webm"
                onChange={e => setRecordingFile(e.target.files?.[0] ?? null)}
                className="rounded-xl min-h-[44px] text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Up to 500 MB. Audio files up to 14 MB can be transcribed.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">Or paste a link</Label>
              <Input
                value={recordingUrl}
                onChange={e => setRecordingUrl(e.target.value)}
                placeholder="https://…"
                disabled={Boolean(recordingFile)}
                className="rounded-xl min-h-[44px] text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Duration (minutes)</Label>
              <Input
                type="number"
                min="1"
                max="300"
                value={recordingDurationMinutes}
                onChange={e => setRecordingDurationMinutes(e.target.value)}
                className="rounded-xl min-h-[44px] text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRecordingModalOpen(false)}
              disabled={isAttachingRecording}
              className="rounded-xl min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAttachRecording}
              disabled={isAttachingRecording}
              className="rounded-xl min-h-[44px] px-5 active:scale-[0.97]"
            >
              {isAttachingRecording ? 'Attaching...' : 'Attach Recording'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
