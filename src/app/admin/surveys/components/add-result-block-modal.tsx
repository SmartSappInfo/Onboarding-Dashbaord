
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
    MousePointer2,
    Quote,
    Square,
    Trophy,
    List,
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
    { type: 'button', label: 'Action Button', description: 'Call-to-action link.', icon: MousePointer2 },
    { type: 'quote', label: 'Quote', description: 'Styled block for highlights.', icon: Quote },
    { type: 'divider', label: 'Divider', description: 'Horizontal spacing line.', icon: Square },
    { type: 'score-card', label: 'Score Card', description: 'Dynamic, animated score display.', icon: Trophy },
];

export default function AddResultBlockModal({ open, onOpenChange, onSelect }: AddResultBlockModalProps) {
    const handleSelect = (type: SurveyResultBlock['type']) => {
        onSelect(type);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Add Content to Result Page</DialogTitle>
                    <DialogDescription>
                        Select a block type to add to this outcome.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mx-6">
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
