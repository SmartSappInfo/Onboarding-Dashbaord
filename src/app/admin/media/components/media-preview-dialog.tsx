'use client';

import * as React from 'react';
import Image from 'next/image';
import type { MediaAsset } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Pencil, Check, X, Loader2, FileText } from 'lucide-react';
import { updateMediaName, deleteMediaAsset } from '@/lib/media-actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { cn, formatBytes } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MediaPreviewDialogProps {
  asset: MediaAsset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MediaPreviewDialog({ asset, open, onOpenChange }: MediaPreviewDialogProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = React.useState(false);
  const [newName, setNewName] = React.useState(asset.name);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (open) {
        setIsEditing(false);
        setNewName(asset.name);
        setShowConfirmDelete(false);
        setIsDeleting(false);
    }
  }, [open, asset.name]);

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === asset.name) {
        setIsEditing(false);
        return;
    }
    setIsSaving(true);
    const result = await updateMediaName(asset.id, newName.trim());
    if (result.success) {
        toast({ title: 'Renamed successfully' });
        setIsEditing(false);
    } else {
        toast({ variant: 'destructive', title: 'Rename failed', description: result.error });
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteMediaAsset(asset.id, asset.fullPath);
    if (result.success) {
        toast({ title: 'Asset deleted permanently' });
        onOpenChange(false);
    } else {
        toast({ variant: 'destructive', title: 'Deletion failed', description: result.error });
        setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border shadow-2xl bg-card">
        <DialogHeader className="p-6 border-b bg-card/20 shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <div className="flex items-center gap-2 max-w-md">
                        <Input 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleRename()}
                            autoFocus
                            className="h-10 rounded-xl font-bold text-lg bg-background border-primary/20 shadow-inner"
                        />
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-emerald-600 hover:bg-emerald-50" onClick={handleRename} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:bg-muted" onClick={() => setIsEditing(false)} disabled={isSaving}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
                        <DialogTitle className="truncate text-xl font-bold text-foreground leading-tight">{asset.name}</DialogTitle>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                        </Button>
                    </div>
                )}
                {asset.type === 'link' && asset.linkDescription ? (
                    <DialogDescription className="text-xs font-medium line-clamp-1 mt-1">{asset.linkDescription}</DialogDescription>
                ) : (
                    <DialogDescription className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mt-1.5 flex items-center gap-2">
                        <span>{asset.type} Asset</span>
                        <span>·</span>
                        <span>{asset.mimeType || 'Registry Entry'}</span>
                        {asset.size && (
                            <>
                                <span>·</span>
                                <span className="text-primary font-bold">{formatBytes(asset.size)}</span>
                            </>
                        )}
                    </DialogDescription>
                )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden relative bg-background">
          <ScrollArea className="h-full">
            <div className="p-8 flex flex-col items-center justify-center min-h-full">
                {asset.type === 'image' && (
                    <div className="relative w-full max-w-3xl aspect-video rounded-2xl overflow-hidden shadow-2xl ring-1 ring-border bg-card">
                        <Image src={asset.url} alt={asset.name} fill className="object-contain" />
                    </div>
                )}
                {asset.type === 'video' && (
                    <div className="w-full max-w-3xl shadow-2xl rounded-2xl overflow-hidden ring-1 ring-border bg-black">
                        <video src={asset.url} controls className="w-full" />
                    </div>
                )}
                {asset.type === 'audio' && (
                    <div className="w-full max-w-md p-8 bg-card rounded-2xl shadow-xl ring-1 ring-border">
                        <audio controls src={asset.url} className="w-full" />
                    </div>
                )}
                {asset.type === 'document' && (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-[2rem] shadow-xl ring-1 ring-border max-w-md w-full">
                        <div className="p-6 bg-primary/5 rounded-3xl mb-6">
                            <FileText className="h-12 w-12 text-primary" />
                        </div>
                        <h3 className="font-black uppercase tracking-tight text-lg mb-2">Document Reference</h3>
                        <p className="text-sm text-muted-foreground font-medium mb-8">This file type requires an external viewer.</p>
                        <Button asChild className="rounded-xl font-bold gap-2 h-11 px-8 shadow-lg">
                            <a href={asset.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                                Open in New Tab
                            </a>
                        </Button>
                    </div>
                )}
                {asset.type === 'link' && (
                    <div className="space-y-8 w-full max-w-2xl">
                        {asset.previewImageUrl && (
                            <div className="relative aspect-video bg-card rounded-2xl overflow-hidden shadow-2xl ring-1 ring-border">
                                <Image src={asset.previewImageUrl} alt={`Preview for ${asset.name}`} fill className="object-cover" />
                            </div>
                        )}
                        <div className="flex flex-col items-center justify-center p-10 text-center bg-card rounded-[2rem] shadow-xl ring-1 ring-border">
                            <p className="mb-6 text-[10px] font-mono font-bold text-primary break-all bg-primary/5 p-3 rounded-xl border border-primary/10 w-full">{asset.url}</p>
                            <Button asChild className="rounded-xl font-bold gap-2 h-11 px-8 shadow-lg">
                                <a href={asset.url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                    Launch Source
                                </a>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="p-4 border-t bg-card/80 backdrop-blur-md shrink-0 flex items-center justify-between sm:justify-between">
            <div className="flex items-center gap-2">
                {showConfirmDelete ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-destructive mr-2">Confirm Permanent Deletion?</p>
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            className="rounded-xl font-bold h-9 px-4" 
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <X className="h-3 w-3 mr-2" />}
                            Yes, Delete
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="rounded-xl font-bold h-9 px-4" 
                            onClick={() => setShowConfirmDelete(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <Button 
                        variant="ghost" 
                        className="text-destructive hover:bg-destructive/10 font-bold rounded-xl px-4 h-9"
                        onClick={() => setShowConfirmDelete(true)}
                    >
                        Delete Asset
                    </Button>
                )}
            </div>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="font-bold rounded-xl px-8 h-9">Close Viewer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
