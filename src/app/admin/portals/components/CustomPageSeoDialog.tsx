'use client';

import * as React from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SeoSettingsCard } from '@/components/seo/SeoSettingsCard';
import { MediaSelect } from '@/app/admin/entities/components/media-select';
import { generateKeywordsAction } from '@/app/actions/survey-seo-actions';
import type { SeoConfig } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export interface CustomPageSeoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageKey: string;
  currentTitle: string;
  currentPath: string;
}

export function CustomPageSeoDialog({
  open,
  onOpenChange,
  pageKey,
  currentTitle,
  currentPath,
}: CustomPageSeoDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isGeneratingKeywords, setIsGeneratingKeywords] = React.useState(false);
  const [seo, setSeo] = React.useState<SeoConfig>({
    title: '',
    description: '',
    keywords: '',
    ogImageUrl: '',
    ogImageMode: 'asset',
    useContentFallback: true,
  });

  const docId = React.useMemo(() => {
    return pageKey.replace(/^\/|\/$/g, '').replace(/\//g, '__') || 'homepage';
  }, [pageKey]);

  React.useEffect(() => {
    if (!open || !firestore) return;
    
    let active = true;
    setIsLoading(true);
    
    async function loadSeo() {
      try {
        const docRef = doc(firestore, 'custom_pages_seo', docId);
        const snap = await getDoc(docRef);
        if (active) {
          if (snap.exists()) {
            const data = snap.data();
            setSeo({
              title: data.title ?? '',
              description: data.description ?? '',
              keywords: data.keywords ?? '',
              ogImageUrl: data.ogImageUrl ?? '',
              ogImageMode: data.ogImageUrl ? 'custom' : 'asset',
              useContentFallback: data.useContentFallback ?? false,
            });
          } else {
            // Default to using content fallback
            setSeo({
              title: '',
              description: '',
              keywords: '',
              ogImageUrl: '',
              ogImageMode: 'asset',
              useContentFallback: true,
            });
          }
        }
      } catch (err) {
        console.error('Error loading custom page SEO:', err);
        if (active) {
          toast({
            variant: 'destructive',
            title: 'Failed to load SEO configuration',
            description: 'Please try again.',
          });
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadSeo();
    
    return () => {
      active = false;
    };
  }, [open, firestore, docId, toast]);

  const handleSave = React.useCallback(async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      const docRef = doc(firestore, 'custom_pages_seo', docId);
      await setDoc(docRef, {
        title: seo.title ?? '',
        description: seo.description ?? '',
        keywords: seo.keywords ?? '',
        ogImageUrl: seo.ogImageUrl ?? '',
        useContentFallback: seo.useContentFallback ?? false,
        updatedAt: new Date().toISOString(),
      });
      toast({
        title: 'SEO Settings Saved',
        description: 'Your open graph tags have been updated.',
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving custom page SEO:', err);
      toast({
        variant: 'destructive',
        title: 'Failed to save SEO settings',
        description: 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [firestore, docId, seo, onOpenChange, toast]);

  const handleGenerateKeywords = React.useCallback(async () => {
    const title = seo.title || currentTitle;
    const desc = seo.description || 'Welcome to SmartSapp';
    setIsGeneratingKeywords(true);
    try {
      const res = await generateKeywordsAction(title, desc);
      if (res.success && res.keywords && res.keywords.length > 0) {
        setSeo(prev => ({ ...prev, keywords: res.keywords.join(', ') }));
        toast({
          title: 'Keywords Generated',
          description: 'AI has generated keywords based on your page details.',
        });
      }
    } catch (error) {
      console.error('Failed to generate keywords:', error);
    } finally {
      setIsGeneratingKeywords(false);
    }
  }, [seo.title, seo.description, currentTitle, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl p-0 text-left bg-background">
        <DialogHeader className="p-6 border-b shrink-0 bg-muted/10">
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Configure SEO &amp; Social previews</DialogTitle>
          <DialogDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">
            Editing search and social sharing tags for <strong className="text-foreground">{currentPath}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <SeoSettingsCard
              value={seo}
              onChange={setSeo}
              assetLabel="Default Meta Image"
              assetImageUrl="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1772732878319-Onboarding%20Meta%20image.webp?alt=media&token=f74f6912-135d-4b5e-b784-609017e6bb12"
              entityLogoUrl={undefined}
              contentTitle={currentTitle}
              contentDescription=""
              previewUrl={`go.smartsapp.com${currentPath}`}
              onGenerateKeywords={handleGenerateKeywords}
              isGeneratingKeywords={isGeneratingKeywords}
              renderImagePicker={(val, onChange) => (
                <MediaSelect value={val} onChange={onChange} filterType="image" className="rounded-2xl" />
              )}
            />
          )}
        </div>

        <DialogFooter className="p-6 border-t shrink-0 flex items-center justify-end gap-3 bg-muted/10">
          <Button
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
            className="rounded-2xl font-black text-[10px] uppercase tracking-widest h-10 px-6 shrink-0"
          >
            Cancel
          </Button>
          <Button
            disabled={isLoading || isSaving}
            onClick={handleSave}
            className="rounded-2xl font-black text-[10px] uppercase tracking-widest bg-primary text-white hover:bg-primary/95 shadow-lg shadow-primary/20 h-10 px-6 shrink-0"
          >
            {isSaving && <Loader2 className="mr-2 h-3 w-3 animate-spin text-white" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
