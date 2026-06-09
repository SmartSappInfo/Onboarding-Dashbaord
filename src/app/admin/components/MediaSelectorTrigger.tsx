'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Library, Pencil, X, ImageIcon } from 'lucide-react';
import MediaSelectorDialog from '../media/components/media-selector-dialog';
import MediaUploader from '../media/components/media-uploader';
import MediaLibraryBrowser from '../media/components/MediaLibraryBrowser';
import type { MediaAsset } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MediaSelectorTriggerProps {
    value?: string;
    onSelect: (url: string) => void;
    label?: string;
    description?: string;
    subLabel?: string;
    className?: string;
    previewClassName?: string;
    workspaceId?: string;
}

export default function MediaSelectorTrigger({
    value,
    onSelect,
    label = "Choose Image",
    description = "Upload a new file or select from your library",
    subLabel,
    className,
    previewClassName,
    workspaceId
}: MediaSelectorTriggerProps) {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = React.useState(false);
    
    const handleSelect = (asset: MediaAsset) => {
        onSelect(asset.url);
        setIsLibraryOpen(false);
        setIsMenuOpen(false);
    };

    const handleUploadSuccess = (asset?: MediaAsset) => {
        if (asset) {
            onSelect(asset.url);
            setIsMenuOpen(false);
        }
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Main Trigger UI */}
            <div className="flex items-center gap-4">
                <div className="relative group">
                    <div 
                        className={cn(
                            "h-24 w-24 rounded-2xl border-2 border-dashed border-muted-foreground/30 overflow-hidden bg-background flex items-center justify-center transition-all group-hover:border-primary/50 group-hover:bg-primary/5 cursor-pointer active:scale-95",
                            previewClassName
                        )}
                        onClick={() => setIsMenuOpen(true)}
                    >
                        {value ? (
                            <img src={value} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                        )}
                    </div>
                </div>

                <div className="flex flex-col text-left">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</span>
                    <div className="flex items-center gap-2">
                        <Button 
                            type="button"
                            variant="ghost" 
                            size="sm" 
                            className="h-8 rounded-xl font-bold text-[10px] px-3 bg-muted/50 hover:bg-primary hover:text-white transition-all"
                            onClick={() => setIsMenuOpen(true)}
                        >
                            <Pencil className="h-3 w-3 mr-2" />
                            Change
                        </Button>
                        {value && (
                            <Button 
                                type="button"
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 rounded-xl p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => onSelect('')}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                    {subLabel && <p className="text-[10px] font-medium text-muted-foreground mt-2 leading-relaxed max-w-[200px]">{subLabel}</p>}
                </div>
            </div>

            {/* Selection Dialog */}
            <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <DialogContent className="sm:max-w-4xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden h-[85vh] flex flex-col">
                    <DialogTitle className="sr-only">Select Image</DialogTitle>
                    <MediaLibraryBrowser 
                        onSelectAsset={(asset) => {
                            onSelect(asset.url);
                            setIsMenuOpen(false);
                        }}
                        filterType="image"
                        workspaceId={workspaceId}
                        isCompact={true}
                    />
                </DialogContent>
            </Dialog>

            {/* Nested Library Browser */}
            <MediaSelectorDialog 
                open={isLibraryOpen}
                onOpenChange={setIsLibraryOpen}
                onSelectAsset={handleSelect}
                filterType="image"
                workspaceId={workspaceId}
                title="Select Organization Logo"
            />
        </div>
    );
}
