'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
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
    PlusSquare,
    Mail,
    Phone,
} from 'lucide-react';
import type { SurveyElement } from '@/lib/types';

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
    { type: 'email', label: 'Email', icon: Mail },
    { type: 'phone', label: 'Phone Number', icon: Phone },
    { type: 'file-upload', label: 'File Upload', icon: Upload },
];

const layoutTypes: { type: SurveyElement['type']; label: string; icon: React.ElementType }[] = [
    { type: 'heading', label: 'Heading', icon: Heading1 },
    { type: 'description', label: 'Description', icon: Text },
    { type: 'divider', label: 'Divider', icon: Minus },
    { type: 'image', label: 'Image', icon: Image },
    { type: 'video', label: 'Video', icon: Video },
    { type: 'audio', label: 'Audio', icon: AudioWaveform },
    { type: 'document', label: 'Document', icon: FileText },
    { type: 'embed', label: 'Embed HTML', icon: Code },
];


export default function AddElementModal({ open, onOpenChange, onSelect }: AddElementModalProps) {
    const handleSelect = (type: SurveyElement['type']) => {
        onSelect(type);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
                <DialogHeader demarcated className="px-6 py-3.5 sm:py-4">
                    <div className="flex items-center gap-2">
                        <PlusSquare className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                        <DialogTitle className="font-bold text-base tracking-tight text-foreground">Add a New Element</DialogTitle>
                        <CardInfoTooltip text="Select the type of element you want to add to your survey." />
                    </div>
                    <DialogDescription className="sr-only">
                        Select the type of element you want to add to your survey.
                    </DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                    <div>
 <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Question Elements</h3>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
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
                    </div>
                     <Separator />
                     <div>
 <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Layout & Media Blocks</h3>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
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
            </DialogContent>
        </Dialog>
    );
}
