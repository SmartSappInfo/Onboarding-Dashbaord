'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * 
 * 1. Purpose:
 *    Allows workspace administrators to update the `category` tag on any MediaAsset.
 * 2. Interaction Model:
 *    Provides quick preset category chips (`general`, `admissions`, `fees & payments`, `marketing`, `campaigns`, `internal`, `testimonials`, `events`)
 *    alongside a custom text input field for arbitrary category assignments.
 * 3. Mobile & Accessibility Optimizations:
 *    - Touch-friendly `min-h-[44px]` touch targets for chips and action buttons.
 *    - Accessible dialog title, description, and ARIA icons.
 * 4. Related Surfaces:
 *    - `media-asset-card.tsx` (Context Menu action trigger)
 *    - `MediaLibraryBrowser.tsx` (Category Switcher filter toolbar)
 */

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Tag, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { MediaAsset } from '@/lib/types';

export const PRESET_CATEGORIES = [
    { label: 'General', value: 'general' },
    { label: 'Admissions', value: 'admissions' },
    { label: 'Fees & Payments', value: 'fees & payments' },
    { label: 'Marketing', value: 'marketing' },
    { label: 'Campaigns', value: 'campaigns' },
    { label: 'Internal', value: 'internal' },
    { label: 'Testimonials', value: 'testimonials' },
    { label: 'Events', value: 'events' },
] as const;

interface ChangeCategoryDialogProps {
    asset: MediaAsset;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function ChangeCategoryDialog({ asset, open, onOpenChange }: ChangeCategoryDialogProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [category, setCategory] = React.useState(asset.category || 'general');
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setCategory(asset.category || 'general');
        }
    }, [open, asset.category]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) return;

        const sanitizedCategory = category.trim().toLowerCase();
        if (sanitizedCategory === (asset.category || '').toLowerCase()) {
            onOpenChange(false);
            return;
        }

        setIsSaving(true);
        try {
            await updateDoc(doc(firestore, 'media', asset.id), {
                category: sanitizedCategory,
                updatedAt: new Date().toISOString(),
            });

            toast({
                title: 'Category Updated',
                description: `Asset assigned to "${sanitizedCategory.toUpperCase()}".`,
            });
            onOpenChange(false);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to update category.';
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: msg,
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                <form onSubmit={handleSave}>
                    <DialogHeader className="p-8 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-100 dark:border-purple-900/50 shrink-0 text-left">
                        <div className="flex flex-col items-start gap-2">
                            <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-lg shadow-purple-200 dark:shadow-none mb-1">
                                <Tag className="h-6 w-6" aria-hidden="true" />
                            </div>
                            <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                                Asset Category
                            </DialogTitle>
                            <DialogDescription className="text-xs font-bold text-purple-700 dark:text-purple-300 opacity-90">
                                Organize & categorize your media resource for easy filtering across hubs.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="p-8 space-y-6 bg-background">
                        {/* Preset Category Chips */}
                        <div className="space-y-2.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-purple-500" /> Preset Categories
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_CATEGORIES.map((preset) => {
                                    const isSelected = category.toLowerCase() === preset.value;
                                    return (
                                        <button
                                            key={preset.value}
                                            type="button"
                                            aria-pressed={isSelected}
                                            onClick={() => setCategory(preset.value)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 min-h-[44px] cursor-pointer touch-manipulation flex items-center gap-1.5 border ${
                                                isSelected
                                                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200 dark:shadow-none scale-[1.02]'
                                                    : 'bg-muted/40 hover:bg-muted text-foreground border-transparent hover:border-border'
                                            }`}
                                        >
                                            {preset.label}
                                            {isSelected && <Badge variant="outline" className="border-white/30 text-white text-[9px] px-1 py-0 h-4">Active</Badge>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Custom Category Input */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                Or Enter Custom Category
                            </Label>
                            <Input
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="e.g. admissions, fees, webinars..."
                                className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-purple-500/30 font-bold text-sm px-4"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between items-center sm:justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving}
                            className="rounded-xl font-bold h-12 min-h-[44px] px-6 cursor-pointer hover:bg-muted/50 transition-colors duration-200"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving || !category.trim()}
                            className="rounded-xl font-bold h-12 min-h-[44px] px-8 bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200 dark:shadow-none cursor-pointer transition-all duration-200 active:scale-95 gap-2"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                            Save Category
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
