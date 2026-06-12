'use client';

import * as React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import QuestionEditor from './question-editor';
import BlockSettingsSidebar from './block-settings-sidebar';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import { useDebounce } from '@/hooks/use-debounce';
import { Undo, Redo, PlusCircle, Eye, ShieldCheck, CloudUpload, Check, FoldVertical, UnfoldVertical, Layout, Settings, LayoutDashboard, PanelRightClose, PanelRightOpen, X, Sparkles, Bold, Columns } from 'lucide-react';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { SurveyElement, SurveyQuestion, SurveyLayoutBlock } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { RainbowButton } from '@/components/ui/rainbow-button';
import Link from 'next/link';
import AddElementModal from './add-element-modal';
import { MarqueeSelect } from './MarqueeSelect';
import { BulkActionsBar } from './BulkActionsBar';
import SurveyForm from '../../../surveys/[slug]/components/survey-form';
import { Separator } from '@/components/ui/separator';
import AiChatEditor from './ai-chat-editor';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { autoSaveSurveyAction } from '@/lib/survey-actions';
import { AnimatePresence, motion } from 'framer-motion';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

function isLayoutBlock(element: SurveyElement): element is SurveyLayoutBlock {
    const layoutTypes = ['heading', 'description', 'divider', 'image', 'video', 'audio', 'document', 'embed', 'section'];
    return layoutTypes.includes(element.type);
}

export default function SurveyFormBuilder() {
    const { getValues, setValue, watch, formState: { isDirty }, control, reset } = useFormContext();
    const { toast } = useToast();
    const confirm = useConfirm();
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
    const [selectedBlockIds, setSelectedBlockIds] = React.useState<string[]>([]);
    const [lastSelectedId, setLastSelectedId] = React.useState<string | null>(null);
    const [isPreviewMode, setIsPreviewMode] = React.useState(false);
    const [isPropertiesBarVisible, setIsPropertiesBarVisible] = React.useState(true);
    const canvasRef = React.useRef<HTMLDivElement>(null);

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

    const toggleQuestionBolding = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const currentBold = watch('questionTitleBold') !== false;
        const newState = !currentBold;
        setValue('questionTitleBold', newState, { shouldDirty: true });
        toast({ 
            title: newState ? 'Titles set to Bold' : 'Titles set to Semibold',
            description: newState ? 'All question titles will appear bold.' : 'All question titles will appear less heavy.'
        });
    };

    const toggleColumns = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const current = watch('optionsColumns') || 1;
        const next = current >= 4 ? 1 : current + 1;
        setValue('optionsColumns', next, { shouldDirty: true });
        toast({ 
            title: `Options Layout: ${next} ${next > 1 ? 'Columns' : 'Column'}`,
            description: next > 1 ? `Questions with many options will now use a ${next}-column grid.` : 'All options will appear in a single list.'
        });
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
        if (newElement.id) {
            setSelectedBlockIds([newElement.id]);
            setLastSelectedId(newElement.id);
        }
    };

    const watchedForm = watch();
    const firestore = useFirestore();
    const { activeOrganization } = useWorkspace();

    // Logo resolution chain for Preview consistency
    const entityDocRef = React.useMemo(() => {
        if (!firestore || !watchedForm.entityId) return null;
        return doc(firestore, 'entities', watchedForm.entityId);
    }, [firestore, watchedForm.entityId]);
    const { data: entity } = useDoc<any>(entityDocRef);

    const displayLogoUrl = watchedForm.showBranding === false 
        ? 'none' 
        : (watchedForm.logoUrl || entity?.institutionData?.logoUrl || entity?.logoUrl || activeOrganization?.logoUrl || null);

    const debouncedForm = useDebounce(watchedForm, 30000);

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
    const activeSurveyIdRef = React.useRef<string>(surveyId);
    const [autosaveStatus, setAutosaveStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle');

    // Keep the ref in sync if the URL-based surveyId changes (e.g. after navigation)
    React.useEffect(() => { activeSurveyIdRef.current = surveyId; }, [surveyId]);

    const triggerSave = React.useCallback(async (data: any) => {
        if (!user || !isDirty) return;
        const currentString = JSON.stringify(data);
        if (currentString === lastSavedRef.current) return;

        const idToSave = activeSurveyIdRef.current;
        setAutosaveStatus('saving');
        try {
            const result = await autoSaveSurveyAction(idToSave, data, user.uid);
            if (result.success) {
                lastSavedRef.current = currentString;
                setAutosaveStatus('saved');
                if (idToSave === 'new-survey' && result.id) {
                    // Immediately lock the ref so subsequent saves target the new doc
                    activeSurveyIdRef.current = result.id;
                    router.replace(`/admin/surveys/${result.id}/edit`);
                }
                setTimeout(() => setAutosaveStatus('idle'), 3000);
            }
        } catch (error) {
            console.error("Autosave failed:", error);
            setAutosaveStatus('idle');
        }
    }, [user, isDirty, router]);

    const handleBulkAction = React.useCallback(async (action: string, value?: any) => {
        const currentElements: SurveyElement[] = getValues('elements') || [];
        const selectedIndices = selectedBlockIds
            .map(id => currentElements.findIndex(el => el.id === id))
            .filter(idx => idx !== -1)
            .sort((a, b) => a - b);

        if (selectedIndices.length === 0) return;

        let updatedElements = [...currentElements];

        switch (action) {
            case 'delete':
                if (await confirm({ title: 'Delete blocks?', description: `${selectedIndices.length} block(s) will be deleted.`, confirmText: 'Delete', variant: 'destructive' })) {
                    updatedElements = updatedElements.filter(el => !selectedBlockIds.includes(el.id));
                    setSelectedBlockIds([]);
                    setLastSelectedId(null);
                }
                break;

            case 'clone':
                const blocksToClone = selectedIndices.map(idx => ({
                    ...JSON.parse(JSON.stringify(updatedElements[idx])),
                    id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                }));
                const lastIdx = selectedIndices[selectedIndices.length - 1];
                updatedElements.splice(lastIdx + 1, 0, ...blocksToClone);
                setSelectedBlockIds(blocksToClone.map(b => b.id));
                break;

            case 'move-top':
                const topBlocks = selectedIndices.map(idx => updatedElements[idx]);
                const remainingTop = updatedElements.filter(el => !selectedBlockIds.includes(el.id));
                updatedElements = [...topBlocks, ...remainingTop];
                break;

            case 'move-bottom':
                const bottomBlocks = selectedIndices.map(idx => updatedElements[idx]);
                const remainingBottom = updatedElements.filter(el => !selectedBlockIds.includes(el.id));
                updatedElements = [...remainingBottom, ...bottomBlocks];
                break;

            case 'move-up':
                if (selectedIndices[0] > 0) {
                    selectedIndices.forEach(idx => {
                        [updatedElements[idx], updatedElements[idx - 1]] = [updatedElements[idx - 1], updatedElements[idx]];
                    });
                }
                break;

            case 'move-down':
                if (selectedIndices[selectedIndices.length - 1] < updatedElements.length - 1) {
                    [...selectedIndices].reverse().forEach(idx => {
                        [updatedElements[idx], updatedElements[idx + 1]] = [updatedElements[idx + 1], updatedElements[idx]];
                    });
                }
                break;

            case 'visibility':
                selectedIndices.forEach(idx => {
                    updatedElements[idx] = { ...updatedElements[idx], hidden: value };
                });
                break;

            case 'align':
                selectedIndices.forEach(idx => {
                    updatedElements[idx] = { 
                        ...updatedElements[idx], 
                        style: { ...(updatedElements[idx].style || {}), textAlign: value } 
                    };
                });
                break;

            case 'format':
                const tag = value;
                selectedIndices.forEach(idx => {
                    const el = updatedElements[idx];
                    const fieldsToFormat = ['title', 'description', 'text'];
                    const updatedEl = { ...el };
                    
                    fieldsToFormat.forEach(field => {
                        if ((updatedEl as any)[field]) {
                            (updatedEl as any)[field] = `<${tag}>${(updatedEl as any)[field]}</${tag}>`;
                        }
                    });
                    updatedElements[idx] = updatedEl;
                });
                break;
        }

        setValue('elements', updatedElements, { shouldDirty: true });
        toast({ 
            title: "Bulk Action Complete", 
            description: `Successfully applied ${action} to ${selectedIndices.length} blocks.` 
        });
    }, [getValues, setValue, selectedBlockIds, toast]);

    React.useEffect(() => { triggerSave(debouncedForm); }, [debouncedForm, triggerSave]);

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
            <div className="flex h-[calc(100vh-8rem)] gap-4 p-4 overflow-hidden bg-transparent">


                {/* 1. Middle Canvas - The Question Editor or Preview */}
                <div className="flex-1 relative overflow-hidden bg-transparent flex flex-col">
                    <div 
                        ref={canvasRef}
                        className="flex-1 overflow-y-auto no-scrollbar scroll-smooth"
                    >
                        <MarqueeSelect
                            containerRef={canvasRef}
                            itemSelector="[data-block-id]"
                            onSelectionChange={(ids, isAccumulating) => {
                                if (isAccumulating) {
                                    setSelectedBlockIds(prev => Array.from(new Set([...prev, ...ids])));
                                } else {
                                    setSelectedBlockIds(ids);
                                }
                                if (ids.length > 0) setLastSelectedId(ids[ids.length - 1]);
                            }}
                        >
                            <div className="max-w-3xl mx-auto space-y-16 p-2 md:p-6 lg:p-10 pb-96">
                            {isPreviewMode ? (
                                <div className="animate-in fade-in zoom-in duration-300">
                                    {/* Intro Disabled Banner — visual indicator that the toggle is working */}
                                    {!(watchedForm.showIntroAsPage ?? true) && (
                                        <div className="mb-6 flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 animate-in fade-in slide-in-from-top-4 duration-500">
                                            <div className="p-1.5 bg-amber-500/20 rounded-lg">
                                                <LayoutDashboard className="h-4 w-4 text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-amber-700 uppercase tracking-wider">Survey Intro Disabled</p>
                                                <p className="text-[9px] font-semibold text-amber-600/70">Intro content will appear inline above the first question page instead of as a dedicated page.</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-background rounded-2xl shadow-2xl p-8 sm:p-12 border border-border">
                                        <SurveyForm 
                                            survey={{
                                                ...watchedForm,
                                                id: surveyId,
                                                slug: watchedForm.slug || 'preview',
                                                elements: watchedForm.elements || [],
                                                status: watchedForm.status || 'draft'
                                            } as any} 
                                            onSubmitted={() => setIsPreviewMode(false)}
                                            isPreview
                                            resolvedLogoUrl={displayLogoUrl !== 'none' ? displayLogoUrl : undefined}
                                        />
                                    </div>
                                    <div className="mt-8 text-center">
                                        <Button variant="ghost" onClick={() => setIsPreviewMode(false)} className="font-bold text-muted-foreground uppercase tracking-widest text-xs">
                                            Return to Editor
                                        </Button>
                                    </div>
                                </div>
                            ) : fields.length > 0 ? (
                                <QuestionEditor 
                                    fields={fields} 
                                    remove={remove} 
                                    move={move} 
                                    swap={swap} 
                                    insert={insert}
                                    requestAddElement={requestAddElement}
                                    selectedBlockIds={selectedBlockIds}
                                    setSelectedBlockIds={setSelectedBlockIds}
                                    lastSelectedId={lastSelectedId}
                                    setLastSelectedId={setLastSelectedId}
                                    isAccordion={isAccordion}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-40 bg-card border-2 border-dashed border-border rounded-2xl shadow-sm space-y-8 text-center">
                                    <div className="h-24 w-24 rounded-full bg-primary/5 flex items-center justify-center">
                                        <PlusCircle className="h-12 w-12 text-primary/30" />
                                    </div>
                                    <div className="text-center space-y-3">
                                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Your survey is waiting...</h3>
                                        <p className="text-slate-500 font-medium max-w-xs mx-auto">Start building manually or let AI generate a structure for you.</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <RainbowButton asChild className="h-14 px-10 rounded-full font-black uppercase tracking-widest text-lg shadow-2xl transition-all active:scale-95 text-white gap-3">
                                            <Link href="/admin/surveys/new/ai">
                                                <Sparkles className="h-5 w-5" /> AI Architect
                                            </Link>
                                        </RainbowButton>
                                        <Button 
                                            onClick={() => requestAddElement(0)} 
                                            size="lg"
                                            className="rounded-full px-10 h-14 text-lg font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all"
                                        >
                                            Build from Scratch
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                        </MarqueeSelect>
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
                    
                {/* 2. Right Sidebar - Contextual Settings & Global Tools */}
                <div className={cn(
                    "shrink-0 border border-border bg-card rounded-2xl shadow-sm hidden xl:flex overflow-hidden transition-all duration-500 relative z-10 self-start max-h-full", 
                    isPreviewMode ? "opacity-0 translate-x-full pointer-events-none absolute right-0" : "",
                    isPropertiesBarVisible && !isPreviewMode ? "w-[340px] flex-col min-h-[500px] h-fit" : "w-16 flex-col h-fit"
                )}>
                    {/* Toolbar (Horizontal when open, Vertical when closed) */}
                    <div className={cn(
                        "p-2 border-border bg-muted/5 flex items-center shrink-0 transition-all duration-500",
                        isPropertiesBarVisible ? "border-b flex-row flex-nowrap gap-1 overflow-x-auto no-scrollbar" : "flex-col gap-4 border-r pb-6 w-16"
                    )}>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-lg h-8 w-8 hover:bg-muted/50 text-muted-foreground bg-background/50 backdrop-blur-sm border border-border/50 shrink-0" 
                            onClick={() => setIsPropertiesBarVisible(!isPropertiesBarVisible)}
                            title={isPropertiesBarVisible ? "Collapse Sidebar" : "Expand Settings"}
                        >
                            {isPropertiesBarVisible ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                        </Button>
                        <Separator orientation={isPropertiesBarVisible ? "vertical" : "horizontal"} className={cn(isPropertiesBarVisible ? "h-5 mx-0.5" : "w-8 my-1")} />
                        {!isPropertiesBarVisible && (
                            <>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="h-10 w-10 flex items-center justify-center mb-2">
                                                {autosaveStatus === 'saving' ? (
                                                    <CloudUpload className="h-5 w-5 animate-pulse text-primary" />
                                                ) : autosaveStatus === 'saved' ? (
                                                    <Check className="h-5 w-5 text-emerald-500" />
                                                ) : (
                                                    <ShieldCheck className="h-5 w-5 opacity-20" />
                                                )}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">Cloud Sync Status</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <Separator className="w-8" />
                            </>
                        )}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0" onClick={handleUndo} disabled={!canUndo}><Undo className="h-4 w-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent side={isPropertiesBarVisible ? "bottom" : "left"}>Undo</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0" onClick={handleRedo} disabled={!canRedo}><Redo className="h-4 w-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent side={isPropertiesBarVisible ? "bottom" : "left"}>Redo</TooltipContent>
                            </Tooltip>

                            <Separator orientation={isPropertiesBarVisible ? "vertical" : "horizontal"} className={cn(isPropertiesBarVisible ? "h-5 mx-0.5" : "w-8 my-1")} />

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className={cn("h-8 w-8 transition-all hover:bg-muted shrink-0", isAccordion ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")} onClick={toggleAccordion}>
                                        {isAccordion ? <FoldVertical className="h-4 w-4" /> : <UnfoldVertical className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side={isPropertiesBarVisible ? "bottom" : "left"}>Toggle Focus Mode</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className={cn("h-8 w-8 transition-all hover:bg-muted shrink-0", allPagesEnabled ? "bg-emerald-500/10 text-emerald-500" : "text-muted-foreground hover:text-foreground")} onClick={toggleAllPageBreaks}><Layout className="h-4 w-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent side={isPropertiesBarVisible ? "bottom" : "left"}>Toggle All Page Breaks</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className={cn("h-8 w-8 transition-all hover:bg-muted shrink-0", allValidationEnabled ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground hover:text-foreground")} onClick={toggleAllValidation}><ShieldCheck className="h-4 w-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent side={isPropertiesBarVisible ? "bottom" : "left"}>Strict Section Validation</TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className={cn("h-8 w-8 transition-all hover:bg-muted shrink-0", watch('questionTitleBold') !== false ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")} onClick={toggleQuestionBolding}><Bold className="h-4 w-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent side={isPropertiesBarVisible ? "bottom" : "left"}>Question Title Weight</TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className={cn("h-8 w-8 transition-all hover:bg-muted shrink-0", watch('optionsColumns') > 1 ? "bg-indigo-500/10 text-indigo-500" : "text-muted-foreground hover:text-foreground")} onClick={toggleColumns}><Columns className="h-4 w-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent side={isPropertiesBarVisible ? "bottom" : "left"}>Options Layout: {watch('optionsColumns') || 1} Col</TooltipContent>
                            </Tooltip>
                            <Separator orientation={isPropertiesBarVisible ? "vertical" : "horizontal"} className={cn(isPropertiesBarVisible ? "h-5 mx-0.5" : "w-8 my-1")} />
                            
                            <AiChatEditor variant="icon" />

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className={cn("h-8 w-8 transition-all hover:bg-muted shrink-0 ml-auto", isPreviewMode ? "bg-primary text-white" : "text-primary hover:bg-primary/10")} onClick={() => setIsPreviewMode(!isPreviewMode)}><Eye className="h-4 w-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent side={isPropertiesBarVisible ? "bottom" : "left"}>Preview Mode</TooltipContent>
                            </Tooltip>

                        </TooltipProvider>
                    </div>

                    {isPropertiesBarVisible && (
                        <div className="flex-1 overflow-y-auto w-full no-scrollbar pb-10">
                            <BlockSettingsSidebar selectedBlockIds={selectedBlockIds} />
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Block Settings Floating Action */}
            {!isPreviewMode && selectedBlockIds.length > 0 && (
                <div className="xl:hidden fixed bottom-6 right-6 z-50">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button size="icon" className="h-14 w-14 rounded-full shadow-2xl [&_svg]:size-6">
                                <Settings className="text-white" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[80vh] p-0 overflow-hidden sm:max-w-none w-full border-t-2 border-primary/20 rounded-t-3xl">
                            <BlockSettingsSidebar selectedBlockIds={selectedBlockIds} />
                        </SheetContent>
                    </Sheet>
                </div>
            )}

            <AddElementModal 
                open={isAddElementModalOpen}
                onOpenChange={setIsAddElementModalOpen}
                onSelect={handleElementSelect}
            />

            <BulkActionsBar 
                selectedIds={selectedBlockIds} 
                onClear={() => {
                    setSelectedBlockIds([]);
                    setLastSelectedId(null);
                }}
                onAction={handleBulkAction}
            />
        </div>
    );
}
