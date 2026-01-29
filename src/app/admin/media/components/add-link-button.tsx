'use client';

import { useState } from 'react';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDoc, collection } from 'firebase/firestore';

import { Link as LinkIcon } from 'lucide-react';
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

const formSchema = z.object({
  name: z.string().min(1, { message: 'Link name is required.' }),
  url: z.string().url({ message: 'Please enter a valid URL.' }),
});

type FormData = z.infer<typeof formSchema>;

export default function AddLinkButton() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      url: '',
    },
  });

  const onSubmit = (data: FormData) => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'You must be logged in to add a link.' });
      return;
    }

    const linkData = {
      name: data.name,
      url: data.url,
      type: 'link' as const,
      uploadedBy: user.uid,
      createdAt: new Date().toISOString(),
    };

    const mediaCollection = collection(firestore, 'media');
    form.control.disabled = true;

    addDoc(mediaCollection, linkData)
      .then(() => {
        toast({ title: 'Link Added', description: `${data.name} has been added to your library.` });
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
          description: 'Could not save the link.',
        });
      })
      .finally(() => {
        form.control.disabled = false;
      });
  };
  
  const handleOpenChange = (open: boolean) => {
      if (!open) {
          form.reset();
      }
      setIsDialogOpen(open);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
        <LinkIcon className="mr-2 h-4 w-4" />
        Add Link
      </Button>
      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a New Link</DialogTitle>
            <DialogDescription>
              Save a URL to your media library. It can be used later.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., SmartSapp Website" {...field} />
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
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://www.smartsapp.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Link'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
