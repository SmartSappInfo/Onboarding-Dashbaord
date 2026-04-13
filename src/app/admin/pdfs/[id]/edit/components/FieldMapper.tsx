'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
    Text, Signature, Calendar, ChevronDownSquare, Phone, Mail, Clock, Camera, 
    Undo, Redo, Sparkles, Loader2, ZoomIn, ZoomOut, Eye, Maximize2, Minimize2, XCircle, Tag,
    Plus, ChevronRight, Trash2, Database
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
} from "@/components/ui/alert-dialog";

import { 
    EditorProvider, 
    DocumentCanvas, 
    EditorSidebar, 
    useEditor, 
    LocalPDFFormField 
} from './Editor';
import type { PDFForm, PDFFormField, School } from '@/lib/types';

interface FieldMapperProps {
  pdf: PDFForm;
  fields: LocalPDFFormField[];
  setFields: React.Dispatch<React.SetStateAction<LocalPDFFormField[]>>;
  namingFieldId: string | null;
  setNamingFieldId: (id: string | null) => void;
  onSave: () => void;
  isSaving: boolean;
  onPreview: () => void;
  password?: string;
  setPassword: (val: string) => void;
  passwordProtected?: boolean;
  setPasswordProtected: (val: boolean) => void;
  isStatusChanging: boolean;
  onStatusChange: (status: PDFForm['status']) => void;
  onDetect: () => void;
  isDetecting: boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  school?: School;
}

function EditorLayout() {
    const { 
        zoom, setZoom, addField, undo, redo, canUndo, canRedo, 
        onDetect, isDetecting, onPreview, isFullScreen, setIsFullScreen,
        viewMode, setViewMode, isFieldDeleteConfirmOpen, setIsFieldDeleteConfirmOpen,
        selectedFieldIds, setFields, setSelectedFieldIds
    } = useEditor();

    const isPreviewing = viewMode === 'preview';

    return (
 <div className={cn(
            "flex h-full w-full overflow-hidden bg-muted/30 relative transition-all duration-300",
            isFullScreen && "fixed inset-0 z-[90] bg-background"
        )}>
 <div className="flex-1 relative min-w-0 flex flex-col overflow-hidden">
                <DocumentCanvas />

                {/* Vertical Toolbar - Unified Actions */}
                {!isPreviewing && (
 <div className="absolute left-6 top-1/2 -translate-y-1/2 z-[70] flex flex-col gap-4">
 <div className="flex flex-col items-center gap-2 rounded-2xl border border-primary/20 bg-background/95 backdrop-blur-md p-2 shadow-2xl">
                            <TooltipProvider>
                                {/* Add Field Gateway */}
                                <DropdownMenu>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    type="button"
 className="h-10 w-10 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all border border-primary/10"
                                                >
 <Plus className="h-5 w-5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">Add Field</TooltipContent>
                                    </Tooltip>
 <DropdownMenuContent side="right" align="start" className="w-56 rounded-xl border-none shadow-2xl p-2 ml-2">
 <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground opacity-60">Static Elements</div>
 <DropdownMenuItem onClick={() => addField('static-text')} className="rounded-lg gap-3 p-2.5">
 <Tag className="h-4 w-4 text-primary" />
 <span className="font-bold text-sm">Add Label</span>
                                        </DropdownMenuItem>
 <DropdownMenuItem onClick={() => addField('variable')} className="rounded-lg gap-3 p-2.5">
 <Database className="h-4 w-4 text-primary" />
 <span className="font-bold text-sm">Add Variable</span>
                                        </DropdownMenuItem>
                                        
 <DropdownMenuSeparator className="my-1" />
 <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground opacity-60">Input Fields</div>
                                        
 <DropdownMenuItem onClick={() => addField('text')} className="rounded-lg gap-3 p-2.5">
 <Text className="h-4 w-4 text-primary" />
 <span className="font-bold text-sm">Short Text</span>
                                        </DropdownMenuItem>
 <DropdownMenuItem onClick={() => addField('signature')} className="rounded-lg gap-3 p-2.5">
 <Signature className="h-4 w-4 text-primary" />
 <span className="font-bold text-sm">Signature</span>
                                        </DropdownMenuItem>
 <DropdownMenuItem onClick={() => addField('date')} className="rounded-lg gap-3 p-2.5">
 <Calendar className="h-4 w-4 text-primary" />
 <span className="font-bold text-sm">Date</span>
                                        </DropdownMenuItem>
 <DropdownMenuItem onClick={() => addField('dropdown')} className="rounded-lg gap-3 p-2.5">
 <ChevronDownSquare className="h-4 w-4 text-primary" />
 <span className="font-bold text-sm">Dropdown</span>
                                        </DropdownMenuItem>
 <DropdownMenuItem onClick={() => addField('phone')} className="rounded-lg gap-3 p-2.5">
 <Phone className="h-4 w-4 text-primary" />
 <span className="font-bold text-sm">Phone</span>
                                        </DropdownMenuItem>
 <DropdownMenuItem onClick={() => addField('email')} className="rounded-lg gap-3 p-2.5">
 <Mail className="h-4 w-4 text-primary" />
 <span className="font-bold text-sm">Email</span>
                                        </DropdownMenuItem>
 <DropdownMenuItem onClick={() => addField('time')} className="rounded-lg gap-3 p-2.5">
 <Clock className="h-4 w-4 text-primary" />
 <span className="font-bold text-sm">Time</span>
                                        </DropdownMenuItem>
 <DropdownMenuItem onClick={() => addField('photo')} className="rounded-lg gap-3 p-2.5">
 <Camera className="h-4 w-4 text-primary" />
 <span className="font-bold text-sm">Photo</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

 <Separator className="w-8 h-px bg-border/50 my-1" />

                                {/* History Controls */}
                                <ToolButton icon={Undo} label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
                                <ToolButton icon={Redo} label="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo} />

 <Separator className="w-8 h-px bg-border/50 my-1" />

                                {/* Intelligence Actions */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            type="button"
                                            onClick={onDetect} 
                                            disabled={isDetecting}
 className="h-10 w-10 rounded-xl text-primary hover:bg-primary/10 transition-all"
                                        >
 {isDetecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">AI Detect Fields</TooltipContent>
                                </Tooltip>

                                <ToolButton icon={Eye} label="Preview as User" onClick={() => setViewMode('preview')} />

 <Separator className="w-8 h-px bg-border/50 my-1" />

                                {/* View Controls */}
                                <ToolButton 
                                    icon={isFullScreen ? Minimize2 : Maximize2} 
                                    label={isFullScreen ? "Exit Zen Mode" : "Zen Mode"} 
                                    onClick={() => setIsFullScreen(!isFullScreen)} 
                                />
                            </TooltipProvider>
                        </div>
                    </div>
                )}

                {/* Zoom Controls Overlay */}
 <div className="absolute right-6 top-1/2 -translate-y-1/2 z-[60] flex flex-col items-center gap-3">
 <div className="flex flex-col items-center bg-background/95 backdrop-blur-sm rounded-full border p-2 shadow-2xl h-48">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        type="button"
 className="h-8 w-8 rounded-full mb-2 shrink-0" 
                                        onClick={() => setZoom(p => Math.min(p + 0.1, 3))}
                                    >
 <ZoomIn className="h-4 w-4 text-primary" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">Zoom In</TooltipContent>
                            </Tooltip>
                            
                            <Slider 
                                orientation="vertical" 
                                min={0.5} 
                                max={3} 
                                step={0.05} 
                                value={[zoom]} 
                                onValueChange={([v]) => setZoom(v)} 
 className="flex-grow py-2" 
                            />
                            
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        type="button"
 className="h-8 w-8 rounded-full mt-2 shrink-0" 
                                        onClick={() => setZoom(p => Math.max(p - 0.1, 0.5))}
                                    >
 <ZoomOut className="h-4 w-4 text-primary" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">Zoom Out</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
 <div className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-[10px] font-bold shadow-lg tabular-nums border border-primary/20">
                        {Math.round(zoom * 100)}%
                    </div>
                </div>

                {isPreviewing && (
 <div className="absolute top-6 right-6 z-[100] animate-in fade-in slide-in-from-top-4">
                        <Button 
                            type="button"
                            onClick={() => setViewMode('design')}
 className="rounded-full shadow-2xl gap-2 h-12 px-6 font-bold"
                        >
 <XCircle className="h-5 w-5" />
                            Exit Preview
                        </Button>
                    </div>
                )}
            </div>

            {!isPreviewing && <EditorSidebar />}

            <AlertDialog open={isFieldDeleteConfirmOpen} onOpenChange={setIsFieldDeleteConfirmOpen}>
 <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
 <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
 <Trash2 className="h-6 w-6 text-destructive" />
                        </div>
 <AlertDialogTitle className="text-center font-semibold tracking-tight">
                            Delete {selectedFieldIds.length === 1 ? 'Field' : 'Fields'}?
                        </AlertDialogTitle>
 <AlertDialogDescription className="text-center text-sm font-medium">
                            Are you sure you want to remove {selectedFieldIds.length === 1 ? 'this field' : `these ${selectedFieldIds.length} fields`} from the document architecture? This action can be undone using Ctrl+Z.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
 <AlertDialogFooter className="sm:justify-center gap-3 mt-4">
 <AlertDialogCancel className="rounded-xl font-bold px-8">Keep Fields</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={() => {
                                setFields(prev => prev.filter(f => !selectedFieldIds.includes(f.id)));
                                setSelectedFieldIds([]);
                                setIsFieldDeleteConfirmOpen(false);
                            }}
 className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-semibold px-10 shadow-xl"
                        >
                            Confirm Deletion
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function ToolButton({ icon: Icon, label, onClick, disabled }: { icon: any, label: string, onClick: () => void, disabled?: boolean }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    type="button"
                    disabled={disabled}
 className="h-10 w-10 rounded-xl border-none hover:bg-primary/10 transition-colors text-muted-foreground hover:text-primary" 
                    onClick={onClick}
                >
 <Icon className="h-5 w-5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
    );
}

export default function FieldMapper(props: FieldMapperProps) {
  return (
    <EditorProvider {...props}>
      <EditorLayout />
    </EditorProvider>
  );
}
