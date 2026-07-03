
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, where, onSnapshot, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MediaAsset, MediaCategory } from '@/lib/types';

import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Film, LayoutList, Layers, Cpu, Settings, Plus, X, Loader2 } from 'lucide-react';
import MediaAssetCard from './components/media-asset-card';
import UploadButton from './components/upload-button';
import AddLinkButton from './components/add-link-button';
import { useWorkspace } from '@/context/WorkspaceContext';
import { PageContainerFluid } from '@/components/ui/page-container';
import PdfCompressorView from './components/PdfCompressorView';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * @fileOverview Media Hub Client.
 * Displays a workspace-bound gallery of digital assets using server-side filtering.
 */

const TABS = [
  { id: 'images', label: 'Images', type: 'image' },
  { id: 'videos', label: 'Videos', type: 'video' },
  { id: 'audio', label: 'Audio', type: 'audio' },
  { id: 'documents', label: 'Documents', type: 'document' },
  { id: 'links', label: 'Links', type: 'link' },
];

export default function MediaClient() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { activeWorkspaceId, isLoading: isWorkspaceLoading } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('images');
  const [currentView, setCurrentView] = useState<'gallery' | 'compressor'>('gallery');
  
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Subscribe to category updates and seed default ones if none exist
  useEffect(() => {
    if (!firestore || !activeWorkspaceId) return;

    const categoriesQuery = query(
      collection(firestore, 'media_categories'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(categoriesQuery, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MediaCategory[];

      // Seeding logic: if completely empty, seed standard ones
      if (cats.length === 0) {
        const seedCategories = async () => {
          try {
            const colRef = collection(firestore, 'media_categories');
            await Promise.all([
              addDoc(colRef, { name: 'General', workspaceId: activeWorkspaceId, createdAt: new Date().toISOString() }),
              addDoc(colRef, { name: 'Marketing', workspaceId: activeWorkspaceId, createdAt: new Date().toISOString() }),
              addDoc(colRef, { name: 'Messaging', workspaceId: activeWorkspaceId, createdAt: new Date().toISOString() })
            ]);
          } catch (err) {
            console.error('Failed to seed categories', err);
          }
        };
        seedCategories();
      } else {
        setCategories(cats);
      }
    });

    return () => unsubscribe();
  }, [firestore, activeWorkspaceId]);

  const handleAddCategory = async () => {
    if (!firestore || !activeWorkspaceId || !newCategoryName.trim()) return;

    const normalized = newCategoryName.trim().toLowerCase();
    if (categories.some(c => c.name.toLowerCase() === normalized)) {
      toast({ variant: 'destructive', title: 'Duplicate Category', description: 'This category already exists.' });
      return;
    }

    setIsSavingCategory(true);
    try {
      await addDoc(collection(firestore, 'media_categories'), {
        name: newCategoryName.trim(),
        workspaceId: activeWorkspaceId,
        createdAt: new Date().toISOString()
      });
      setNewCategoryName('');
      toast({ title: 'Category Created', description: `"${newCategoryName.trim()}" is now available.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not create category.';
      toast({ variant: 'destructive', title: 'Failed to create category', description: msg });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (!firestore) return;
    
    try {
      await deleteDoc(doc(firestore, 'media_categories', catId));
      toast({ title: 'Category Removed', description: `"${catName}" has been deleted.` });
      if (selectedCategory === catName) {
        setSelectedCategory('all');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not delete category.';
      toast({ variant: 'destructive', title: 'Failed to delete category', description: msg });
    }
  };

  const currentType = useMemo(() => 
    TABS.find(t => t.id === activeTab)?.type || 'image', 
  [activeTab]);

  const mediaCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'media');
  }, [firestore]);

  // HIGH PERFORMANCE: Filter by workspace AND type on the server
  const mediaQuery = useMemoFirebase(() => {
    if (!mediaCol || !activeWorkspaceId) return null;
    return query(
        mediaCol, 
        where('workspaceIds', 'array-contains', activeWorkspaceId),
        where('type', '==', currentType),
        orderBy('createdAt', 'desc')
    );
  }, [mediaCol, activeWorkspaceId, currentType]);
  
  const { data: assets, isLoading: isMediaLoading, error } = useCollection<MediaAsset>(mediaQuery);

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    
    let result = assets;

    // Filter by selected category (treating undefined/missing category as 'General')
    if (selectedCategory !== 'all') {
      result = result.filter(asset => {
        const cat = asset.category || 'General';
        return cat.toLowerCase() === selectedCategory.toLowerCase();
      });
    }

    // Filter by search term
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(asset =>
        asset.name.toLowerCase().includes(s) || 
        asset.linkTitle?.toLowerCase().includes(s)
      );
    }

    return result;
  }, [assets, selectedCategory, searchTerm]);

  const isLoading = isWorkspaceLoading || isMediaLoading;

  return (
    <PageContainerFluid>
      <div className="h-full overflow-y-auto w-full">
        <div className="space-y-6 pb-32 w-full text-left">
          
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex flex-col items-start">
              <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
                {currentView === 'gallery' ? 'Media Hub' : 'PDF Compressor'}
              </h1>
              <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                {currentView === 'gallery' 
                  ? 'Workspace assets and visual resources' 
                  : 'Optimize, downsample, and compress PDF documents client-side'}
              </p>
            </div>
            
            <div className="flex justify-end items-center gap-3 shrink-0">
              {currentView === 'gallery' && (
                <>
                  <AddLinkButton />
                  <UploadButton />
                </>
              )}
            </div>
          </div>

          {/* Sub-view Selector Tabs (Emil Kowalski micro-interactions & active taps) */}
          <div className="flex border-b border-border/80 pb-px gap-6 mb-4">
            <button
              onClick={() => setCurrentView('gallery')}
              className={cn(
                "pb-3 font-bold text-xs uppercase tracking-wider border-b-2 transition-all active:scale-97 outline-none",
                currentView === 'gallery' 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Gallery Repository
            </button>
            <button
              onClick={() => setCurrentView('compressor')}
              className={cn(
                "pb-3 font-bold text-xs uppercase tracking-wider border-b-2 transition-all active:scale-97 outline-none flex items-center gap-1.5",
                currentView === 'compressor' 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Cpu className="h-3.5 w-3.5" /> PDF Compressor
            </button>
          </div>

          {/* Tab Views */}
          {currentView === 'compressor' ? (
            <div className="min-h-[400px] pt-2">
              <PdfCompressorView />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Gallery Filters */}
              <div className="flex flex-col lg:flex-row items-center gap-4 text-left">
                {/* Search */}
                <div className="relative flex-grow w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                  <Input 
                    placeholder="Filter your assets..." 
                    className="pl-11 h-12 rounded-xl border border-border shadow-sm font-bold text-sm focus:ring-1 focus:ring-primary/20" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                  />
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto shrink-0">
                  {/* Category Selector */}
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-12 w-48 rounded-xl border border-border shadow-sm bg-background font-bold text-xs hover:bg-muted/10 transition-colors">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="all" className="font-semibold text-xs">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name} className="font-semibold text-xs">
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Manage Categories Trigger */}
                  <Button 
                    variant="outline" 
                    onClick={() => setIsManageOpen(true)} 
                    className="h-12 w-12 rounded-xl border border-border bg-background shadow-sm hover:bg-muted/10 transition-colors p-0 active:scale-95 flex items-center justify-center shrink-0"
                    title="Manage Categories"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="shrink-0 w-full lg:w-auto">
                  <TabsList className="bg-background h-12 p-1 rounded-2xl border border-border shadow-sm w-full">
                    {TABS.map(tab => (
                      <TabsTrigger 
                        key={tab.id} 
                        value={tab.id} 
                        className="rounded-xl font-bold text-[11px] tracking-wide px-6 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md transition-all active:scale-97"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              {/* Assets Grid */}
              <div className="min-h-[400px]">
                {error && (
                  <Card className="border-destructive/20 bg-destructive/5 mb-8">
                    <CardContent className="p-6 flex items-center gap-3 text-destructive text-left">
                      <LayoutList className="h-5 w-5" />
                      <div className="space-y-1">
                        <p className="font-bold text-sm tracking-tight">Repository Sync Failure</p>
                        <p className="text-xs opacity-70 leading-relaxed">The system encountered an error while polling the media registry. This is usually due to a missing search index in Firestore.</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-square rounded-2xl" />
                    ))
                  ) : filteredAssets.length > 0 ? (
                    filteredAssets.map(asset => (
                      <MediaAssetCard key={asset.id} asset={asset} />
                    ))
                  ) : (
                    <div className="col-span-full py-32 text-center border border-border border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 opacity-30">
                      <Film className="h-16 w-16" />
                      <p className="font-semibold text-xs">No {activeTab} in this workspace</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Category Management Dialog */}
      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-background">
          <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                <Settings className="h-6 w-6" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-xl font-semibold tracking-tight">Manage Categories</DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                  Organize, add, and remove categories for this workspace.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-6 text-left">
            {/* Create Category Form */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Add Category</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Tutorials, Assets, Inbound"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold"
                  disabled={isSavingCategory}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                />
                <Button 
                  onClick={handleAddCategory} 
                  disabled={isSavingCategory || !newCategoryName.trim()} 
                  className="rounded-xl font-bold h-12 px-6 shadow-md"
                >
                  {isSavingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add
                </Button>
              </div>
            </div>

            {/* List Categories */}
            <div className="space-y-3">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Existing Categories</Label>
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {categories.map((cat) => {
                  const isCore = ['general', 'marketing', 'messaging'].includes(cat.name.toLowerCase());
                  return (
                    <div 
                      key={cat.id} 
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/30 transition-colors"
                    >
                      <span className="font-bold text-sm text-foreground">{cat.name}</span>
                      {isCore ? (
                        <span className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase bg-muted/40 px-2 py-1 rounded-md border border-border/30">
                          System Default
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg active:scale-95 flex items-center justify-center"
                          title={`Delete ${cat.name}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/30 border-t flex justify-end items-center">
            <Button 
              variant="outline" 
              onClick={() => setIsManageOpen(false)} 
              className="rounded-xl font-bold h-12 px-8"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainerFluid>
  );
}
