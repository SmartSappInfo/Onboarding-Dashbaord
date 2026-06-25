'use client';

import * as React from 'react';
import {
    Plus,
    ArrowUp,
    ArrowDown,
    Copy,
    Trash2,
    StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NodeActionToolbarProps {
    nodeId: string;
    isVisible: boolean;
    isTrigger?: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    hasNote: boolean;
    onAddAbove: () => void;
    onAddBelow: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onToggleNote: () => void;
}

interface ToolbarButtonProps {
    icon: React.ElementType;
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'default' | 'destructive' | 'accent';
}

const ToolbarButton = React.memo(function ToolbarButton({
    icon: Icon,
    label,
    shortcut,
    onClick,
    disabled = false,
    variant = 'default',
}: ToolbarButtonProps) {
    const [showTooltip, setShowTooltip] = React.useState(false);

    return (
        <div className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className={cn(
                    'h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-150',
                    disabled && 'opacity-30 cursor-not-allowed',
                    !disabled && variant === 'default' && 'text-muted-foreground hover:text-foreground hover:bg-muted/80',
                    !disabled && variant === 'destructive' && 'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                    !disabled && variant === 'accent' && 'text-amber-500 hover:text-amber-600 hover:bg-amber-500/10',
                )}
            >
                <Icon className="h-3.5 w-3.5" />
            </button>

            {/* Tooltip */}
            {showTooltip && !disabled && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none z-50">
                    <div className="bg-foreground text-background text-[9px] font-semibold px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                        {label}
                        {shortcut && (
                            <span className="ml-1.5 text-background/60 font-mono">{shortcut}</span>
                        )}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                            <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-foreground" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export const NodeActionToolbar = React.memo(function NodeActionToolbar({
    isVisible,
    isTrigger = false,
    canMoveUp,
    canMoveDown,
    hasNote,
    onAddAbove,
    onAddBelow,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    onDelete,
    onToggleNote,
}: NodeActionToolbarProps) {
    const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac');
    const modKey = isMac ? '⌘' : 'Ctrl';

    if (isTrigger) return null;

    return (
        <div
            className={cn(
                'absolute -top-10 left-1/2 -translate-x-1/2 z-50 transition-all duration-200',
                isVisible
                    ? 'opacity-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 translate-y-1 pointer-events-none',
            )}
        >
            <div className="flex items-center gap-0.5 bg-card/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl px-1 py-0.5 ring-1 ring-black/5">
                <ToolbarButton
                    icon={Plus}
                    label="Add Above"
                    onClick={onAddAbove}
                />
                <ToolbarButton
                    icon={Plus}
                    label="Add Below"
                    onClick={onAddBelow}
                />
                <div className="w-px h-4 bg-border/60 mx-0.5" />
                <ToolbarButton
                    icon={ArrowUp}
                    label="Move Up"
                    onClick={onMoveUp}
                    disabled={!canMoveUp}
                />
                <ToolbarButton
                    icon={ArrowDown}
                    label="Move Down"
                    onClick={onMoveDown}
                    disabled={!canMoveDown}
                />
                <div className="w-px h-4 bg-border/60 mx-0.5" />
                <ToolbarButton
                    icon={StickyNote}
                    label={hasNote ? 'Edit Note' : 'Add Note'}
                    onClick={onToggleNote}
                    variant={hasNote ? 'accent' : 'default'}
                />
                <ToolbarButton
                    icon={Copy}
                    label="Duplicate"
                    shortcut={`${modKey}+D`}
                    onClick={onDuplicate}
                />
                <ToolbarButton
                    icon={Trash2}
                    label="Delete"
                    shortcut="⌫"
                    onClick={onDelete}
                    variant="destructive"
                />
            </div>
        </div>
    );
});
