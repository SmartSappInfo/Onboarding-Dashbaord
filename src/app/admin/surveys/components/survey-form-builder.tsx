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
import { Undo, Redo, PlusCircle, Eye } from 'lucide-react';
import type { SurveyElement, SurveyQuestion, SurveyLayoutBlock } from '@/lib/types';
import AddElementModal from './add-element-modal';
import SurveyPreviewButton from './survey-preview-button';
import { Separator } from '@/components/ui/separator';

// isLayoutBlock helper function
function isLayoutBlock(element: SurveyElement): element is SurveyLayoutBlock {
    const layoutTypes = ['heading', 'description', 'divider', 'image', 'video', 'audio', 'document', 'embed', 'section'];
    return layoutTypes.includes(element.type);
}

export default function SurveyFormBuilder() {
    const { getValues, setValue, watch, formState: { isDirty }, control, reset } = useFormContext();
    const { toast } = useToast();
    const surveyId = (useParams() as { id?: string }).id || 'new-survey';
    const storageKey = `survey-autosave-${surveyId}`;
    
    const { fields, append, remove, move, swap, insert } = useFieldArray({
      control,
      name: 'elements',
    });
    const [isAddElementModalOpen, setIsAddElementModalOpen] = React.useState(false);
    const [insertionIndex, setInsertionIndex] = React.useState<number>(0);

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
            const sections = getValues('elements').filter((el: SurveyElement) => el.type === 'section');
            (newElement as SurveyLayoutBlock).title = `Section ${sections.length + 1}`;
            (newElement as SurveyLayoutBlock).description = '';
            (newElement as SurveyLayoutBlock).renderAsPage = false;
        } else if (isLayoutBlock(newElement as SurveyElement)) {
            if(type === 'heading') (newElement as SurveyLayoutBlock).title = 'New Heading';
            if(type === 'description') (newElement as SurveyLayoutBlock).text = 'Descriptive text goes here.';
            if(type === 'embed') (newElement as SurveyLayoutBlock).html = '<!-- Paste your HTML code here -->';
            if(['image', 'video', 'audio', 'document'].includes(type)) (newElement as SurveyLayoutBlock).url = '';
        }
        
        insert(insertionIndex, newElement);
    };

    const watchedForm = watch();
    const debouncedForm = useDebounce(watchedForm, 10000);

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

                toast({
                    title: "Unsaved Changes Found",
                    description: "Do you want to restore your unsaved changes from a previous session?",
                    action: (
                        <Button onClick={() => {
                            reset(parsedData);
                            resetHistory(parsedData);
                            toast({ title: 'Success', description: 'Restored unsaved changes.' });
                            localStorage.removeItem(storageKey);
                        }}>
                            Restore
                        </Button>
                    ),
                    duration: 20000,
                });
            } catch (e) {
                console.error("Failed to parse autosaved data", e);
                localStorage.removeItem(storageKey);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        if (isProgrammaticChange.current) {
            return;
        }
        setHistory(watchedForm);
    }, [watchedForm, setHistory]);

    const handleUndo = () => {
        isProgrammaticChange.current = true;
        undoHistory();
    };

    const handleRedo = () => {
        isProgrammaticChange.current = true;
        redoHistory();
    };

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
        if (isDirty) {
            setAutosaveStatus('saving');
            localStorage.setItem(storageKey, JSON.stringify(debouncedForm));
            const timer = setTimeout(() => setAutosaveStatus('saved'), 500);
            const idleTimer = setTimeout(() => setAutosaveStatus('idle'), 2500);
            return () => {
                clearTimeout(timer);
                clearTimeout(idleTimer);
            };
        }
    }, [debouncedForm, storageKey, isDirty]);

    return (
        <div className="relative pb-24">
            <Card className="bg-muted/30">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Form Builder</CardTitle>
                            <CardDescription>Build your survey using the editor below.</CardDescription>
                        </div>
                         <div className="flex items-center gap-2">
                             <span className="text-sm text-muted-foreground transition-opacity duration-500 w-28 text-right">
                                {autosaveStatus === 'saving' && 'Saving...'}
                                {autosaveStatus === 'saved' && 'Changes saved.'}
                            </span>
                            <Button variant="ghost" size="icon" onClick={handleUndo} disabled={!canUndo}>
                                <Undo className="h-5 w-5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleRedo} disabled={!canRedo}>
                                <Redo className="h-5 w-5" />
                            </Button>
                            <Separator orientation="vertical" className="h-6" />
                            <SurveyPreviewButton variant="ghost" size="icon" className="h-9 w-9">
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
                            <p className="text-muted-foreground mb-4">This survey has no elements yet.</p>
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
