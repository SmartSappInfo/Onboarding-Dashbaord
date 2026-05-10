'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { 
    Trash2, Copy, Eye, EyeOff, ArrowUp, ArrowDown, 
    ChevronsUp, ChevronsDown, Bold, Italic, Underline,
    AlignLeft, AlignCenter, AlignRight, AlignJustify, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BulkActionsBarProps {
  selectedIds: string[];
  onClear: () => void;
  onAction: (action: string, value?: any) => void;
}

export function BulkActionsBar({ selectedIds, onClear, onAction }: BulkActionsBarProps) {
  if (selectedIds.length <= 1) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0, x: '-50%' }}
        animate={{ y: 0, opacity: 1, x: '-50%' }}
        exit={{ y: 100, opacity: 0, x: '-50%' }}
        className="fixed bottom-12 left-1/2 z-[60] bg-foreground/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] px-8 py-4 flex items-center gap-5 text-white"
      >
        <div className="flex items-center gap-4 pr-5 border-r border-white/10">
          <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center text-xs font-black shadow-lg shadow-primary/20">
            {selectedIds.length}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 leading-none mb-1">Bulk Edit</span>
            <span className="text-sm font-bold leading-tight">Selection</span>
          </div>
        </div>

        <TooltipProvider delayDuration={0}>
          <div className="flex items-center gap-1">
            <ActionButton icon={ChevronsUp} label="Move to Top" onClick={() => onAction('move-top')} />
            <ActionButton icon={ArrowUp} label="Move Up" onClick={() => onAction('move-up')} />
            <ActionButton icon={ArrowDown} label="Move Down" onClick={() => onAction('move-down')} />
            <ActionButton icon={ChevronsDown} label="Move to Bottom" onClick={() => onAction('move-bottom')} />
          </div>

          <Separator orientation="vertical" className="h-10 bg-white/10 mx-1" />

          <div className="flex items-center gap-1">
            <ActionButton icon={AlignLeft} label="Align Left" onClick={() => onAction('align', 'left')} />
            <ActionButton icon={AlignCenter} label="Align Center" onClick={() => onAction('align', 'center')} />
            <ActionButton icon={AlignRight} label="Align Right" onClick={() => onAction('align', 'right')} />
            <ActionButton icon={AlignJustify} label="Justify" onClick={() => onAction('align', 'justify')} />
          </div>

          <Separator orientation="vertical" className="h-10 bg-white/10 mx-1" />

          <div className="flex items-center gap-1">
            <ActionButton icon={Bold} label="Bold" onClick={() => onAction('format', 'b')} />
            <ActionButton icon={Italic} label="Italic" onClick={() => onAction('format', 'i')} />
            <ActionButton icon={Underline} label="Underline" onClick={() => onAction('format', 'u')} />
          </div>

          <Separator orientation="vertical" className="h-10 bg-white/10 mx-1" />

          <div className="flex items-center gap-1">
            <ActionButton icon={EyeOff} label="Hide All" onClick={() => onAction('visibility', true)} />
            <ActionButton icon={Eye} label="Show All" onClick={() => onAction('visibility', false)} />
            <ActionButton icon={Copy} label="Clone Selected" onClick={() => onAction('clone')} />
            <ActionButton 
                icon={Trash2} 
                label="Delete Selected" 
                onClick={() => onAction('delete')} 
                className="text-rose-400 hover:text-rose-100 hover:bg-rose-500/40" 
            />
          </div>
        </TooltipProvider>

        <Separator orientation="vertical" className="h-10 bg-white/10 mx-1" />

        <Button 
          variant="ghost" 
          size="icon" 
          className="h-12 w-12 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors" 
          onClick={onClear}
        >
          <X className="h-6 w-6" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}

function ActionButton({ icon: Icon, label, onClick, className }: any) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn("h-11 w-11 rounded-2xl hover:bg-white/10 transition-all text-white/70 hover:text-white active:scale-90", className)} 
          onClick={onClick}
        >
          <Icon className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-foreground text-background font-bold border-none px-3 py-1.5 rounded-lg shadow-2xl">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
