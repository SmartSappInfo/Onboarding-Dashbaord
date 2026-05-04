
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
 <DialogContent className="sm:max-w-4xl rounded-[2rem] border border-border bg-card p-0 overflow-hidden shadow-2xl">
                <DialogHeader className="p-8 pb-6 bg-muted/10 border-b">
                    <DialogTitle className="text-2xl font-bold tracking-tight">Add a New Element</DialogTitle>
                    <DialogDescription className="text-sm font-medium text-muted-foreground/80 mt-1">
                        Select the type of element you want to add to your survey.
                    </DialogDescription>
                </DialogHeader>
 <ScrollArea className="max-h-[70vh] -mx-6">
 <div className="space-y-6 px-6 py-4">
                        <div>
 <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 px-1">Question Elements</h3>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                                {questionTypes.map(({ type, label, icon: Icon }) => (
                                    <Button
                                        key={type}
                                        variant="outline"
                                        className="h-28 flex-col gap-3 p-4 rounded-2xl border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all group shadow-sm hover:shadow-md"
                                        onClick={() => handleSelect(type)}
                                    >
                                        <div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                            <Icon className="h-6 w-6 text-primary" />
                                        </div>
                                        <span className="text-center text-xs font-semibold tracking-tight">{label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <Separator />
                        <div>
 <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 px-1 mt-4">Layout & Logic Blocks</h3>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                            {layoutTypes.map(({ type, label, icon: Icon }) => (
                                    <Button
                                        key={type}
                                        variant="outline"
                                        className="h-28 flex-col gap-3 p-4 rounded-2xl border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all group shadow-sm hover:shadow-md"
                                        onClick={() => handleSelect(type)}
                                    >
                                        <div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                            <Icon className="h-6 w-6 text-primary" />
                                        </div>
                                        <span className="text-center text-xs font-semibold tracking-tight">{label}</span>
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
