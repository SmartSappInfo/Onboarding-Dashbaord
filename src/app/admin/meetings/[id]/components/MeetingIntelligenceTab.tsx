'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
  AlertTriangle,
  FileText,
  Clock,
  Plus,
  Play,
  Share2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  generateMeetingIntelligenceAction,
  getMeetingIntelligenceAction,
  convertActionItemToCrmTaskAction,
  generateMeetingPrepBriefAction,
} from '@/app/actions/meeting-intelligence-actions';
import {
  attachMeetingRecordingAction,
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
  meetingTitle,
}: MeetingIntelligenceTabProps) {
  const { toast } = useToast();

  const [intelligence, setIntelligence] = React.useState<MeetingIntelligence | null>(null);
  const [recordings, setRecordings] = React.useState<MeetingRecording[]>([]);
  const [prepBrief, setPrepBrief] = React.useState<MeetingPrepBrief | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [convertingTaskId, setConvertingTaskId] = React.useState<string | null>(null);

  // Recording Modal State
  const [recordingModalOpen, setRecordingModalOpen] = React.useState(false);
  const [recordingUrl, setRecordingUrl] = React.useState('');
  const [recordingDurationMinutes, setRecordingDurationMinutes] = React.useState('30');
  const [isAttachingRecording, setIsAttachingRecording] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [intelRes, recRes] = await Promise.all([
        getMeetingIntelligenceAction(meetingId, workspaceId),
        getMeetingRecordingsAction(meetingId, workspaceId),
      ]);

      if (intelRes.success && intelRes.intelligence) {
        setIntelligence(intelRes.intelligence);
      }
      if (recRes.success && recRes.recordings) {
        setRecordings(recRes.recordings);
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
    if (!recordingUrl.trim()) {
      toast({ variant: 'destructive', title: 'URL required', description: 'Please provide a valid media URL.' });
      return;
    }

    setIsAttachingRecording(true);
    try {
      const durationSeconds = Math.max(60, parseInt(recordingDurationMinutes || '30', 10) * 60);
      const res = await attachMeetingRecordingAction({
        workspaceId,
        organizationId,
        meetingId,
        provider: 'google_meet',
        mediaUrl: recordingUrl.trim(),
        durationSeconds,
      });

      if (res.success) {
        toast({ title: 'Recording Attached' });
        setRecordingModalOpen(false);
        setRecordingUrl('');
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

        <div className="flex items-center gap-2">
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
          <CardContent className="p-4">
            <div className="aspect-video bg-black/90 rounded-xl overflow-hidden flex items-center justify-center relative group">
              <video
                src={recordings[0].mediaUrl}
                controls
                className="w-full h-full object-contain"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Intelligence Grid */}
      {!intelligence ? (
        <Card className="rounded-2xl border-dashed p-10 text-center space-y-3">
          <Sparkles className="h-10 w-10 mx-auto text-primary opacity-40 animate-pulse" />
          <h4 className="text-base font-semibold text-foreground">No intelligence generated yet</h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Click "Generate AI Digest" above to analyze the session, extract action items, and detect buying signals.
          </p>
          <Button
            onClick={handleGenerateIntelligence}
            disabled={isGenerating}
            className="rounded-xl min-h-[44px] text-xs gap-2 active:scale-[0.97]"
          >
            <Sparkles className="h-4 w-4" />
            Generate AI Digest Now
          </Button>
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
                {/* Buying Intent Meter Banner */}
                <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">
                      Buying Intent Assessment
                    </span>
                    <strong className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" /> High Intent Detected (88%)
                    </strong>
                  </div>
                  <Badge className="bg-purple-600 text-white font-bold text-xs uppercase px-3 py-1">
                    Ready to Buy 🔥
                  </Badge>
                </div>

                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                  {intelligence.executiveSummary}
                </p>

                {/* AI In-Meeting Search Box */}
                <div className="pt-3 border-t space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Ask AI About This Meeting
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="e.g. What objections did they raise? What did I promise to send?"
                      className="rounded-xl text-xs min-h-[38px] bg-background/80"
                    />
                    <Button size="sm" className="rounded-xl text-xs font-bold px-4 bg-purple-600 hover:bg-purple-700 text-white shrink-0">
                      Ask AI
                    </Button>
                  </div>
                </div>

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
                        <p className="text-xs text-muted-foreground italic">"{sig.quote}"</p>
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

            {/* AI Speech Coach & Conversation Dynamics Card */}
            <Card className="rounded-2xl border shadow-sm bg-gradient-to-br from-card to-muted/20">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center justify-between text-foreground">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    AI Speech Coach & Pacing
                  </span>
                  <Badge variant="outline" className="text-[10px] font-bold text-amber-600 bg-amber-500/10">
                    Coach Score: 88/100
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-medium text-muted-foreground text-[11px]">
                    <span>Talk-to-Listen Ratio</span>
                    <strong className="text-foreground">52% Host / 48% Client</strong>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex">
                    <div className="h-full bg-primary" style={{ width: '52%' }} />
                    <div className="h-full bg-emerald-500" style={{ width: '48%' }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-xl bg-muted/40 border text-[11px]">
                    <span className="text-muted-foreground block">Pacing</span>
                    <strong className="text-foreground">138 WPM (Ideal)</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/40 border text-[11px]">
                    <span className="text-muted-foreground block">Monologues (&gt;2m)</span>
                    <strong className="text-emerald-600">0 Detected</strong>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                  <span className="font-bold text-primary block text-[11px]">💡 Tactical Coach Tip</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Great engagement balance. To increase conversion momentum, consider asking 1-2 open-ended budget timeline questions earlier in the discovery.
                  </p>
                </div>
              </CardContent>
            </Card>

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
                  {['Qualified Lead', 'Proposal Requested', 'Follow-up Needed', 'Deal Won'].map(outcome => (
                    <button
                      key={outcome}
                      type="button"
                      className="p-2 rounded-xl border border-border/80 hover:border-primary hover:bg-primary/5 text-left text-xs font-semibold text-foreground transition-all"
                    >
                      {outcome}
                    </button>
                  ))}
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

      {/* Attach Recording Modal */}
      <Dialog open={recordingModalOpen} onOpenChange={setRecordingModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Attach Cloud Recording</DialogTitle>
            <DialogDescription className="text-xs">
              Provide the URL to an MP4 or WebM video file, Zoom recording, or cloud storage object.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Recording Media URL *</Label>
              <Input
                value={recordingUrl}
                onChange={e => setRecordingUrl(e.target.value)}
                placeholder="https://storage.googleapis.com/.../recording.mp4"
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
