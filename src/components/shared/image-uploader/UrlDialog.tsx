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
      <DialogContent className="rounded-2xl border-slate-800 bg-slate-950 text-slate-100 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xs font-bold uppercase tracking-wider text-slate-300">Image URL Link</DialogTitle>
          <DialogDescription className="text-[10px] text-slate-500">
            Paste a direct web link to an image asset.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            type="url"
            placeholder="https://example.com/image.png"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-10 rounded-xl bg-slate-900 border-slate-800 text-xs font-semibold text-slate-200 focus-visible:ring-emerald-500/30"
          />
        </div>
        <DialogFooter className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-9 text-xs text-slate-400 hover:bg-slate-900">Cancel</Button>
          <Button type="button" onClick={handleConfirm} disabled={!url.trim()} className="h-9 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl">Save Link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
