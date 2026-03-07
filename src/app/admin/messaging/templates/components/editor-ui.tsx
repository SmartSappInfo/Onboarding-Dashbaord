'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
    Bold, 
    Italic, 
    Underline, 
    AlignLeft, 
    AlignCenter, 
    AlignRight, 
    AlignJustify 
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

export function RichTextEditor({ 
    value, 
    onChange, 
    placeholder, 
    className,
    textAlign = 'left' 
}: RichTextEditorProps) {
    const editorRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); document.execCommand('bold', false); }
            if (e.key === 'i') { e.preventDefault(); document.execCommand('italic', false); }
            if (e.key === 'u') { e.preventDefault(); document.execCommand('underline', false); }
        }
    };

    return (
        <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            className={cn(
                "outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:italic whitespace-pre-wrap",
                textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : textAlign === 'justify' ? 'text-justify' : 'text-left',
                className
            )}
            data-placeholder={placeholder}
        />
    );
}

interface FormattingToolbarProps {
    alignValue?: 'left' | 'center' | 'right' | 'justify';
    onAlignChange?: (val: 'left' | 'center' | 'right' | 'justify') => void;
    minimal?: boolean;
}

export function FormattingToolbar({ alignValue, onAlignChange, minimal }: FormattingToolbarProps) {
    const applyStyle = (cmd: string) => {
        document.execCommand(cmd, false);
    };

    return (
        <div className={cn("flex items-center gap-0.5", !minimal && "bg-muted p-1 rounded-md mb-2")}>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyStyle('bold')} title="Bold (Ctrl+B)">
                <Bold className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyStyle('italic')} title="Italic (Ctrl+I)">
                <Italic className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyStyle('underline')} title="Underline (Ctrl+U)">
                <Underline className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            
            {onAlignChange && (
                <>
                    <Separator orientation="vertical" className="h-4 mx-1" />
                    <Button type="button" variant={alignValue === 'left' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onAlignChange('left')}>
                        <AlignLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant={alignValue === 'center' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onAlignChange('center')}>
                        <AlignCenter className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant={alignValue === 'right' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onAlignChange('right')}>
                        <AlignRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant={alignValue === 'justify' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onAlignChange('justify')}>
                        <AlignJustify className="h-3.5 w-3.5" />
                    </Button>
                </>
            )}
        </div>
    );
}
