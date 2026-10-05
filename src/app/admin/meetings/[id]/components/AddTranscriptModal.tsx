'use client';

/**
 * @fileOverview Add a transcript to a meeting: upload a file or paste text (Phase 11 M1 · T8).
 *
 * UX (Rule 7, theme.md §8): bottom sheet on phones, standard demarcated dialog on larger screens,
 * 44 px targets, short plain copy, guidance in a CardInfoTooltip. Upload goes straight to Cloud
 * Storage with a signed POST policy (5 MB files exceed the 2 MB Server Action limit), then the
 * server ingests it. All checks (size, type, consent) also run on the server.
 *
 * CAUTION: never render transcript text as HTML here; this component only sends text.
 */

import * as React from 'react';
import { Upload, ClipboardPaste, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import {
  createTranscriptUploadAction,
  ingestPastedTranscriptAction,
  ingestUploadedTranscriptAction,
} from '@/app/actions/meeting-transcript-actions';

const ACCEPT = '.vtt,.srt,.txt,.docx';
const MAX_BYTES = 5 * 1024 * 1024;

interface AddTranscriptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  workspaceId: string;
  onAdded: () => void;
}

export function AddTranscriptModal({ open, onOpenChange, meetingId, workspaceId, onAdded }: AddTranscriptModalProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<'upload' | 'paste'>('upload');
  const [file, setFile] = React.useState<File | null>(null);
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setText('');
      setBusy(false);
    }
  }, [open]);

  const fail = (message: string) => toast({ variant: 'destructive', title: "Couldn't add transcript", description: message });

  const done = (flagged: boolean, replayed: boolean) => {
    toast({
      title: replayed ? 'Transcript already added' : 'Transcript added',
      description: flagged ? 'Some lines look like instructions. They were saved as text only.' : undefined,
    });
    onOpenChange(false);
    onAdded();
  };

  const submitUpload = async () => {
    if (!file) return;
    if (file.size > MAX_BYTES) return fail('This file is larger than 5 MB. Split it and try again.');
    setBusy(true);
    try {
      const policy = await createTranscriptUploadAction(workspaceId, meetingId, { name: file.name, size: file.size });
      if (!policy.success) return fail(policy.error);
      const form = new FormData();
      for (const [key, value] of Object.entries(policy.data.fields)) form.append(key, value);
      form.append('file', file);
      const upload = await fetch(policy.data.url, { method: 'POST', body: form });
      if (!upload.ok) return fail('Upload failed. Check your connection and try again.');
      const res = await ingestUploadedTranscriptAction(workspaceId, meetingId, policy.data.storagePath);
      if (!res.success) return fail(res.error);
      done(res.data.injectionFlagged, res.data.replayed);
    } catch {
      fail('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitPaste = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await ingestPastedTranscriptAction(workspaceId, meetingId, text);
      if (!res.success) return fail(res.error);
      done(res.data.injectionFlagged, res.data.replayed);
    } catch {
      fail('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = !busy && (tab === 'upload' ? Boolean(file) : text.trim().length > 0);

  const body = (
    <Tabs value={tab} onValueChange={(v) => setTab(v === 'paste' ? 'paste' : 'upload')} className="px-6 py-4 space-y-4">
      <TabsList className="grid grid-cols-2 w-full rounded-xl">
        <TabsTrigger value="upload" className="min-h-[44px] gap-1.5 text-xs"><Upload className="h-3.5 w-3.5" /> Upload file</TabsTrigger>
        <TabsTrigger value="paste" className="min-h-[44px] gap-1.5 text-xs"><ClipboardPaste className="h-3.5 w-3.5" /> Paste text</TabsTrigger>
      </TabsList>
      <TabsContent value="upload" className="mt-0">
        <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-center text-xs text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
          <Upload className="h-5 w-5" />
          <span className="font-medium text-foreground">{file ? file.name : 'Choose a file'}</span>
          <span>VTT, SRT, TXT or DOCX · up to 5 MB</span>
          <input
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </TabsContent>
      <TabsContent value="paste" className="mt-0">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Ama: Thanks for joining…\nKwame: Happy to be here.'}
          className="min-h-[180px] rounded-xl text-xs"
          aria-label="Transcript text"
        />
      </TabsContent>
    </Tabs>
  );

  const actions = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy} className="rounded-xl min-h-[44px] active:scale-[0.97]">Cancel</Button>
      <Button onClick={tab === 'upload' ? submitUpload : submitPaste} disabled={!canSubmit} className="rounded-xl min-h-[44px] px-5 active:scale-[0.97]">
        {busy ? 'Adding…' : 'Add transcript'}
      </Button>
    </>
  );

  const guidance = 'Add what was said in the meeting. Use a file exported from Meet, Zoom or Teams, or paste lines like "Name: what they said".';

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 border-border/80 bg-card max-h-[90dvh] overflow-y-auto">
          <SheetHeader className="flex flex-row items-center gap-2 border-b border-border/80 bg-muted/20 px-6 py-3.5 text-left space-y-0">
            <SheetTitle className="text-base">Add transcript</SheetTitle>
            <CardInfoTooltip text={guidance} />
            <SheetDescription className="sr-only">{guidance}</SheetDescription>
          </SheetHeader>
          {body}
          <div className="flex flex-row justify-end gap-2.5 border-t border-border/80 bg-muted/15 px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">{actions}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        <DialogHeader demarcated>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base">Add transcript</DialogTitle>
            <CardInfoTooltip text={guidance} />
          </div>
          <DialogClose className="rounded-full h-8 w-8 inline-flex items-center justify-center hover:bg-muted/80 active:scale-95" aria-label="Close">
            <X className="h-4 w-4" />
          </DialogClose>
          <DialogDescription className="sr-only">{guidance}</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
