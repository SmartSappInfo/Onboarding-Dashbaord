
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
import { MoreVertical, Copy, Trash2, Video, AudioWaveform, FileText, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MediaPreviewDialog from './media-preview-dialog';
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
      <Card className="group relative overflow-hidden rounded-lg">
        <CardContent className="p-0">
          <div
            className="aspect-square w-full bg-muted flex items-center justify-center cursor-pointer"
            onClick={handleMainClick}
          >
            {hasPreviewImage && previewSrc ? (
              <Image
                src={previewSrc}
                alt={asset.name}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                className="object-cover transition-transform group-hover:scale-105"
              />
            ) : (
                <AssetIcon />
            )}
          </div>
          <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/70 to-transparent p-2 text-white">
            <p className="text-xs font-medium truncate">{asset.name}</p>
            <p className="text-xs text-gray-300">{asset.width && asset.height ? `${asset.width}x${asset.height} - ` : ''}{format(new Date(asset.createdAt), 'MMM d, yyyy')}</p>
          </div>
          <div className="absolute top-1 right-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white bg-black/30 hover:bg-black/50 hover:text-white">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopyUrl}>
                  <Copy className="mr-2 h-4 w-4" />
                  <span>Copy URL</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                  onSelect={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the asset <span className="font-bold">{asset.name}</span> from the library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!onCardClick && (
        <MediaPreviewDialog asset={asset} open={isPreviewOpen} onOpenChange={setIsPreviewOpen} />
      )}
    </>
  );
}
