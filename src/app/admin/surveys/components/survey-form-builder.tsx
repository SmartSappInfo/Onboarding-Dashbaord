'use client';

import * as React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import QuestionEditor from './question-editor';
import BlockSettingsSidebar from './block-settings-sidebar';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import { useDebounce } from '@/hooks/use-debounce';
import { Undo, Redo, PlusCircle, Eye, ShieldCheck, CloudUpload, Check, FoldVertical, UnfoldVertical, Layout } from 'lucide-react';
import type { SurveyElement, SurveyQuestion, SurveyLayoutBlock } from '@/lib/types';
import AddElementModal from './add-element-modal';
import SurveyPreviewButton from './survey-preview-button';
import { Separator } from '@/components/ui/separator';
import AiChatEditor from './ai-chat-editor';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { autoSaveSurveyAction } from '@/lib/survey-actions';
import { AnimatePresence, motion } from 'framer-motion';

function isLayoutBlock(element: SurveyElement): element is SurveyLayoutBlock {
    const layoutTypes = ['heading', 'description', 'divider', 'image', 'video', 'audio', 'document', 'embed', 'section'];
    return layoutTypes.includes(element.type);
}

export default function SurveyFormBuilder() {
    const { getValues, setValue, watch, formState: { isDirty }, control, reset } = useFormContext();
    const { toast } = useToast();
    const params = useParams();
    const router = useRouter();
    const { user } = useUser();
    
    const surveyId = (params?.id as string) || 'new-survey';
    const storageKey = `survey-autosave-${surveyId}`;
    
    const { fields, append, remove, move, swap, insert } = useFieldArray({
      control,
      name: 'elements',
    });
    
    const [isAddElementModalOpen, setIsAddElementModalOpen] = React.useState(false);
    const [insertionIndex, setInsertionIndex] = React.useState<number>(0);
    const [isAccordion, setIsAccordion] = React.useState(true);
    const [activeBlockId, setActiveBlockId] = React.useState<string | null>(null);

    const elements = watch('elements') || [];
    const sections = elements.filter((el: any) => el.type === 'section');
    
    const allPagesEnabled = sections.length > 0 && sections.every((s: any) => s.renderAsPage);
    const allValidationEnabled = sections.length > 0 && sections.every((s: any) => s.validateBeforeNext);

    const toggleAccordion = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsAccordion(!isAccordion);
        toast({
            title: isAccordion ? "Standard View" : "Accordion Mode",
            description: isAccordion ? "All blocks are now fully expanded." : "Only the active block will be expanded."
        });
    };

    const toggleAllPageBreaks = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const newState = !allPagesEnabled;
        const updatedElements = getValues('elements').map((el: any) => 
            el.type === 'section' ? { ...el, renderAsPage: newState } : el
        );
        setValue('elements', updatedElements, { shouldDirty: true });
        toast({ title: newState ? 'All sections updated' : 'Page breaks removed' });
    };

    const toggleAllValidation = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const newState = !allValidationEnabled;
        const updatedElements = getValues('elements').map((el: any) => 
            el.type === 'section' ? { ...el, validateBeforeNext: newState } : el
        );
        setValue('elements', updatedElements, { shouldDirty: true });
        toast({ title: newState ? 'Strict validation enabled' : 'Validation disabled' });
    };

    const requestAddElement = (index: number) => {
        setInsertionIndex(index + 1);
        setIsAddElementModalOpen(true);
    };

    const handleElementSelect = (type: SurveyElement['type']) => {
        const newElement: Partial<SurveyElement> = {
          id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          type,
          hidden: false,
        };
    
        const questionTypes: SurveyQuestion['type'][] = ['text', 'long-text', 'yes-no', 'multiple-choice', 'checkboxes', 'dropdown', 'rating', 'date', 'time', 'file-upload', 'email', 'phone', 'number', 'link'];
    
        if (questionTypes.includes(type as SurveyQuestion['type'])) {
            (newElement as SurveyQuestion).title = '';
            (newElement as SurveyQuestion).isRequired = false;
            if (type === 'multiple-choice' || type === 'checkboxes' || type === 'dropdown') {
                (newElement as SurveyQuestion).options = ['Option 1', 'Option 2'];
            }
        } else if (type === 'section') {
            const sectionsCount = getValues('elements').filter((el: SurveyElement) => el.type === 'section').length;
            (newElement as SurveyLayoutBlock).title = `Section ${sectionsCount + 1}`;
            (newElement as SurveyLayoutBlock).stepperTitle = `Step ${sectionsCount + 1}`;
            (newElement as SurveyLayoutBlock).renderAsPage = false;
        } else if (isLayoutBlock(newElement as SurveyElement)) {
            if(type === 'heading') (newElement as SurveyLayoutBlock).title = 'New Heading';
            if(type === 'description') (newElement as SurveyLayoutBlock).text = 'Descriptive text goes here.';
        }
        
        insert(insertionIndex, newElement);
        setActiveBlockId(newElement.id || null);
    };

    const watchedForm = watch();
    const debouncedForm = useDebounce(watchedForm, 1000);

    const {
        state: historyState,
        set: setHistory,
        undo: undoHistory,
        redo: redoHistory,
        canUndo,
        canRedo,
        reset: resetHistory
    } = useUndoRedo<any>(getValues());

    const isProgrammaticChange = React.useRef(false);
    const lastSavedRef = React.useRef<string>(JSON.stringify(getValues()));
    const [autosaveStatus, setAutosaveStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle');

    const triggerSave = React.useCallback(async (data: any) => {
        if (!user || !isDirty) return;
        const currentString = JSON.stringify(data);
        if (currentString === lastSavedRef.current) return;

        setAutosaveStatus('saving');
        try {
            const result = await autoSaveSurveyAction(surveyId, data, user.uid);
            if (result.success) {
                lastSavedRef.current = currentString;
                setAutosaveStatus('saved');
                if (surveyId === 'new-survey' && result.id) {
                    router.replace(`/admin/surveys/${result.id}/edit`);
                }
                setTimeout(() => setAutosaveStatus('idle'), 3000);
            }
        } catch (error) {
            console.error("Autosave failed:", error);
            setAutosaveStatus('idle');
        }
    }, [user, isDirty, surveyId, router]);

    React.useEffect(() => { triggerSave(debouncedForm); }, [debouncedForm, triggerSave]);
    React.useEffect(() => { if (activeBlockId) triggerSave(getValues()); }, [activeBlockId, triggerSave, getValues]);

    React.useEffect(() => {
        if (isProgrammaticChange.current) {
            reset(historyState, { keepDirty: true });
            isProgrammaticChange.current = false;
        } else {
            setHistory(watchedForm);
        }
    }, [watchedForm, historyState, reset, setHistory]);

    const handleUndo = () => { if (canUndo) { isProgrammaticChange.current = true; undoHistory(); } };
    const handleRedo = () => { if (canRedo) { isProgrammaticChange.current = true; redoHistory(); } };

    return (
        <div className="relative h-full">
            <div className="flex h-[calc(100vh-10rem)] gap-0 overflow-hidden bg-background">
                {/* 1. Left Toolbar - Minimized & Dark/Premium */}
                <div className="w-16 flex flex-col items-center py-6 border-r border-border/50 bg-slate-950 text-slate-400 shrink-0 select-none">
                    <TooltipProvider>
                        <div className="flex flex-col gap-6 items-center">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="h-10 w-10 flex items-center justify-center">
                                        {autosaveStatus === 'saving' ? (
                                            <CloudUpload className="h-5 w-5 animate-pulse text-primary" />
                                        ) : autosaveStatus === 'saved' ? (
                                            <Check className="h-5 w-5 text-emerald-500" />
                                        ) : (
                                            <ShieldCheck className="h-5 w-5 opacity-20" />
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right">Cloud Sync Status</TooltipContent>
                            </Tooltip>

                            <Separator className="w-8 bg-slate-800" />

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className={cn("h-10 w-10 rounded-xl transition-all", isAccordion ? "bg-primary/20 text-primary" : "hover:text-white")}
                                        onClick={toggleAccordion}
                                    >
                                        {isAccordion ? <FoldVertical className="h-5 w-5" /> : <UnfoldVertical className="h-5 w-5" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">Toggle Focus Mode</TooltipContent>
                            </Tooltip>

                            <AiChatEditor variant="icon" />

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className={cn("h-10 w-10 rounded-xl transition-all", allPagesEnabled ? "bg-emerald-500/20 text-emerald-500" : "hover:text-white")}
                                        onClick={toggleAllPageBreaks}
                                    >
                                        <Layout className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">Toggle All Page Breaks</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className={cn("h-10 w-10 rounded-xl transition-all", allValidationEnabled ? "bg-amber-500/20 text-amber-500" : "hover:text-white")}
                                        onClick={toggleAllValidation}
                                    >
                                        <ShieldCheck className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">Strict Section Validation</TooltipContent>
                            </Tooltip>

                            <Separator className="w-8 bg-slate-800/50" />

                            <div className="flex flex-col gap-3">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all disabled:opacity-20" 
                                            onClick={handleUndo} 
                                            disabled={!canUndo}
                                        >
                                            <Undo className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">Undo (⌘Z)</TooltipContent>
                                </Tooltip>
                                
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all disabled:opacity-20" 
                                            onClick={handleRedo} 
                                            disabled={!canRedo}
                                        >
                                            <Redo className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">Redo (⌘⇧Z)</TooltipContent>
                                </Tooltip>
                            </div>

                            <Separator className="w-8 bg-slate-800/50" />

                            <SurveyPreviewButton variant="ghost" size="icon" className="h-10 w-10 text-primary hover:bg-primary/20 hover:text-primary rounded-xl">
                                <Eye className="h-5 w-5" />
                            </SurveyPreviewButton>
                        </div>
                    </TooltipProvider>
                </div>

                {/* 2. Middle Canvas - The Question Editor */}
                <div className="flex-1 relative overflow-hidden bg-slate-50/50 flex flex-col">
                    <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth p-6 md:p-12 lg:p-20">
                        <div className="max-w-3xl mx-auto space-y-16 pb-96">
                            {fields.length > 0 ? (
                                <QuestionEditor 
                                    fields={fields} 
                                    remove={remove} 
                                    move={move} 
                                    swap={swap} 
                                    insert={insert}
                                    requestAddElement={requestAddElement}
                                    activeBlockId={activeBlockId}
                                    setActiveBlockId={setActiveBlockId}
                                    isAccordion={isAccordion}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-40 bg-white border-2 border-dashed border-slate-200 rounded-[3rem] shadow-sm space-y-8">
                                    <div className="h-24 w-24 rounded-full bg-primary/5 flex items-center justify-center">
                                        <PlusCircle className="h-12 w-12 text-primary/30" />
                                    </div>
                                    <div className="text-center space-y-3">
                                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Your survey is waiting...</h3>
                                        <p className="text-slate-500 font-medium max-w-xs mx-auto">Start building manually or let AI generate a structure for you.</p>
                                    </div>
                                    <Button 
                                        onClick={() => requestAddElement(0)} 
                                        size="lg"
                                        className="rounded-full px-10 h-14 text-lg font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all"
                                    >
                                        Build from Scratch
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Premium Autosave Status Pill */}
                    <AnimatePresence>
                        {autosaveStatus !== 'idle' && (
                            <motion.div 
                                initial={{ y: 50, opacity: 0, x: '-50%' }}
                                animate={{ y: 0, opacity: 1, x: '-50%' }}
                                exit={{ y: 50, opacity: 0, x: '-50%' }}
                                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50"
                            >
                                <div className={cn(
                                    "flex items-center gap-3 px-5 py-2.5 rounded-full border shadow-2xl backdrop-blur-xl transition-all duration-500",
                                    autosaveStatus === 'saving' 
                                        ? "bg-primary/10 border-primary/20 text-primary" 
                                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                                )}>
                                    {autosaveStatus === 'saving' ? (
                                        <>
                                            <CloudUpload className="h-4 w-4 animate-bounce" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Syncing to Cloud...</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="h-4 w-4 flex items-center justify-center">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">All Changes Saved</span>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 3. Right Sidebar - Contextual Settings */}
                <div className="w-80 shrink-0 border-l border-border/50 bg-white hidden xl:block overflow-hidden">
                    <BlockSettingsSidebar activeBlockId={activeBlockId} />
                </div>
            </div>

            <AddElementModal 
                open={isAddElementModalOpen}
                onOpenChange={setIsAddElementModalOpen}
                onSelect={handleElementSelect}
            />
        </div>
    );
}
