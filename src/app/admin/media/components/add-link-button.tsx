'use client';

/**
 * @fileoverview Add Dynamic Link Dialog Component
 * 
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 1. Payload Sanitization:
 *    All Firestore payload writes pass through `sanitizeFirestorePayload()` to prevent
 *    `Unsupported field value: undefined` runtime crashes from optional duration/metadata fields.
 * 2. Category Deduplication:
 *    Category streams pass through `deduplicateCategories()` to ensure zero duplicate `<SelectItem>` elements.
 * 3. Inline Category Creation:
 *    Users can create new categories directly within this modal using deterministic IDs (`${workspaceId}_${slug}`),
 *    which immediately auto-selects the created category.
 * 4. Mobile & Touch Targets:
 *    All buttons and inputs follow strict accessibility standards (`min-h-[44px]` / `h-11`/`h-12`).
 */

import { useState, useEffect, useCallback } from 'react';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDoc, collection, query, where, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';

import { getLinkMetadataAction } from '@/app/actions/link-metadata-actions';
import { Link as LinkIcon, Loader2, Layout, PlusCircle, Plus, Check, X, Tag } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MediaCategory } from '@/lib/types';
import { extractMediaUrlDuration } from '@/lib/media/duration-extractor';
import {
  deduplicateCategories,
  getDeterministicCategoryId,
  sanitizeFirestorePayload,
} from '@/lib/utils/category-utils';

const formSchema = z.object({
  name: z.string().min(1, { message: 'A name is required for the link.' }),
  url: z.string().url({ message: 'Please enter a valid URL.' }),
  workspaceIds: z.array(z.string()).min(1, 'Select at least one workspace.'),
  category: z.string().min(1, 'Select a category.'),
});

type FormData = z.infer<typeof formSchema>;

export default function AddLinkButton() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

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
      category: 'General',
    },
  });

  // Subscribe to category updates with deduplication
  useEffect(() => {
    if (!firestore || !activeWorkspaceId) return;

    const categoriesQuery = query(
      collection(firestore, 'media_categories'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(categoriesQuery, (snapshot) => {
      const cats = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<MediaCategory, 'id'>),
      })) as MediaCategory[];

      if (cats.length === 0) {
        setCategories([
          { id: `${activeWorkspaceId}_general`, name: 'General', workspaceId: activeWorkspaceId, createdAt: '' },
          { id: `${activeWorkspaceId}_marketing`, name: 'Marketing', workspaceId: activeWorkspaceId, createdAt: '' },
          { id: `${activeWorkspaceId}_messaging`, name: 'Messaging', workspaceId: activeWorkspaceId, createdAt: '' },
        ]);
      } else {
        setCategories(deduplicateCategories(cats));
      }
    });

    return () => unsubscribe();
  }, [firestore, activeWorkspaceId]);

  // Sync active workspace to form
  useEffect(() => {
    if (isDialogOpen && activeWorkspaceId) {
      form.setValue('workspaceIds', [activeWorkspaceId]);
    }
  }, [isDialogOpen, activeWorkspaceId, form]);

  const workspaceOptions = allowedWorkspaces.map((w) => ({ label: w.name, value: w.id }));

  /**
   * Handle Inline Category Creation
   */
  const handleInlineAddCategory = useCallback(async () => {
    if (!firestore || !activeWorkspaceId || !newCategoryName.trim()) return;

    const trimmedName = newCategoryName.trim();
    const normalized = trimmedName.toLowerCase();

    if (categories.some((c) => c.name.toLowerCase() === normalized)) {
      toast({
        variant: 'destructive',
        title: 'Duplicate Category',
        description: `Category "${trimmedName}" already exists.`,
      });
      return;
    }

    setIsSavingCategory(true);
    try {
      const categoryId = getDeterministicCategoryId(activeWorkspaceId, trimmedName);
      const categoryRef = doc(firestore, 'media_categories', categoryId);

      await setDoc(categoryRef, {
        name: trimmedName,
        workspaceId: activeWorkspaceId,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      // Optimistically select the new category in the form
      form.setValue('category', trimmedName);
      setNewCategoryName('');
      setIsAddingCategory(false);

      toast({
        title: 'Category Created',
        description: `"${trimmedName}" is now available and selected.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not create category.';
      toast({
        variant: 'destructive',
        title: 'Failed to create category',
        description: msg,
      });
    } finally {
      setIsSavingCategory(false);
    }
  }, [firestore, activeWorkspaceId, newCategoryName, categories, form, toast]);

  const onSubmit = async (data: FormData) => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Context Missing', description: 'You must be logged in.' });
      return;
    }

    setIsProcessing(true);

    try {
      const result = await getLinkMetadataAction(data.url);

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Error Fetching Metadata',
          description: result.error || 'Could not get metadata from the URL.',
        });
        setIsProcessing(false);
        return;
      }

      const metadata = result.metadata;

      /**
       * Auto-detect video links (YouTube, Vimeo, Loom) to classify as 'video'
       * and assign high-resolution YouTube thumbnails if needed.
       */
      const isVideoUrl = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|loom\.com\/(?:share|embed)\/|vimeo\.com\/)/i.test(data.url);
      const assetType: 'video' | 'link' = isVideoUrl ? 'video' : 'link';

      let thumbnail = metadata?.imageUrl ?? null;
      if (!thumbnail && isVideoUrl) {
        const ytMatch = data.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
        if (ytMatch && ytMatch[1]) {
          thumbnail = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
        }
      }

      const extractedDuration = await extractMediaUrlDuration(data.url);

      // Safe, strictly typed payload without undefined fields
      const rawLinkData: Record<string, unknown> = {
        name: metadata?.title || data.name,
        url: data.url,
        type: assetType,
        uploadedBy: user.uid,
        workspaceIds: data.workspaceIds,
        category: data.category,
        createdAt: new Date().toISOString(),
        linkTitle: metadata?.title || null,
        linkDescription: metadata?.description || null,
        previewImageUrl: thumbnail || null,
      };

      if (extractedDuration) {
        rawLinkData.duration = extractedDuration;
      }

      const linkData = sanitizeFirestorePayload(rawLinkData);

      const mediaCollection = collection(firestore, 'media');
      addDoc(mediaCollection, linkData)
        .then(() => {
          toast({ title: 'Link Added', description: `${String(linkData.name ?? 'Link')} has been added successfully.` });
          setIsDialogOpen(false);
          form.reset();
        })
        .catch((_error: unknown) => {
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

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Could not get metadata from the URL.';
      toast({
        variant: 'destructive',
        title: 'Error Fetching Metadata',
        description: errMsg,
      });
      setIsProcessing(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (isProcessing) return;
    if (!open) {
      form.reset();
      setIsAddingCategory(false);
      setNewCategoryName('');
    }
    setIsDialogOpen(open);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsDialogOpen(true)}
        className="rounded-xl font-bold border-primary/20 text-primary h-11 px-6 shadow-sm hover:bg-primary/5 active:scale-95 transition-all"
      >
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
                <DialogTitle className="text-xl font-semibold tracking-tight">Add Dynamic Link</DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground">Broadcast URLs across workspaces.</DialogDescription>
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
                      <FormLabel className="text-[10px] font-semibold text-muted-foreground ml-1">Protocol URL</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://www.youtube.com/watch?v=..."
                          {...field}
                          disabled={isProcessing}
                          className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-mono text-sm"
                        />
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
                      <FormLabel className="text-[10px] font-semibold text-muted-foreground ml-1">Internal Reference Label</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Welcome Onboard SmartSapp"
                          {...field}
                          disabled={isProcessing}
                          className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-[10px] font-semibold text-muted-foreground ml-1">Category</FormLabel>
                        {!isAddingCategory ? (
                          <button
                            type="button"
                            onClick={() => setIsAddingCategory(true)}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 min-h-[30px] px-1 focus:outline-none"
                          >
                            <Plus className="h-3 w-3" />
                            New Category
                          </button>
                        ) : null}
                      </div>

                      {/* Inline Category Creator */}
                      {isAddingCategory ? (
                        <div className="flex items-center gap-2 p-2 bg-muted/30 border border-primary/20 rounded-xl transition-all duration-200 ease-out animate-in fade-in zoom-in-95">
                          <Tag className="h-4 w-4 text-primary ml-2 shrink-0" />
                          <Input
                            placeholder="New category name..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            disabled={isSavingCategory}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleInlineAddCategory();
                              } else if (e.key === 'Escape') {
                                setIsAddingCategory(false);
                                setNewCategoryName('');
                              }
                            }}
                            autoFocus
                            className="h-10 text-xs font-semibold bg-background border border-border/50 rounded-lg shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleInlineAddCategory}
                            disabled={isSavingCategory || !newCategoryName.trim()}
                            className="h-10 px-3 rounded-lg font-semibold shrink-0"
                          >
                            {isSavingCategory ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsAddingCategory(false);
                              setNewCategoryName('');
                            }}
                            disabled={isSavingCategory}
                            className="h-10 px-2 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-inner text-left font-bold focus:ring-1 focus:ring-primary/20">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border max-h-60">
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.name} className="font-semibold text-xs py-2.5">
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="workspaceIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={isProcessing}
                  className="font-bold rounded-xl h-12 px-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isProcessing}
                  className="rounded-xl font-semibold h-12 px-10 shadow-2xl active:scale-95 transition-all"
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlusCircle className="mr-2 h-4 w-4" />
                  )}
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
