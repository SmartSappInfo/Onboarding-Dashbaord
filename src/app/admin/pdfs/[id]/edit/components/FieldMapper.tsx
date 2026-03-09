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
    Undo, Redo, Sparkles, Loader2, ZoomIn, ZoomOut, Eye, Maximize2, Minimize2, XCircle, Tag
} from 'lucide-react';

import { 
    EditorProvider, 
    DocumentCanvas, 
    EditorSidebar, 
    useEditor, 
    LocalPDFFormField 
} from './Editor';
import type { PDFForm, PDFFormField } from '@/lib/types';

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
}

function EditorLayout() {
    const { 
        zoom, setZoom, addField, undo, redo, canUndo, canRedo, 
        onDetect, isDetecting, onPreview, isFullScreen, setIsFullScreen,
        viewMode, setViewMode
    } = useEditor();

    const isPreviewing = viewMode === 'preview';

    return (
        <div className={cn(
            "flex h-full w-full overflow-hidden bg-muted/30 relative transition-all duration-300",
            isFullScreen && "fixed inset-0 z-[90] bg-background"
        )}>
            <div className="flex-1 relative min-w-0 flex flex-col overflow-hidden">
                <DocumentCanvas />

                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-[60] flex flex-col items-center gap-3">
                    <div className="flex flex-col items-center bg-background/95 backdrop-blur-sm rounded-full border p-2 shadow-2xl h-48">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        type="button"
                                        className="h-8 w-8 rounded-full mb-2" 
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
                                        className="h-8 w-8 rounded-full mt-2" 
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

                {!isPreviewing && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[70] w-fit">
                        <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-background/95 backdrop-blur-md p-2 shadow-2xl overflow-x-auto max-w-[90vw] no-scrollbar mx-auto">
                            <TooltipProvider>
                                <div className="flex items-center gap-1 px-2 shrink-0">
                                    <ToolButton icon={Tag} label="Add Label" onClick={() => addField('static-text')} />
                                    <ToolButton icon={Text} label="Add Input" onClick={() => addField('text')} />
                                    <ToolButton icon={Signature} label="Add Signature" onClick={() => addField('signature')} />
                                    <ToolButton icon={Calendar} label="Add Date" onClick={() => addField('date')} />
                                    <ToolButton icon={ChevronDownSquare} label="Add Dropdown" onClick={() => addField('dropdown')} />
                                    <ToolButton icon={Phone} label="Add Phone" onClick={() => addField('phone')} />
                                    <ToolButton icon={Mail} label="Add Email" onClick={() => addField('email')} />
                                    <ToolButton icon={Clock} label="Add Time" onClick={() => addField('time')} />
                                    <ToolButton icon={Camera} label="Add Photo" onClick={() => addField('photo')} />
                                </div>

                                <Separator orientation="vertical" className="h-8 mx-1 bg-border/50" />

                                <div className="flex items-center gap-1.5 px-2 shrink-0">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary transition-colors" onClick={undo} disabled={!canUndo}>
                                                <Undo className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Undo (Ctrl+Z)</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary transition-colors" onClick={redo} disabled={!canRedo}>
                                                <Redo className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Redo (Ctrl+Y)</TooltipContent>
                                    </Tooltip>
                                </div>

                                <Separator orientation="vertical" className="h-8 mx-1 bg-border/50" />

                                <div className="flex items-center gap-2 px-2 shrink-0">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                variant="outline"
                                                type="button"
                                                onClick={onDetect} 
                                                disabled={isDetecting} 
                                                className="h-9 px-4 rounded-xl font-bold border-primary/20 hover:bg-primary/5 transition-all text-primary"
                                            >
                                                {isDetecting ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Sparkles className="h-4 w-4 sm:mr-2" />}
                                                <span className="hidden sm:inline">{isDetecting ? 'Analyzing...' : 'AI Detect'}</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Auto-detect fields with AI</TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                variant="outline"
                                                type="button"
                                                onClick={() => setViewMode('preview')} 
                                                className="h-9 px-4 rounded-xl font-bold border-border/50 gap-2"
                                            >
                                                <Eye className="h-4 w-4" />
                                                <span className="hidden sm:inline">Preview</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Preview as user</TooltipContent>
                                    </Tooltip>

                                    <Separator orientation="vertical" className="h-8 mx-1 bg-border/50" />

                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                type="button"
                                                className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary transition-colors" 
                                                onClick={() => setIsFullScreen(!isFullScreen)}
                                            >
                                                {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">{isFullScreen ? 'Exit Full Screen' : 'Full Screen Mode'}</TooltipContent>
                                    </Tooltip>
                                </div>
                            </TooltipProvider>
                        </div>
                    </div>
                )}

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
        </div>
    );
}

function ToolButton({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    type="button"
                    className="h-9 w-9 rounded-xl border-none hover:bg-primary/10 transition-colors" 
                    onClick={onClick}
                >
                    <Icon className="h-4 w-4 text-primary" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
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
