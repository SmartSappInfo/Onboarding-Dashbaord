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
    Undo, Redo, Sparkles, Loader2, ZoomIn, ZoomOut, Eye, Save 
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

/**
 * Inner component that uses the EditorContext
 */
function EditorLayout() {
    const { 
        zoom, setZoom, addField, undo, redo, canUndo, canRedo, 
        onDetect, isDetecting, onPreview, onSave, isSaving 
    } = useEditor();

    return (
        <div className="flex h-screen w-full overflow-hidden bg-muted/30">
            {/* Main Canvas Area */}
            <div className="flex-1 relative min-w-0 flex flex-col overflow-hidden">
                <DocumentCanvas />

                {/* Vertical Zoom Controls - Center Right */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3">
                    <div className="flex flex-col items-center bg-background/95 backdrop-blur-sm rounded-full border p-2 shadow-2xl h-48">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-full mb-2" 
                            onClick={() => setZoom(p => Math.min(p + 0.1, 3))}
                        >
                            <ZoomIn className="h-4 w-4 text-primary" />
                        </Button>
                        <Slider 
                            orientation="vertical" 
                            min={0.5} 
                            max={3} 
                            step={0.05} 
                            value={[zoom]} 
                            onValueChange={([v]) => setZoom(v)} 
                            className="flex-grow py-2" 
                        />
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-full mt-2" 
                            onClick={() => setZoom(p => Math.max(p - 0.1, 0.5))}
                        >
                            <ZoomOut className="h-4 w-4 text-primary" />
                        </Button>
                    </div>
                    <div className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-[10px] font-bold shadow-lg tabular-nums border border-primary/20">
                        {Math.round(zoom * 100)}%
                    </div>
                </div>

                {/* Floating Tool Docker - Bottom Center */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
                    <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-background/95 backdrop-blur-md p-2 shadow-2xl overflow-x-auto max-w-[95vw] no-scrollbar">
                        <TooltipProvider>
                            {/* Field Creation Group */}
                            <div className="flex items-center gap-1 px-2 shrink-0">
                                <ToolButton icon={Text} label="Add Text" onClick={() => addField('text')} />
                                <ToolButton icon={Signature} label="Add Signature" onClick={() => addField('signature')} />
                                <ToolButton icon={Calendar} label="Add Date" onClick={() => addField('date')} />
                                <ToolButton icon={ChevronDownSquare} label="Add Dropdown" onClick={() => addField('dropdown')} />
                                <ToolButton icon={Phone} label="Add Phone" onClick={() => addField('phone')} />
                                <ToolButton icon={Mail} label="Add Email" onClick={() => addField('email')} />
                                <ToolButton icon={Clock} label="Add Time" onClick={() => addField('time')} />
                                <ToolButton icon={Camera} label="Add Photo" onClick={() => addField('photo')} />
                            </div>

                            <Separator orientation="vertical" className="h-8 mx-1 bg-border/50" />

                            {/* History Group */}
                            <div className="flex items-center gap-1.5 px-2 shrink-0">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={undo} disabled={!canUndo}>
                                            <Undo className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Undo (Ctrl+Z)</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={redo} disabled={!canRedo}>
                                            <Redo className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Redo (Ctrl+Y)</TooltipContent>
                                </Tooltip>
                            </div>

                            <Separator orientation="vertical" className="h-8 mx-1 bg-border/50" />

                            {/* AI Action Group */}
                            <div className="px-2 shrink-0">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            onClick={onDetect} 
                                            disabled={isDetecting} 
                                            className="h-9 px-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                                        >
                                            {isDetecting ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Sparkles className="h-4 w-4 sm:mr-2" />}
                                            <span className="hidden sm:inline">{isDetecting ? 'Analyzing...' : 'AI Detect'}</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Auto-detect fields with AI</TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </div>
                </div>
            </div>

            {/* Properties Sidebar */}
            <EditorSidebar />
        </div>
    );
}

function ToolButton({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button 
                    variant="outline" 
                    size="icon" 
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

/**
 * Root FieldMapper component wrapping everything in the Provider
 */
export default function FieldMapper(props: FieldMapperProps) {
  return (
    <EditorProvider {...props}>
      <EditorLayout />
    </EditorProvider>
  );
}