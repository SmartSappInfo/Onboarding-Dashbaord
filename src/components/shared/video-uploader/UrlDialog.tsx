'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';

interface UrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (url: string) => void;
  initialValue?: string;
  title?: string;
  description?: string;
  placeholder?: string;
}

export function UrlDialog({
  open,
  onOpenChange,
  onConfirm,
  initialValue = '',
  title = 'Video Link Source',
  description = 'Paste a link to YouTube, Vimeo, Loom, or a direct video file URL (.mp4, .mov, etc.).',
  placeholder = 'https://youtube.com/watch?v=...',
}: UrlDialogProps) {
  const [url, setUrl] = useState(initialValue);

  React.useEffect(() => {
    if (open) {
      setUrl(initialValue || '');
    }
  }, [open, initialValue]);

  const handleConfirm = () => {
    if (url.trim()) {
      onConfirm(url.trim());
      setUrl('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirm();
          }}
          className="flex flex-col m-0"
        >
          <DialogHeader demarcated className="px-6 py-3.5 sm:py-4">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary shrink-0" />
              <DialogTitle className="font-bold text-base tracking-tight">{title}</DialogTitle>
              <CardInfoTooltip text={description} />
            </div>
            <DialogDescription className="sr-only">
              {description}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <Input
              type="url"
              placeholder={placeholder}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-10 rounded-xl bg-muted/50 border-input text-xs font-semibold text-foreground focus-visible:ring-primary/30"
              autoFocus
            />
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
              disabled={!url.trim()}
              className="rounded-xl font-bold min-h-[44px] active:scale-[0.97] bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Apply URL
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
