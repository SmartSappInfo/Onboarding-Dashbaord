import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  initialValue = ''
}: UrlDialogProps) {
  const [url, setUrl] = useState(initialValue);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please provide a valid audio link.');
      return;
    }

    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL (e.g. https://domain.com/sound.mp3).');
      return;
    }

    setError('');
    onConfirm(url.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <LinkIcon className="w-4 h-4 text-primary" />
            Link Audio URL
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Paste a direct URL to an MP3, WAV, or streaming audio file.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="text-xs font-mono"
              autoFocus
            />
            {error && (
              <p className="text-[10px] text-destructive font-medium">{error}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="text-xs font-bold bg-primary text-primary-foreground"
            >
              Apply Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
