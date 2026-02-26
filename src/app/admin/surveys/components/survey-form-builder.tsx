'use client';

import * as React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import QuestionEditor from './question-editor';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import { useDebounce } from '@/hooks/use-debounce';
import { Undo, Redo, PlusCircle, Eye, Loader2, Check, Layout, ShieldCheck, Zap } from 'lucide-react';
import type { SurveyElement, SurveyQuestion, SurveyLayoutBlock } from '@/lib/types';
import AddElementModal from './add-element-modal';
import SurveyPreviewButton from './survey-preview-button';
import { Separator } from '@/components/ui/separator';
import AiChatEditor from './ai-chat-editor';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function isLayoutBlock(element: SurveyElement): element is SurveyLayoutBlock {
    const layoutTypes = ['heading', 'description', 'divider', 'image', 'video', 'audio', 'document', 'embed', 'section'];
    return layoutTypes.includes(element.type);
}

export default function SurveyFormBuilder() {
    const { getValues, setValue, watch, formState: { isDirty }, control, reset } = useFormContext();
    const { toast } = useToast();
    const params = useParams();
    const surveyId = (params?.id as string) || 'new-survey';
    const storageKey = `survey-autosave-${surveyId}`;
    
    const { fields, append, remove, move, swap, insert } = useFieldArray({
      control,
      name: 'elements',
    });
    
    const [isAddElementModalOpen, setIsAddElementModalOpen] = React.useState(false);
    const [insertionIndex, setInsertionIndex] = React.useState<number>(0);

    const elements = watch('elements') || [];
    const sections = elements.filter((el: any) => el.type === 'section');
    
    const allPagesEnabled = sections.length > 0 && sections.every((s: any) => s.renderAsPage);
    const allValidationEnabled = sections.length > 0 && sections.every((s: any) => s.validateBeforeNext);

    const toggleAllPageBreaks = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const newState = !allPagesEnabled;
        const currentElements = getValues('elements');
        const updatedElements = currentElements.map((el: any) => 
            el.type === 'section' ? { ...el, renderAsPage: newState } : el
        );
        setValue('elements', updatedElements, { shouldDirty: true });
        toast({ 
            title: newState ? 'All sections updated' : 'Page breaks removed',
            description: newState ? 'Every section is now a separate page.' : 'Sections will now scroll continuously.'
        });
    };

    const toggleAllValidation = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const newState = !allValidationEnabled;
        const currentElements = getValues('elements');
        const updatedElements = currentElements.map((el: any) => 
            el.type === 'section' ? { ...el, validateBeforeNext: newState } : el
        );
        setValue('elements', updatedElements, { shouldDirty: true });
        toast({ 
            title: newState ? 'All sections updated' : 'Validation disabled',
            description: newState ? 'Strict validation enabled for all sections.' : 'Users can now skip between sections.'
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
    
        const questionTypes: SurveyQuestion['type'][] = ['text', 'long-text', 'yes-no', 'multiple-choice', 'checkboxes', 'dropdown', 'rating', 'date', 'time', 'file-upload'];
    
        if (questionTypes.includes(type as SurveyQuestion['type'])) {
            (newElement as SurveyQuestion).title = '';
            (newElement as SurveyQuestion).isRequired = false;
            if (type === 'multiple-choice' || type === 'checkboxes' || type === 'dropdown') {
                (newElement as SurveyQuestion).options = ['Option 1', 'Option 2'];
            }
            if (type === 'checkboxes') {
                (newElement as SurveyQuestion).allowOther = false;
            }
            if (type === 'date') {
                (newElement as SurveyQuestion).defaultValue = new Date();
            }
            if (type === 'time') {
                const now = new Date();
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                (newElement as SurveyQuestion).defaultValue = `${hours}:${minutes}:${seconds}`;
            }
        } else if (type === 'logic') {
            (newElement as any).rules = [{
                sourceQuestionId: '',
                operator: 'isEqualTo',
                action: { type: 'jump' },
            }];
        } else if (type === 'section') {
            const sectionsCount = getValues('elements').filter((el: SurveyElement) => el.type === 'section').length;
            (newElement as SurveyLayoutBlock).title = `Section ${sectionsCount + 1}`;
            (newElement as SurveyLayoutBlock).stepperTitle = `Step ${sectionsCount + 1}`;
            (newElement as SurveyLayoutBlock).description = '';
            (newElement as SurveyLayoutBlock).renderAsPage = false;
        } else if (isLayoutBlock(newElement as SurveyElement)) {
            if(type === 'heading') {
                (newElement as SurveyLayoutBlock).title = 'New Heading';
                (newElement as SurveyLayoutBlock).variant = 'h2';
            }
            if(type === 'description') (newElement as SurveyLayoutBlock).text = 'Descriptive text goes here.';
            if(type === 'embed') (newElement as SurveyLayoutBlock).html = '<!-- Paste your HTML code here -->';
            if(['image', 'video', 'audio', 'document'].includes(type)) (newElement as SurveyLayoutBlock).url = '';
        }
        
        insert(insertionIndex, newElement);
    };

    const watchedForm = watch();
    const debouncedForm = useDebounce(watchedForm, 5000);

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

    React.useEffect(() => {
        resetHistory(getValues());

        const savedData = localStorage.getItem(storageKey);
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                if (parsedData.elements) {
                    parsedData.elements.forEach((el: any) => {
                        if (el.type === 'date' && el.defaultValue && typeof el.defaultValue === 'string') {
                            el.defaultValue = new Date(el.defaultValue);
                        }
                    });
                }

                const currentData = getValues();
                if (JSON.stringify(parsedData.elements) !== JSON.stringify(currentData.elements)) {
                    toast({
                        title: "Unsaved Changes Found",
                        description: "We found a newer version of this survey in your local cache. Would you like to restore it?",
                        action: (
                            <Button variant="default" size="sm" onClick={() => {
                                reset(parsedData);
                                resetHistory(parsedData);
                                lastSavedRef.current = JSON.stringify(parsedData);
                                toast({ title: 'Restored', description: 'Your unsaved changes have been applied.' });
                                localStorage.removeItem(storageKey);
                            }}>
                                Restore Changes
                            </Button>
                        ),
                        duration: 10000,
                    });
                }
            } catch (e) {
                console.error("Failed to parse autosaved data", e);
                localStorage.removeItem(storageKey);
            }
        }
    }, [reset, getValues, resetHistory, storageKey, toast]);

    React.useEffect(() => {
        if (isProgrammaticChange.current) return;
        setHistory(watchedForm);
    }, [watchedForm, setHistory]);

    React.useEffect(() => {
        if (isProgrammaticChange.current) {
            reset(historyState, {
                keepErrors: true,
                keepDirty: true,
                keepIsSubmitted: true,
                keepTouched: true,
                keepIsValid: true,
                keepSubmitCount: true,
            });
            isProgrammaticChange.current = false;
        }
    }, [historyState, reset]);

    React.useEffect(() => {
        if (!isDirty) return;

        const currentString = JSON.stringify(debouncedForm);
        if (currentString === lastSavedRef.current) return;

        setAutosaveStatus('saving');
        
        try {
            localStorage.setItem(storageKey, currentString);
            lastSavedRef.current = currentString;
            
            const timer = setTimeout(() => setAutosaveStatus('saved'), 1000);
            const idleTimer = setTimeout(() => setAutosaveStatus('idle'), 3000);
            
            return () => {
                clearTimeout(timer);
                clearTimeout(idleTimer);
            };
        } catch (e) {
            console.error("Auto-save failed:", e);
            setAutosaveStatus('idle');
        }
    }, [debouncedForm, storageKey, isDirty]);

    const handleUndo = () => {
        if (!canUndo) return;
        isProgrammaticChange.current = true;
        undoHistory();
    };

    const handleRedo = () => {
        if (!canRedo) return;
        isProgrammaticChange.current = true;
        redoHistory();
    };

    return (
        <div className="relative pb-24">
            <Card className="bg-muted/30">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Form Builder</CardTitle>
                            <CardDescription>Build your survey using the editor below.</CardDescription>
                        </div>
                         <div className="flex items-center flex-wrap gap-2">
                             <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground min-w-24 text-right transition-all">
                                {autosaveStatus === 'saving' && (
                                    <span className="text-primary flex items-center justify-end gap-1 animate-pulse">
                                        <Loader2 className="h-3 w-3 animate-spin"/> Saving...
                                    </span>
                                )}
                                {autosaveStatus === 'saved' && (
                                    <span className="text-green-600 flex items-center justify-end gap-1">
                                        <Check className="h-3 w-3" /> Cached
                                    </span>
                                )}
                            </div>
                            
                            <TooltipProvider>
                                <div className="flex items-center bg-background/50 rounded-xl p-1 border shadow-sm gap-1">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                type="button"
                                                variant="ghost" 
                                                size="sm" 
                                                className={cn("h-8 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-tighter gap-1.5", allPagesEnabled ? "text-primary bg-primary/10" : "text-muted-foreground")}
                                                onClick={toggleAllPageBreaks}
                                                disabled={sections.length === 0}
                                            >
                                                <Layout className="h-3 w-3" />
                                                Pages
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Toggle Page Breaks for all Sections</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                type="button"
                                                variant="ghost" 
                                                size="sm" 
                                                className={cn("h-8 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-tighter gap-1.5", allValidationEnabled ? "text-primary bg-primary/10" : "text-muted-foreground")}
                                                onClick={toggleAllValidation}
                                                disabled={sections.length === 0}
                                            >
                                                <ShieldCheck className="h-3 w-3" />
                                                Strict
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Toggle Validation for all Sections</TooltipContent>
                                    </Tooltip>
                                </div>
                            </TooltipProvider>

                            <Separator orientation="vertical" className="h-6 mx-1" />
                            <AiChatEditor />
                            <Separator orientation="vertical" className="h-6 mx-1" />
                            <div className="flex items-center gap-1">
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handleUndo} disabled={!canUndo}>
                                    <Undo className="h-5 w-5" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handleRedo} disabled={!canRedo}>
                                    <Redo className="h-5 w-5" />
                                </Button>
                            </div>
                            <Separator orientation="vertical" className="h-6 mx-1" />
                            <SurveyPreviewButton variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                                <Eye className="h-5 w-5" />
                            </SurveyPreviewButton>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {fields.length > 0 ? (
                        <QuestionEditor 
                            fields={fields} 
                            remove={remove} 
                            move={move} 
                            swap={swap} 
                            insert={insert}
                            requestAddElement={requestAddElement}
                        />
                    ) : (
                         <div className="text-center py-20">
                            <p className="text-muted-foreground mb-4 font-medium italic">This survey has no elements yet.</p>
                            <Button type="button" variant="outline" size="lg" onClick={() => {
                                setInsertionIndex(0);
                                setIsAddElementModalOpen(true);
                            }}>
                                <PlusCircle className="mr-2 h-5 w-5" />
                                Add First Element
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            <AddElementModal 
                open={isAddElementModalOpen}
                onOpenChange={setIsAddElementModalOpen}
                onSelect={handleElementSelect}
            />
        </div>
    );
}