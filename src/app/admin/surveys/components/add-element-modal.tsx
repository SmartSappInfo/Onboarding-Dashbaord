
'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
    Heading1,
    Text,
    Minus,
    Image,
    Video,
    AudioWaveform,
    FileText,
    Code,
    Bot,
    Layers,
} from 'lucide-react';
import type { SurveyElement } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddElementModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (type: SurveyElement['type']) => void;
}

const questionTypes: { type: SurveyElement['type']; label: string; icon: React.ElementType }[] = [
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

const layoutTypes: { type: SurveyElement['type']; label: string; icon: React.ElementType }[] = [
    { type: 'section', label: 'Section', icon: Layers },
    { type: 'heading', label: 'Heading', icon: Heading1 },
    { type: 'description', label: 'Description', icon: Text },
    { type: 'divider', label: 'Divider', icon: Minus },
    { type: 'image', label: 'Image', icon: Image },
    { type: 'video', label: 'Video', icon: Video },
    { type: 'audio', label: 'Audio', icon: AudioWaveform },
    { type: 'document', label: 'Document', icon: FileText },
    { type: 'embed', label: 'Embed HTML', icon: Code },
    { type: 'logic', label: 'Logic', icon: Bot },
];


export default function AddElementModal({ open, onOpenChange, onSelect }: AddElementModalProps) {
    const handleSelect = (type: SurveyElement['type']) => {
        onSelect(type);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Add a New Element</DialogTitle>
                    <DialogDescription>
                        Select the type of element you want to add to your survey.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] -mx-6">
                    <div className="space-y-6 px-6 py-4">
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Question Elements</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                                {questionTypes.map(({ type, label, icon: Icon }) => (
                                    <Button
                                        key={type}
                                        variant="outline"
                                        className="h-28 flex-col gap-2 p-4"
                                        onClick={() => handleSelect(type)}
                                    >
                                        <Icon className="h-8 w-8 text-primary" />
                                        <span className="text-center text-xs font-normal">{label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <Separator />
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Layout & Logic Blocks</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                            {layoutTypes.map(({ type, label, icon: Icon }) => (
                                    <Button
                                        key={type}
                                        variant="outline"
                                        className="h-28 flex-col gap-2 p-4"
                                        onClick={() => handleSelect(type)}
                                    >
                                        <Icon className="h-8 w-8 text-primary" />
                                        <span className="text-center text-xs font-normal">{label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
