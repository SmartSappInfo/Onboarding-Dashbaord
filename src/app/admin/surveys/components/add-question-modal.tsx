'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Baseline,
    Pilcrow,
    CheckCircle2,
    ListChecks,
    ChevronDownSquare,
    Star,
    Calendar,
    Clock,
    Upload,
    CheckCircle,
} from 'lucide-react';
import type { SurveyQuestion } from '@/lib/types';

interface AddQuestionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (type: SurveyQuestion['type']) => void;
}

const questionTypes: { type: SurveyQuestion['type']; label: string; icon: React.ElementType }[] = [
    { type: 'text', label: 'Short Text', icon: Baseline },
    { type: 'long-text', label: 'Long Text', icon: Pilcrow },
    { type: 'yes-no', label: 'Yes/No', icon: CheckCircle2 },
    { type: 'multiple-choice', label: 'Multiple Choice', icon: CheckCircle },
    { type: 'checkboxes', label: 'Checkboxes', icon: ListChecks },
    { type: 'dropdown', label: 'Dropdown', icon: ChevronDownSquare },
    { type: 'rating', label: 'Rating (1-5)', icon: Star },
    { type: 'date', label: 'Date', icon: Calendar },
    { type: 'time', label: 'Time', icon: Clock },
    { type: 'file-upload', label: 'File Upload', icon: Upload },
];

export default function AddQuestionModal({ open, onOpenChange, onSelect }: AddQuestionModalProps) {
    const handleSelect = (type: SurveyQuestion['type']) => {
        onSelect(type);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Add a New Question</DialogTitle>
                    <DialogDescription>
                        Select the type of question you want to add to your survey.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-4">
                    {questionTypes.map(({ type, label, icon: Icon }) => (
                        <Button
                            key={type}
                            variant="outline"
                            className="h-28 flex-col gap-2 p-4"
                            onClick={() => handleSelect(type)}
                            disabled={type === 'file-upload'} // Disable file upload for now
                        >
                            <Icon className="h-8 w-8 text-primary" />
                            <span className="text-center text-xs font-normal">{label}</span>
                             {type === 'file-upload' && <span className="text-xs text-muted-foreground">(Soon)</span>}
                        </Button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
