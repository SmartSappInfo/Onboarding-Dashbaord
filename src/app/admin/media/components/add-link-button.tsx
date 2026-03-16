
'use client';

import { useState } from 'react';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDoc, collection } from 'firebase/firestore';

import { getLinkMetadata } from '@/ai/flows/get-link-metadata-flow';
import { Link as LinkIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';

const formSchema = z.object({
  name: z.string().min(1, { message: 'A name is required for the link.' }),
  url: z.string().url({ message: 'Please enter a valid URL.' }),
});

type FormData = z.infer<typeof formSchema>;

export default function AddLinkButton() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      url: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!user || !firestore || !activeWorkspaceId) {
      toast({ variant: 'destructive', title: 'Context Missing', description: 'You must be logged in and within a workspace.' });
      return;
    }
    
    setIsProcessing(true);

    try {
        // 1. Fetch metadata from the URL
        const metadata = await getLinkMetadata({ url: data.url });

        // 2. Prepare the data for Firestore
        const linkData = {
          name: metadata?.title || data.name,
          url: data.url,
          type: 'link' as const,
          uploadedBy: user.uid,
          workspaceId: activeWorkspaceId,
          createdAt: new Date().toISOString(),
          linkTitle: metadata?.title,
          linkDescription: metadata?.description,
          previewImageUrl: metadata?.imageUrl,
        };

        // 3. Save to Firestore
        const mediaCollection = collection(firestore, 'media');
        addDoc(mediaCollection, linkData)
          .then(() => {
            toast({ title: 'Link Added', description: `${linkData.name} has been added to your library.` });
            setIsDialogOpen(false);
            form.reset();
          })
          .catch((error) => {
            const permissionError = new FirestorePermissionError({
                path: mediaCollection.path,
                operation: 'create',
                requestResourceData: linkData,
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
              variant: 'destructive',
              title: 'Error Adding Link',
              description: 'Could not save the link. You may not have the required permissions.',
            });
          })
          .finally(() => {
            setIsProcessing(false);
          });

    } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error Fetching Metadata',
          description: error.message || 'Could not get metadata from the URL.',
        });
        setIsProcessing(false);
    }
  };
  
  const handleOpenChange = (open: boolean) => {
      if (isProcessing) return;
      if (!open) {
          form.reset();
      }
      setIsDialogOpen(open);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="rounded-xl font-bold border-primary/20 text-primary">
        <LinkIcon className="mr-2 h-4 w-4" />
        Add Link
      </Button>
      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="rounded-2xl text-left">
          <DialogHeader>
            <DialogTitle>Add a New Link</DialogTitle>
            <DialogDescription>
              Save a URL to the <strong>{activeWorkspaceId}</strong> workspace media library.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest opacity-60">Fallback Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., SmartSapp Website" {...field} disabled={isProcessing} className="h-11 rounded-xl bg-muted/20 border-none shadow-inner" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest opacity-60">URL</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://www.smartsapp.com" {...field} disabled={isProcessing} className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-mono text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4 flex justify-between sm:justify-between">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isProcessing} className="font-bold rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={isProcessing} className="rounded-xl font-black px-8">
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isProcessing ? 'Saving...' : 'Save Link'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
