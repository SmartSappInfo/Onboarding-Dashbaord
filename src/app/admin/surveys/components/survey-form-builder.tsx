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
import { Undo, Redo, PlusCircle, Eye, Loader2, Check, Layout, ShieldCheck, Zap, GripVertical } from 'lucide-react';
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
                            <Button 
                                variant="default" 
                                size="sm" 
                                className="rounded-full px-6 font-bold shadow-md hover:shadow-lg transition-all"
                                onClick={() => {
                                    reset(parsedData);
                                    resetHistory(parsedData);
                                    lastSavedRef.current = JSON.stringify(parsedData);
                                    toast({ title: 'Restored', description: 'Your unsaved changes have been applied.' });
                                    localStorage.removeItem(storageKey);
                                }}
                            >
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
 <div className="relative">
 <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Vertical Builder Toolbar - Now Top Left */}
 <div className="hidden md:block w-14 shrink-0 sticky top-24">
                        <Card className="shadow-sm border border-border bg-card p-1.5 rounded-2xl flex flex-col items-center gap-3">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        type="button"
                                        size="icon" 
                                        variant="ghost" 
 className="h-10 w-10 rounded-xl hover:bg-primary/10 transition-colors"
                                        onClick={() => requestAddElement(fields.length - 1)}
                                    >
 <PlusCircle className="h-5 w-5 text-primary" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">Add Block</TooltipContent>
                            </Tooltip>

 <Separator className="w-8" />

                            <AiChatEditor variant="icon" />

 <Separator className="w-8" />

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        type="button"
                                        size="icon" 
                                        variant={allPagesEnabled ? "secondary" : "ghost"} 
 className={cn("h-10 w-10 rounded-xl", allPagesEnabled && "bg-primary/10 text-primary")}
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
                                        type="button"
                                        size="icon" 
                                        variant={allValidationEnabled ? "secondary" : "ghost"} 
 className={cn("h-10 w-10 rounded-xl", allValidationEnabled && "bg-primary/10 text-primary")}
                                        onClick={toggleAllValidation}
                                    >
 <ShieldCheck className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">Toggle All Strict Validation</TooltipContent>
                            </Tooltip>

 <Separator className="w-8" />

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        type="button"
                                        size="icon" 
                                        variant="ghost" 
 className="h-10 w-10 rounded-xl disabled:opacity-30"
                                        onClick={handleUndo} 
                                        disabled={!canUndo}
                                    >
 <Undo className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">Undo</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        type="button"
                                        size="icon" 
                                        variant="ghost" 
 className="h-10 w-10 rounded-xl disabled:opacity-30"
                                        onClick={handleRedo} 
                                        disabled={!canRedo}
                                    >
 <Redo className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">Redo</TooltipContent>
                            </Tooltip>

 <Separator className="w-8" />

                            <Tooltip>
                                <TooltipTrigger asChild>
 <div className="inline-block">
 <SurveyPreviewButton variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
 <Eye className="h-5 w-5 text-primary" />
                                        </SurveyPreviewButton>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right">Preview Survey</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </Card>
                </div>

 <div className="flex-1 w-full">
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
                        <div className="text-center py-20 bg-card border border-dashed border-border/50 rounded-2xl shadow-sm">
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
