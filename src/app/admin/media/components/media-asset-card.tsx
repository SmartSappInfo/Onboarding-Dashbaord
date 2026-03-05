'use client';

import { useState } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { doc, deleteDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

import type { MediaAsset } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { MoreVertical, Copy, Trash2, Video, AudioWaveform, FileText, Link as LinkIcon, Pencil, TextCursorInput, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MediaPreviewDialog from './media-preview-dialog';
import RenameMediaDialog from './rename-media-dialog';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

interface MediaAssetCardProps {
  asset: MediaAsset;
  onCardClick?: (asset: MediaAsset) => void;
}

export default function MediaAssetCard({ asset, onCardClick }: MediaAssetCardProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);

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
  };

  const handleDelete = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Firestore not available.' });
      return;
    }
    
    // 1. Delete from Firebase Storage if it's a file
    if (asset.fullPath) {
        const storage = getStorage();
        const fileRef = ref(storage, asset.fullPath);
        try {
            await deleteObject(fileRef);
        } catch (error: any) {
            // We still try to delete the Firestore doc even if storage deletion fails
            console.error("Error deleting from storage: ", error);
            toast({
                variant: 'destructive',
                title: 'Storage Deletion Failed',
                description: 'Could not delete the file from storage, but will attempt to delete the record.',
            });
        }
    }

    // 2. Delete from Firestore
    const docRef = doc(firestore, 'media', asset.id);
    deleteDoc(docRef)
      .then(() => {
        toast({ title: 'Asset Deleted', description: `${asset.name} has been deleted.` });
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

  const hasPreviewImage = asset.type === 'image' || (asset.type === 'link' && asset.previewImageUrl);
  const previewSrc = asset.type === 'image' ? asset.url : asset.previewImageUrl;


  return (
    <>
      <Card className="group relative overflow-hidden rounded-2xl border-border/50 hover:shadow-xl transition-all duration-500 bg-card">
        <CardContent className="p-0">
          <div
            className="aspect-square w-full bg-muted/50 flex items-center justify-center cursor-pointer overflow-hidden"
            onClick={handleMainClick}
          >
            {hasPreviewImage && previewSrc ? (
              <Image
                src={previewSrc}
                alt={asset.name}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
                <AssetIcon />
            )}
          </div>
          <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white">
            <p className="text-xs font-black uppercase tracking-tight truncate">{asset.name}</p>
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mt-0.5">{asset.width && asset.height ? `${asset.width}x${asset.height} · ` : ''}{format(new Date(asset.createdAt), 'MMM d, yyyy')}</p>
          </div>
          <div className="absolute top-2 right-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white bg-black/20 hover:bg-black/60 backdrop-blur-md rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl w-48">
                <DropdownMenuItem onClick={handleMainClick} className="gap-2">
                  <Eye className="h-4 w-4" />
                  <span>View Details</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsRenameOpen(true)} className="gap-2">
                  <TextCursorInput className="h-4 w-4" />
                  <span>Rename</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyUrl} className="gap-2">
                  <Copy className="h-4 w-4" />
                  <span>Copy URL</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive focus:text-white gap-2"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Asset</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight">Delete Asset?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              This will permanently remove <span className="font-bold text-foreground">"{asset.name}"</span> from the library. Any emails or forms referencing this URL may break.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold">Confirm Deletion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MediaPreviewDialog asset={asset} open={isPreviewOpen} onOpenChange={setIsPreviewOpen} />
      <RenameMediaDialog asset={asset} open={isRenameOpen} onOpenChange={setIsRenameOpen} />
    </>
  );
}
