
'use client';

import { useState, useEffect } from 'react';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDoc, collection } from 'firebase/firestore';

import { getLinkMetadata } from '@/ai/flows/get-link-metadata-flow';
import { Link as LinkIcon, Loader2, Layout } from 'lucide-react';
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
import { MultiSelect } from '@/components/ui/multi-select';

const formSchema = z.object({
  name: z.string().min(1, { message: 'A name is required for the link.' }),
  url: z.string().url({ message: 'Please enter a valid URL.' }),
  workspaceIds: z.array(z.string()).min(1, 'Select at least one workspace.'),
});

type FormData = z.infer<typeof formSchema>;

export default function AddLinkButton() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      url: '',
      workspaceIds: [],
    },
  });

  // Sync active workspace to form
  useEffect(() => {
    if (isDialogOpen && activeWorkspaceId) {
        form.setValue('workspaceIds', [activeWorkspaceId]);
    }
  }, [isDialogOpen, activeWorkspaceId, form]);

  const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

  const onSubmit = async (data: FormData) => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Context Missing', description: 'You must be logged in.' });
      return;
    }
    
    setIsProcessing(true);

    try {
        const metadata = await getLinkMetadata({ url: data.url });

        const linkData = {
          name: metadata?.title || data.name,
          url: data.url,
          type: 'link' as const,
          uploadedBy: user.uid,
          workspaceIds: data.workspaceIds,
          createdAt: new Date().toISOString(),
          linkTitle: metadata?.title,
          linkDescription: metadata?.description,
          previewImageUrl: metadata?.imageUrl,
        };

        const mediaCollection = collection(firestore, 'media');
        addDoc(mediaCollection, linkData)
          .then(() => {
            toast({ title: 'Link Added', description: `${linkData.name} has been shared with ${data.workspaceIds.length} workspaces.` });
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
      <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="rounded-xl font-bold border-primary/20 text-primary h-11 px-6 shadow-sm hover:bg-primary/5">
        <LinkIcon className="mr-2 h-4 w-4" />
        Add Link
      </Button>
      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                    <LinkIcon className="h-6 w-6" />
                </div>
                <div className="text-left">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Add Dynamic Link</DialogTitle>
                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Broadcast URLs across workspaces.</DialogDescription>
                </div>
            </div>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-8 text-left bg-background">
              <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Protocol URL</FormLabel>
                        <FormControl>
                          <Input type="url" placeholder="https://www.smartsapp.com" {...field} disabled={isProcessing} className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-mono text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Internal Reference Label</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Marketing Brochure" {...field} disabled={isProcessing} className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="workspaceIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-2">
                            <Layout className="h-3 w-3" /> Destination Hubs
                        </FormLabel>
                        <FormControl>
                          <MultiSelect 
                            options={workspaceOptions}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Share with..."
                            className="rounded-xl border-primary/10 shadow-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>

              <DialogFooter className="pt-4 flex justify-between sm:justify-between items-center bg-muted/30 -mx-8 -mb-8 p-6 border-t">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isProcessing} className="font-bold rounded-xl h-12 px-8">
                  Cancel
                </Button>
                <Button type="submit" disabled={isProcessing} className="rounded-xl font-black h-12 px-10 shadow-2xl active:scale-95 transition-all">
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Initialize Link
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
