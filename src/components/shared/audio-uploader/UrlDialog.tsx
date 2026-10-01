'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Link as LinkIcon } from 'lucide-react';

interface UrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (url: string) => void;
  initialValue?: string;
}

export function UrlDialog({
  open,
  onOpenChange,
  onConfirm,
  initialValue = '',
}: UrlDialogProps) {
  const [url, setUrl] = useState(initialValue);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (open) {
      setUrl(initialValue || '');
      setError('');
    }
  }, [open, initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please provide a valid audio link.');
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setError('Please enter a valid HTTP or HTTPS audio URL.');
        return;
      }
    } catch {
      setError('Please enter a valid URL (e.g. https://domain.com/sound.mp3).');
      return;
    }

    setError('');
    onConfirm(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col m-0">
          <DialogHeader demarcated className="px-6 py-3.5 sm:py-4">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-primary shrink-0" />
              <DialogTitle className="font-bold text-base tracking-tight">Link Audio URL</DialogTitle>
              <CardInfoTooltip text="Paste a direct URL to an MP3, WAV, or streaming audio file." />
            </div>
            <DialogDescription className="sr-only">
              Paste a direct URL to an MP3, WAV, or streaming audio file.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="audio-url" className="text-xs font-semibold">
                Audio Link
              </Label>
              <Input
                id="audio-url"
                placeholder="https://example.com/audio.mp3"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError('');
                }}
                className="text-xs font-mono rounded-xl"
                autoFocus
              />
              {error && (
                <p className="text-[10px] text-destructive font-medium">{error}</p>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold min-h-[44px] active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-xl font-bold min-h-[44px] active:scale-[0.97] bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Apply Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
