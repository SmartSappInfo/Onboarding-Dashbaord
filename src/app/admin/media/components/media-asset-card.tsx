'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * 
 * 1. Asset Card Lifecycle & Actions:
 *    Renders individual media asset thumbnails (hosted MP4 vs linked YouTube/Vimeo/Loom)
 *    and provides context menu actions for full preview, sharing, visibility management,
 *    category assignment, and asset deletion.
 * 2. Performance & Memory Optimizations:
 *    Employs third-party thumbnail generators (YouTube, Vimeo, Loom) and lazy video previews
 *    without mounting heavy player APIs in card grid views.
 * 3. Mobile & Touch Target Compliance:
 *    All buttons and dropdown menu actions enforce `min-h-[44px]` touch target bounds.
 */

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { doc, deleteDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { extractMediaUrlDuration } from '@/lib/media/duration-extractor';

import type { MediaAsset } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
    MoreVertical, Copy, Trash2, Video, AudioWaveform, FileText, 
    Link as LinkIcon, Eye, TextCursorInput, Share2, Layout, 
    Check, CheckCircle2, ShieldCheck, Loader2, Building2,
    Youtube, HardDrive, Link2, Tag, Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MediaPreviewDialog from './media-preview-dialog';
import RenameMediaDialog from './rename-media-dialog';
import ShareMediaDialog from './share-media-dialog';
import ChangeCategoryDialog from './change-category-dialog';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { MultiSelect } from '@/components/ui/multi-select';
import { useWorkspace } from '@/context/WorkspaceContext';

const getYouTubeThumbnail = (url: string) => {
  try {
    const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i;
    const match = url.match(regExp);
    if (match && match[1]) {
      return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
    }
  } catch (e: unknown) {}
  return null;
};

const getVimeoThumbnail = (url: string) => {
  try {
    const regExp = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/;
    const match = url.match(regExp);
    if (match && match[1]) {
      return `https://vumbnail.com/${match[1]}.jpg`;
    }
  } catch (e: unknown) {}
  return null;
};

const getLoomThumbnail = (url: string) => {
  try {
    const match = url.match(/loom\.com\/share\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://cdn.loom.com/sessions/thumbnails/${match[1]}-with-play.gif`;
    }
  } catch (e: unknown) {}
  return null;
};

interface MediaAssetCardProps {
  asset: MediaAsset;
  onCardClick?: (asset: MediaAsset) => void;
  isConfigured?: boolean;
}

export default function MediaAssetCard({ asset, onCardClick, isConfigured = false }: MediaAssetCardProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { allowedWorkspaces } = useWorkspace();
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [localWorkspaceIds, setLocalWorkspaceIds] = useState<string[]>(asset.workspaceIds || []);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  const handleMainClick = () => {
    if (onCardClick) {
      onCardClick(asset);
    } else {
      setIsPreviewOpen(true);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(asset.url);
    toast({ title: 'Copied to clipboard!', description: asset.url });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateVisibility = async () => {
    if (!firestore || localWorkspaceIds.length === 0) {
        if(localWorkspaceIds.length === 0) toast({ variant: 'destructive', title: 'Constraint Alert', description: 'Asset must belong to at least one workspace.' });
        return;
    }
    
    setIsUpdatingVisibility(true);
    try {
        await updateDoc(doc(firestore, 'media', asset.id), {
            workspaceIds: localWorkspaceIds,
            updatedAt: new Date().toISOString()
        });
        toast({ title: 'Visibility Synchronized', description: `Shared with ${localWorkspaceIds.length} hubs.` });
        setIsVisibilityOpen(false);
    } catch (e: unknown) {
        toast({ variant: 'destructive', title: 'Update Failed', description: e instanceof Error ? e.message : 'Update failed.' });
    } finally {
        setIsUpdatingVisibility(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore) return;
    
    if (asset.fullPath) {
        const storage = getStorage();
        const fileRef = ref(storage, asset.fullPath);
        try {
            await deleteObject(fileRef);
        } catch (error: unknown) {
            console.error("Error deleting from storage: ", error);
        }
    }

    // Purge associated sharing configurations in firestore
    try {
        const sharesQuery = query(
            collection(firestore, 'media_shares'),
            where('assetId', '==', asset.id)
        );
        const sharesSnap = await getDocs(sharesQuery);
        for (const docMatch of sharesSnap.docs) {
            await deleteDoc(doc(firestore, 'media_shares', docMatch.id));
        }
    } catch (err: unknown) {
        console.warn('Error purging associated media_shares configs:', err);
    }

    const docRef = doc(firestore, 'media', asset.id);
    deleteDoc(docRef)
      .then(() => {
        toast({ title: 'Asset Purged', description: `${asset.name} has been removed from all repositories.` });
      })
      .catch((error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Error Deleting Asset',
          description: 'You may not have the required permissions.',
        });
      })
      .finally(() => {
        setIsDeleteDialogOpen(false);
      });
  };
  
  const AssetIcon = () => {
    switch (asset.type) {
 case 'video': return <Video className="w-16 h-16 text-muted-foreground" />;
 case 'audio': return <AudioWaveform className="w-16 h-16 text-muted-foreground" />;
 case 'document': return <FileText className="w-16 h-16 text-muted-foreground" />;
 case 'link': return <LinkIcon className="w-16 h-16 text-muted-foreground" />;
      default: return null;
    }
  };

  const isYouTube = !!getYouTubeThumbnail(asset.url);
  const isVimeo = !!getVimeoThumbnail(asset.url);
  const isLoom = !!getLoomThumbnail(asset.url);
  const isLinkedVideo = isYouTube || isVimeo || isLoom || asset.type === 'link';

  const thirdPartyThumbnail = getYouTubeThumbnail(asset.url) || getVimeoThumbnail(asset.url) || getLoomThumbnail(asset.url);
  const previewSrc = asset.type === 'image' ? asset.url : (asset.previewImageUrl || (asset as { previewUrl?: string }).previewUrl || thirdPartyThumbnail || null);
  const hasPreviewImage = !!previewSrc;

  const isVideoAsset = asset.type === 'video' || 
    asset.url.toLowerCase().split('?')[0].split('#')[0].endsWith('.mp4') ||
    asset.url.toLowerCase().split('?')[0].split('#')[0].endsWith('.webm') ||
    asset.url.toLowerCase().split('?')[0].split('#')[0].endsWith('.ogg') ||
    asset.url.toLowerCase().split('?')[0].split('#')[0].endsWith('.mov');

  const isPdfAsset = (asset.type === 'document' && (asset.mimeType === 'application/pdf' || asset.name.toLowerCase().endsWith('.pdf') || asset.url.toLowerCase().includes('.pdf'))) ||
    asset.url.toLowerCase().split('?')[0].split('#')[0].endsWith('.pdf');

  const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));
  const rawAssetRecord = asset as unknown as Record<string, string>;
  const assetDuration = asset.duration || rawAssetRecord.mediaDuration || rawAssetRecord.formattedDuration;

  const [resolvedDuration, setResolvedDuration] = useState<string | null>(null);

  useEffect(() => {
    if (assetDuration) return;
    if (asset.type !== 'video' && asset.type !== 'audio' && !isLinkedVideo) return;
    if (!asset.url) return;

    let isMounted = true;
    extractMediaUrlDuration(asset.url).then((dur) => {
      if (isMounted && dur) {
        setResolvedDuration(dur);
        if (firestore && asset.id) {
          updateDoc(doc(firestore, 'media', asset.id), { duration: dur }).catch(() => {});
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [asset.url, asset.type, asset.id, assetDuration, isLinkedVideo, firestore]);

  const displayDuration = assetDuration || resolvedDuration;

  return (
    <>
      <Card className="group relative overflow-hidden rounded-3xl border-border/50 hover:shadow-2xl transition-all duration-700 bg-card">
        <CardContent className="p-0">
          <div
            className="aspect-square w-full bg-background0 flex items-center justify-center cursor-pointer overflow-hidden relative"
            onClick={handleMainClick}
          >
            {hasPreviewImage && previewSrc ? (
              previewSrc.startsWith('https://firebasestorage.googleapis.com') || previewSrc.startsWith('/') ? (
                <Image
                  src={previewSrc}
                  alt={asset.name}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                  className="object-cover transition-transform duration-1000 group-hover:scale-110"
                />
              ) : (
                <img
                  src={previewSrc}
                  alt={asset.name}
                  className="object-cover w-full h-full transition-transform duration-1000 group-hover:scale-110 absolute inset-0"
                />
              )
            ) : isVideoAsset ? (
              <video
                src={`${asset.url}#t=0.1`}
                preload="metadata"
                className="object-cover w-full h-full transition-transform duration-1000 group-hover:scale-110"
                muted
                playsInline
              />
            ) : isPdfAsset ? (
              <div className="w-full h-full pointer-events-none select-none overflow-hidden bg-white">
                <iframe
                  src={`${asset.url}#toolbar=0&navpanes=0&scrollbar=0`}
                  className="w-full h-full border-none scale-105 origin-top-left"
                  scrolling="no"
                />
              </div>
            ) : asset.type === 'link' ? (
              <div className="w-full h-full absolute inset-0 pointer-events-none select-none overflow-hidden bg-white">
                <iframe
                  src={asset.url}
                  className="w-[400%] h-[400%] absolute top-0 left-0 border-none scale-[0.25] origin-top-left"
                  scrolling="no"
                />
              </div>
            ) : (
                <AssetIcon />
            )}
            
            {/* Top-Left Badges: Source Type (Hosted vs Linked), Duration & Shared Status */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 flex-wrap">
              {asset.type === 'video' && (
                isLinkedVideo ? (
                  <Badge className="bg-black/60 backdrop-blur-md text-[8px] font-black uppercase px-2 h-5 border border-white/10 shadow-md text-red-400 gap-1 tracking-wider">
                    {isYouTube ? <Youtube className="h-3 w-3 text-red-500 fill-current" /> : <Link2 className="h-3 w-3 text-sky-400" />}
                    Linked
                  </Badge>
                ) : (
                  <Badge className="bg-black/60 backdrop-blur-md text-[8px] font-black uppercase px-2 h-5 border border-white/10 shadow-md text-indigo-300 gap-1 tracking-wider">
                    <HardDrive className="h-3 w-3 text-indigo-400" />
                    Hosted
                  </Badge>
                )
              )}
              {Boolean(displayDuration) && (
                <Badge className="bg-black/80 backdrop-blur-md text-[8px] font-black tabular-nums px-2 h-5 border border-white/10 shadow-md text-emerald-300 gap-1 tracking-wider">
                  <Clock className="h-2.5 w-2.5 text-emerald-400" />
                  {displayDuration}
                </Badge>
              )}
              {asset.workspaceIds && asset.workspaceIds.length > 1 && (
                <Badge className="bg-primary/80 backdrop-blur-md text-[8px] font-semibold uppercase px-2 h-5 border-none shadow-lg">
                  <Share2 className="h-2.5 w-2.5 mr-1" /> Shared
                </Badge>
              )}
            </div>
          </div>
          
          <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 text-white">
            <p className="text-sm font-semibold truncate leading-tight tracking-tight">{asset.name}</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[9px] font-bold tabular-nums opacity-60">
                {asset.width && asset.height ? `${asset.width}x${asset.height} · ` : ''}
                {format(new Date(asset.createdAt), 'MMM d')}
              </span>
              <div className="flex items-center gap-1.5">
                {isConfigured ? (
                  <span 
                    title="Active Media Landing Page & Embed Configured"
                    className="inline-flex items-center gap-1 text-[8px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 backdrop-blur-md shadow-sm animate-in fade-in zoom-in-95 duration-300"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active Page
                  </span>
                ) : (
                  <span 
                    title="Unconfigured Standby Asset"
                    className="inline-flex items-center gap-1 text-[8px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-400 border border-slate-700/50 backdrop-blur-md shadow-sm opacity-60 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                    Standby
                  </span>
                )}
      {asset.category && (
        <span className="text-[8px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/10 border border-white/5 backdrop-blur-sm text-white/90">
          {asset.category}
        </span>
      )}
    </div>
  </div>
</div>

  <div className="absolute top-2 right-2 flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsShareOpen(true)}
              className="h-11 w-11 min-h-[44px] min-w-[44px] text-white bg-black/20 hover:bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-500 active:scale-95"
              title="Share / Embed"
            >
              <Share2 size={18} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCopyUrl}
              className="h-11 w-11 min-h-[44px] min-w-[44px] text-white bg-black/20 hover:bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-500 active:scale-95"
              title="Copy URL"
            >
              {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px] text-white bg-black/20 hover:bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-500 active:scale-95">
                  <MoreVertical size={18} />
                </Button>
              </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="rounded-2xl w-56 p-2 border-none shadow-2xl animate-in zoom-in-95 duration-200">
 <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground px-3 py-2">Asset Logic</DropdownMenuLabel>
                
 <DropdownMenuItem onClick={handleMainClick} className="rounded-xl p-2.5 gap-3">
 <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Eye className="h-4 w-4" /></div>
 <span className="font-bold text-sm">Full Preview</span>
                </DropdownMenuItem>

 <DropdownMenuItem onClick={() => setIsShareOpen(true)} className="rounded-xl p-2.5 gap-3">
 <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400"><Share2 className="h-4 w-4" /></div>
 <span className="font-bold text-sm">Share & Embed</span>
 </DropdownMenuItem>

 <DropdownMenuItem onClick={() => setIsVisibilityOpen(true)} className="rounded-xl p-2.5 gap-3">
 <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400"><Building2 className="h-4 w-4" /></div>
 <span className="font-bold text-sm">Manage Visibility</span>
                </DropdownMenuItem>

 <DropdownMenuItem onClick={() => setIsRenameOpen(true)} className="rounded-xl p-2.5 gap-3">
 <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><TextCursorInput className="h-4 w-4" /></div>
 <span className="font-bold text-sm">Rename Reference</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => setIsCategoryOpen(true)} className="rounded-xl p-2.5 gap-3">
                  <div className="p-1.5 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-purple-600 dark:text-purple-400"><Tag className="h-4 w-4" /></div>
                  <span className="font-bold text-sm">Change Category</span>
                </DropdownMenuItem>

 <DropdownMenuItem onClick={handleCopyUrl} className="rounded-xl p-2.5 gap-3">
 <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Copy className="h-4 w-4" /></div>
 <span className="font-bold text-sm">Copy Gateway URL</span>
                </DropdownMenuItem>

 <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem
 className="text-destructive focus:bg-destructive/10 rounded-xl p-2.5 gap-3 focus:text-destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
 <Trash2 className="h-4 w-4" />
 <span className="font-bold text-sm">Purge from Library</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
      
      {/* Visibility Manager Dialog */}
      <Dialog open={isVisibilityOpen} onOpenChange={setIsVisibilityOpen}>
 <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
 <DialogHeader className="p-8 bg-emerald-50 border-b border-emerald-100 shrink-0">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-200">
 <Share2 className="h-6 w-6" />
                    </div>
 <div className="text-left">
 <DialogTitle className="text-xl font-semibold tracking-tight">Shared Context</DialogTitle>
 <DialogDescription className="text-xs font-bold text-emerald-700 opacity-70">Manage visibility across hubs.</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
 <div className="p-8 space-y-6 bg-background text-left">
 <div className="space-y-4">
 <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
 <Layout className="h-3.5 w-3.5" /> Destination Mapping
                    </Label>
                    <MultiSelect 
                        options={workspaceOptions}
                        value={localWorkspaceIds}
                        onChange={setLocalWorkspaceIds}
                        placeholder="Map to workspaces..."
 className="rounded-xl border-primary/10 shadow-sm"
                    />
                </div>
                
 <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-4 shadow-inner">
 <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
 <p className="text-[9px] font-bold text-blue-800 leading-relaxed tracking-tighter">
                        Assets shared across multiple workspaces will be accessible to any user with permission for at least one of those hubs.
                    </p>
                </div>
            </div>
 <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between items-center sm:justify-between">
 <Button variant="ghost" onClick={() => setIsVisibilityOpen(false)} disabled={isUpdatingVisibility} className="rounded-xl font-bold h-12 px-8">Discard</Button>
                <Button 
                    onClick={handleUpdateVisibility} 
                    disabled={isUpdatingVisibility || localWorkspaceIds.length === 0}
 className="rounded-xl font-semibold h-12 px-10 shadow-2xl bg-primary text-white gap-2 text-xs"
                >
 {isUpdatingVisibility ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Synchronize Access
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
 <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
          <AlertDialogHeader>
 <div className="mx-auto bg-destructive/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
 <Trash2 className="h-7 w-7 text-destructive" />
            </div>
 <AlertDialogTitle className="font-semibold tracking-tight text-center">Purge Asset Globally?</AlertDialogTitle>
 <AlertDialogDescription className="text-sm font-medium text-center">
 Removing <span className="font-bold text-foreground">"{asset.name}"</span> will delete it from the library and storage bucket. This will break visibility in all {asset.workspaceIds?.length || 1} associated workspaces.
            </AlertDialogDescription>
          </AlertDialogHeader>
 <AlertDialogFooter className="sm:justify-center gap-3 mt-4">
 <AlertDialogCancel className="rounded-xl font-bold h-12 px-8">Keep Asset</AlertDialogCancel>
 <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-semibold h-12 px-10 shadow-xl text-xs ">Confirm Purge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MediaPreviewDialog asset={asset} open={isPreviewOpen} onOpenChange={setIsPreviewOpen} />
      <RenameMediaDialog asset={asset} open={isRenameOpen} onOpenChange={setIsRenameOpen} />
      <ShareMediaDialog asset={asset} open={isShareOpen} onOpenChange={setIsShareOpen} />
      <ChangeCategoryDialog asset={asset} open={isCategoryOpen} onOpenChange={setIsCategoryOpen} />
    </>
  );
}
