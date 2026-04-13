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
import type { MediaAsset } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MediaSelectorTriggerProps {
    value?: string;
    onSelect: (url: string) => void;
    label?: string;
    description?: string;
    className?: string;
    workspaceId?: string;
}

export default function MediaSelectorTrigger({
    value,
    onSelect,
    label = "Choose Image",
    description = "Upload a new file or select from your library",
    className,
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
 <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-muted-foreground/30 overflow-hidden bg-muted/5 flex items-center justify-center transition-all group-hover:border-primary/50 group-hover:bg-primary/5">
                        {value ? (
 <img src={value} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
 <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                        )}
                        
                        {value && (
                            <button 
                                onClick={(e) => { e.preventDefault(); onSelect(''); }}
 className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
 <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>

 <div className="flex flex-col gap-2">
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsMenuOpen(true)}
 className="rounded-xl font-bold h-10 px-4 gap-2 border-2 hover:bg-primary/5 hover:border-primary/30 transition-all text-[10px] "
                    >
 <Pencil className="h-3.5 w-3.5" />
                        {value ? 'Change Image' : label}
                    </Button>
 <p className="text-[10px] font-bold text-muted-foreground tracking-tight ml-1">
                        SVG, PNG, JPG or WebP
                    </p>
                </div>
            </div>

            {/* Selection Dialog */}
            <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
 <DialogContent className="sm:max-w-3xl rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
 <Tabs defaultValue="upload" className="w-full">
 <DialogHeader className="p-8 border-b bg-muted/30">
 <div className="flex items-center justify-between gap-4">
                                <div>
 <DialogTitle className="text-2xl font-semibold tracking-tight">{label}</DialogTitle>
 <DialogDescription className="text-xs font-bold text-muted-foreground mt-1">
                                        {description}
                                    </DialogDescription>
                                </div>
 <TabsList className="bg-background border shadow-sm h-11 p-1 rounded-xl">
 <TabsTrigger value="upload" className="rounded-lg font-semibold text-[10px] px-4 gap-2">
 <Upload className="h-3.5 w-3.5" /> Upload
                                    </TabsTrigger>
 <TabsTrigger value="library" className="rounded-lg font-semibold text-[10px] px-4 gap-2">
 <Library className="h-3.5 w-3.5" /> Library
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                        </DialogHeader>

 <div className="p-8">
 <TabsContent value="upload" className="mt-0">
                                <MediaUploader 
                                    onUploadSuccess={() => {}} 
                                    onUploadComplete={handleUploadSuccess}
                                    acceptedFileTypes={['image']}
                                    defaultWorkspaceId={workspaceId}
                                />
                            </TabsContent>
                            
 <TabsContent value="library" className="mt-0">
 <div className="py-12 text-center flex flex-col items-center gap-4">
 <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
 <Library className="h-8 w-8 text-primary" />
                                    </div>
 <div className="space-y-1">
 <h3 className="text-lg font-semibold tracking-tight">Institutional Library</h3>
 <p className="text-sm text-muted-foreground font-medium max-w-sm mx-auto">
                                            Select an image that has already been uploaded to your platform assets.
                                        </p>
                                    </div>
                                    <Button 
                                        onClick={() => setIsLibraryOpen(true)}
 className="mt-4 rounded-xl font-semibold px-8 h-12 gap-2 shadow-xl"
                                    >
                                        Open Full Browser
                                    </Button>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
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
