'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, ArrowRight } from 'lucide-react';
import type { SurveyElement } from '@/lib/types';

export interface ValidationError {
    elementId: string;
    blockTitle: string;
    field: string;
    message: string;
}

interface ValidationErrorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    errors: ValidationError[];
    onFix: (elementId: string) => void;
}

export default function ValidationErrorModal({ open, onOpenChange, errors, onFix }: ValidationErrorModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-xl">
                <DialogHeader>
 <div className="flex items-center gap-3 mb-2">
 <div className="bg-destructive/10 p-2 rounded-full">
 <AlertCircle className="h-6 w-6 text-destructive" />
                        </div>
 <DialogTitle className="text-xl font-bold">Incomplete Survey Structure</DialogTitle>
                    </div>
                    <DialogDescription>
                        We found {errors.length} issue{errors.length !== 1 ? 's' : ''} that need to be resolved before you can proceed.
                    </DialogDescription>
                </DialogHeader>

 <ScrollArea className="max-h-[40vh] border rounded-md my-4">
 <div className="divide-y">
                        {errors.map((error, idx) => (
                            <div 
                                key={idx} 
 className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                                onClick={() => onFix(error.elementId)}
                            >
 <div className="flex justify-between items-start gap-4">
 <div className="space-y-1">
 <p className="text-xs font-bold text-muted-foreground">
                                            {error.blockTitle}
                                        </p>
 <p className="text-sm font-semibold text-foreground">
 {error.field}: <span className="text-destructive font-normal">{error.message}</span>
                                        </p>
                                    </div>
 <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

 <DialogFooter className="sm:justify-between items-center">
 <p className="text-xs text-muted-foreground hidden sm:block italic">
                        Click an error to jump to that block.
                    </p>
                    <Button onClick={() => onOpenChange(false)}>
                        Got it, I'll fix them
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
