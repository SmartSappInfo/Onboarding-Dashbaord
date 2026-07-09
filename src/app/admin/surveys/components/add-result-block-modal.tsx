
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
    Heading1,
    Type,
    Image as ImageIcon,
    Video,
    AudioWaveform,
    MousePointer2,
    Quote,
    Square,
    Trophy,
    List,
    LayoutList,
    Code2,
} from 'lucide-react';
import type { SurveyResultBlock } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddResultBlockModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (type: SurveyResultBlock['type']) => void;
}

const blockTypes: { type: SurveyResultBlock['type']; label: string; description: string; icon: React.ElementType }[] = [
    { type: 'heading', label: 'Heading', description: 'Large, bold title for sections.', icon: Heading1 },
    { type: 'text', label: 'Text Block', description: 'Paragraphs with HTML support.', icon: Type },
    { type: 'list', label: 'List View', description: 'Bulleted or numbered points.', icon: List },
    { type: 'image', label: 'Image', description: 'Upload or link an image.', icon: ImageIcon },
    { type: 'video', label: 'Video', description: 'Embed a YouTube or Vimeo link.', icon: Video },
    { type: 'audio', label: 'Audio', description: 'Embed an MP3 or audio file.', icon: AudioWaveform },
    { type: 'button', label: 'Action Button', description: 'Call-to-action link.', icon: MousePointer2 },
    { type: 'quote', label: 'Quote', description: 'Styled block for highlights.', icon: Quote },
    { type: 'divider', label: 'Divider', description: 'Horizontal spacing line.', icon: Square },
    { type: 'score-card', label: 'Score Card', description: 'Dynamic, animated score display.', icon: Trophy },
    { type: 'outcome-categories', label: 'Outcome Categories', description: 'Visual pointer showing all performance brackets.', icon: LayoutList },
    { type: 'code', label: 'Custom Code', description: 'Embed raw HTML or custom code script.', icon: Code2 },
];

export default function AddResultBlockModal({ open, onOpenChange, onSelect }: AddResultBlockModalProps) {
    const handleSelect = (type: SurveyResultBlock['type']) => {
        onSelect(type);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-8 bg-muted/30 border-b shrink-0 text-left">
                    <div className="flex flex-col items-start gap-2">
                        <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-sm mb-2">
                            <LayoutList className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">Add Content to Result Page</DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground opacity-90">
                            Select a block type to add to this outcome.
                        </DialogDescription>
                    </div>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-4">
                        {blockTypes.map(({ type, label, description, icon: Icon }) => (
                            <Button
                                key={type}
                                variant="outline"
 className="h-auto flex-row items-start justify-start gap-4 p-4 text-left hover:border-primary hover:bg-primary/5 transition-all"
                                onClick={() => handleSelect(type)}
                            >
 <div className="p-2 bg-primary/10 rounded-lg shrink-0">
 <Icon className="h-6 w-6 text-primary" />
                                </div>
 <div className="flex flex-col">
 <span className="font-bold text-sm">{label}</span>
 <span className="text-xs text-muted-foreground line-clamp-1">{description}</span>
                                </div>
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
