import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface UrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (url: string) => void;
}

export function UrlDialog({ open, onOpenChange, onConfirm }: UrlDialogProps) {
  const [url, setUrl] = useState('');

  const handleConfirm = () => {
    if (url.trim()) {
      onConfirm(url.trim());
      setUrl('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border bg-background text-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
            Video Link Source
          </DialogTitle>
          <DialogDescription className="text-[10px] text-muted-foreground">
            Paste a link to YouTube, Vimeo, Loom, or a direct video file URL (.mp4, .mov, etc.).
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-10 rounded-xl bg-muted/50 border-input text-xs font-semibold text-foreground focus-visible:ring-emerald-500/30"
          />
        </div>
        <DialogFooter className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-9 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!url.trim()}
            className="h-9 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl active:scale-[0.97] transition-transform duration-150"
          >
            Apply URL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
