'use client';

/**
 * @fileOverview Meeting transcript + consent panel (Phase 11 M1 · T8).
 *
 * - Shows the latest transcript as PLAIN TEXT (React text nodes only, never HTML; Rule 8).
 * - Renders at most 200 lines at a time ("Show more"), and pages of 500 from the server (Rule 54).
 * - Delete asks for confirmation and is bound to the version shown (Rules 18/22).
 * - Consent row appears only when the workspace enforces consent (PRD §98).
 */

import * as React from 'react';
import { FileText, Trash2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import { formatTimestampMs } from '@/lib/meetings/transcript-service';
import type { MeetingGetTranscriptOutput } from '@/platform/domains/meetings_conversations';
import type { MeetingConsents, ConsentType } from '@/lib/meetings/consent-store';
import {
  deleteMeetingTranscriptAction,
  getMeetingConsentsAction,
  getMeetingTranscriptAction,
  recordMeetingConsentAction,
} from '@/app/actions/meeting-transcript-actions';

const RENDER_STEP = 200;
const CONSENT_LABELS: Array<{ type: ConsentType; label: string }> = [
  { type: 'recording', label: 'Recording' },
  { type: 'transcription', label: 'Transcription' },
  { type: 'aiProcessing', label: 'AI analysis' },
  { type: 'marketing', label: 'Marketing' },
];

interface MeetingTranscriptPanelProps {
  meetingId: string;
  workspaceId: string;
  consentEnforced: boolean;
  refreshKey: number;
  onTranscriptChange: (t: MeetingGetTranscriptOutput | null) => void;
  /** Scroll to and highlight a line ("Line N" from the outcomes panel, M2 · T6). */
  focus?: { segmentId: string; transcriptId?: string; nonce: number } | null;
}

const PAGE_MAX_LINES = 500;

export function MeetingTranscriptPanel({ meetingId, workspaceId, consentEnforced, refreshKey, onTranscriptChange, focus }: MeetingTranscriptPanelProps) {
  const { toast } = useToast();
  const [transcript, setTranscript] = React.useState<MeetingGetTranscriptOutput | null>(null);
  const [visible, setVisible] = React.useState(RENDER_STEP);
  const [loading, setLoading] = React.useState(true);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [consents, setConsents] = React.useState<MeetingConsents | null>(null);
  const [savingConsent, setSavingConsent] = React.useState<ConsentType | null>(null);
  const [highlight, setHighlight] = React.useState<string | null>(null);

  const load = React.useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const res = await getMeetingTranscriptAction(workspaceId, meetingId, page);
      const data = res.success ? res.data : null;
      setTranscript(data);
      setVisible(RENDER_STEP);
      onTranscriptChange(data);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, meetingId, onTranscriptChange]);

  const loadConsents = React.useCallback(async () => {
    if (!consentEnforced) return;
    const res = await getMeetingConsentsAction(workspaceId, meetingId);
    if (res.success) setConsents(res.data);
  }, [consentEnforced, workspaceId, meetingId]);

  React.useEffect(() => { void load(0); }, [load, refreshKey]);
  React.useEffect(() => { void loadConsents(); }, [loadConsents]);

  // "Line N" jump: find the page holding the line (pages hold ≤ 500 lines, so it is on page
  // floor(N / 500) or later), render up to it, scroll, and highlight it for a moment.
  const transcriptRef = React.useRef(transcript);
  transcriptRef.current = transcript;
  React.useEffect(() => {
    if (!focus) return;
    const index = /^s(\d+)$/.exec(focus.segmentId);
    if (!index) return;
    let cancelled = false;
    (async () => {
      let current = transcriptRef.current;
      const sameTranscript = !focus.transcriptId || current?.transcriptId === focus.transcriptId;
      let position = sameTranscript ? current?.segments.findIndex((s) => s.id === focus.segmentId) ?? -1 : -1;
      if (position < 0) {
        const pageCount = current?.pageCount ?? 1;
        for (let page = Math.floor(Number(index[1]) / PAGE_MAX_LINES); page < pageCount && !cancelled; page += 1) {
          const res = await getMeetingTranscriptAction(workspaceId, meetingId, page, focus.transcriptId);
          if (!res.success || !res.data) return;
          current = res.data;
          position = current.segments.findIndex((s) => s.id === focus.segmentId);
          if (position >= 0) {
            setTranscript(current);
            onTranscriptChange(current);
            break;
          }
        }
      }
      if (cancelled || position < 0) return;
      setVisible((v) => Math.max(v, position + 1));
      setHighlight(focus.segmentId);
      requestAnimationFrame(() => document.getElementById(`tline-${focus.segmentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      setTimeout(() => !cancelled && setHighlight(null), 2500);
    })();
    return () => {
      cancelled = true;
    };
  }, [focus, workspaceId, meetingId, onTranscriptChange]);

  const toggleConsent = async (type: ConsentType, granted: boolean) => {
    if (!consents) return;
    setSavingConsent(type);
    try {
      const res = await recordMeetingConsentAction(workspaceId, meetingId, { type, granted, method: 'verbal', expectedVersion: consents.version });
      if (!res.success) {
        toast({ variant: 'destructive', title: "Couldn't save consent", description: res.error });
      } else if (res.data.restrictedTranscripts > 0) {
        toast({ title: 'Consent updated', description: 'AI analysis is now off for this meeting.' });
      }
      await loadConsents();
    } finally {
      setSavingConsent(null);
    }
  };

  const remove = async () => {
    if (!transcript) return;
    setDeleting(true);
    try {
      // Bound to the version the person saw when confirming (Rules 18/22).
      const del = await deleteMeetingTranscriptAction(workspaceId, meetingId, transcript.transcriptId, transcript.version);
      if (!del.success) {
        toast({ variant: 'destructive', title: "Couldn't delete transcript", description: del.error });
      } else {
        toast({ title: 'Transcript deleted' });
        await load(0);
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-4">
      {consentEnforced && (
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="py-3 px-5 border-b bg-muted/20 flex flex-row items-center gap-2 space-y-0">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Consent</CardTitle>
            <CardInfoTooltip text="Your workspace requires consent before recordings are transcribed or analysed by AI." />
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CONSENT_LABELS.map(({ type, label }) => {
              const state = consents?.current[type];
              return (
                <label key={type} className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-border/80 px-3 text-xs">
                  <span className="font-medium">{label}</span>
                  <Switch
                    checked={state?.granted === true}
                    disabled={!consents || savingConsent !== null}
                    onCheckedChange={(v) => toggleConsent(type, v)}
                    aria-label={`${label} consent`}
                  />
                </label>
              );
            })}
          </CardContent>
        </Card>
      )}

      {!loading && transcript && (
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="py-3 px-5 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <CardTitle className="text-sm font-semibold truncate">Transcript</CardTitle>
              <Badge variant="secondary" className="text-[10px]">{transcript.segmentCount} lines</Badge>
              {transcript.injectionFlagged && (
                <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-300">
                  <AlertTriangle className="h-3 w-3" /> Needs review
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} className="h-10 w-10 rounded-xl" aria-label="Delete transcript">
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <ol className="space-y-2">
              {transcript.segments.slice(0, visible).map((s) => (
                <li
                  key={s.id}
                  id={`tline-${s.id}`}
                  className={`text-xs leading-relaxed rounded-lg px-1 -mx-1 transition-colors ${highlight === s.id ? 'bg-primary/15' : ''}`}
                >
                  <span className="text-muted-foreground tabular-nums mr-2">{formatTimestampMs(s.startMs)}</span>
                  <strong className="font-semibold mr-1">{s.speakerName}:</strong>
                  <span>{s.text}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              {visible < transcript.segments.length && (
                <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + RENDER_STEP)} className="rounded-xl min-h-[40px] text-xs">Show more</Button>
              )}
              {visible >= transcript.segments.length && transcript.page + 1 < transcript.pageCount && (
                <Button variant="outline" size="sm" onClick={() => load(transcript.page + 1)} className="rounded-xl min-h-[40px] text-xs">Next part</Button>
              )}
              {transcript.page > 0 && (
                <Button variant="ghost" size="sm" onClick={() => load(transcript.page - 1)} className="rounded-xl min-h-[40px] text-xs">Previous part</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transcript?</AlertDialogTitle>
            <AlertDialogDescription>This removes the transcript and anything made from it. You can&apos;t undo this.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl min-h-[44px]" disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl min-h-[44px] bg-destructive text-destructive-foreground" onClick={(e) => { e.preventDefault(); void remove(); }} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
