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
import { cn } from '@/lib/utils';

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
            <DialogContent className="sm:max-w-xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-8 bg-muted/30 border-b shrink-0 text-left">
                    <div className="flex flex-col items-start gap-2">
                        <div className="p-3 bg-destructive/10 text-destructive rounded-2xl shadow-sm mb-2">
                            <AlertCircle className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                            {errors.some(e => e.message.includes('required')) ? 'Required Fields Missing' : 'Survey Validation Issues'}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground opacity-90">
                            {errors.some(e => e.message.includes('required')) 
                                ? `Please complete ${errors.filter(e => e.message.includes('required')).length} required field${errors.filter(e => e.message.includes('required')).length !== 1 ? 's' : ''} and fix ${errors.length - errors.filter(e => e.message.includes('required')).length} other issue${errors.length - errors.filter(e => e.message.includes('required')).length !== 1 ? 's' : ''}.`
                                : `We found ${errors.length} issue${errors.length !== 1 ? 's' : ''} that need to be resolved before you can proceed.`
                            }
                        </DialogDescription>
                    </div>
                </DialogHeader>

 <ScrollArea className="max-h-[40vh] border rounded-md my-4">
 <div className="divide-y">
                        {errors.map((error, idx) => {
                            const isRequired = error.message.includes('required') || error.message.includes('must be at least');
                            return (
                                <div 
                                    key={idx} 
 className={cn(
                                        "p-4 hover:bg-background0 transition-colors cursor-pointer group",
                                        isRequired && "border-l-4 border-l-destructive bg-destructive/5"
                                    )}
                                    onClick={() => onFix(error.elementId)}
                                >
 <div className="flex justify-between items-start gap-4">
 <div className="space-y-1">
                                            {isRequired && (
 <div className="flex items-center gap-1 mb-1">
 <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">REQUIRED</span>
                                                </div>
                                            )}
 <p className="text-xs font-bold text-muted-foreground">
                                                {error.blockTitle}
                                            </p>
 <p className="text-sm font-semibold text-foreground">
 {error.field}: <span className={cn("font-normal", isRequired ? "text-destructive" : "text-muted-foreground")}>{error.message}</span>
                                            </p>
                                        </div>
 <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground hidden sm:block italic">
                        Click an error to jump to that block.
                    </p>
                    <Button 
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl font-semibold h-12 px-10 shadow-lg cursor-pointer transition-all duration-200 active:scale-95"
                    >
                        Got it, I'll fix them
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
