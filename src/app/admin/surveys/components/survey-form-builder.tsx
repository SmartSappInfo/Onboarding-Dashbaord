
'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import QuestionEditor from './question-editor';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import { useDebounce } from '@/hooks/use-debounce';
import { Undo, Redo } from 'lucide-react';
import type { SurveyElement } from '@/lib/types';

export default function SurveyFormBuilder() {
    const { getValues, setValue, watch, formState: { isDirty } } = useFormContext();
    const { toast } = useToast();
    const surveyId = (useParams() as { id?: string }).id || 'new-survey';
    const storageKey = `survey-autosave-${surveyId}`;
    
    const watchedElements = watch('elements');
    const debouncedElements = useDebounce(watchedElements, 10000); // 10 seconds

    const {
        state: historyState,
        set: setHistory,
        undo: undoHistory,
        redo: redoHistory,
        canUndo,
        canRedo,
        reset: resetHistory
    } = useUndoRedo<SurveyElement[]>(getValues('elements') || []);

    const isProgrammaticChange = React.useRef(false);
    const [autosaveStatus, setAutosaveStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle');

    // Effect for initializing and restoring data
    React.useEffect(() => {
        // Initialize history state with form values on mount
        const initialElements = getValues('elements');
        resetHistory(initialElements);

        const savedData = localStorage.getItem(storageKey);
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                toast({
                    title: "Unsaved Changes Found",
                    description: "Do you want to restore your unsaved changes from a previous session?",
                    action: (
                        <Button onClick={() => {
                            setValue('elements', parsedData, { shouldDirty: true });
                            resetHistory(parsedData);
                            toast({ title: 'Success', description: 'Restored unsaved changes.' });
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
    }, []); // Run only on mount

    // Effect for syncing form changes to history
    React.useEffect(() => {
        if (isProgrammaticChange.current) {
            return;
        }
        setHistory(watchedElements);
    }, [watchedElements, setHistory]);

    // Undo/Redo handlers
    const handleUndo = () => {
        isProgrammaticChange.current = true;
        undoHistory();
    };

    const handleRedo = () => {
        isProgrammaticChange.current = true;
        redoHistory();
    };

    // Effect for applying undo/redo changes back to the form
    React.useEffect(() => {
        if (isProgrammaticChange.current) {
            setValue('elements', historyState, { shouldDirty: true });
            isProgrammaticChange.current = false;
        }
    }, [historyState, setValue]);

    // Effect for autosaving to localStorage
    React.useEffect(() => {
        if (isDirty) {
            setAutosaveStatus('saving');
            localStorage.setItem(storageKey, JSON.stringify(debouncedElements));
            const timer = setTimeout(() => setAutosaveStatus('saved'), 500);
            const idleTimer = setTimeout(() => setAutosaveStatus('idle'), 2500);
            return () => {
                clearTimeout(timer);
                clearTimeout(idleTimer);
            };
        }
    }, [debouncedElements, storageKey, isDirty]);

    return (
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
                        <Button type="button" variant="outline" size="icon" onClick={handleUndo} disabled={!canUndo}>
                            <Undo className="h-4 w-4" />
                            <span className="sr-only">Undo</span>
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={handleRedo} disabled={!canRedo}>
                            <Redo className="h-4 w-4" />
                            <span className="sr-only">Redo</span>
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <QuestionEditor />
            </CardContent>
        </Card>
    );
}
