'use client';

/**
 * ARCHITECTURE:
 * Floating AI Command Bar (Phase 3 - AI Creative Director)
 * 
 * Provides a floating conversational command bar triggered via Cmd+K with instant action pills
 * for natural-language canvas manipulation, headline rewriting, and layout optimization.
 * 
 * CAUTION:
 * Debounce input and handle escape keys cleanly.
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Sparkles, Wand2, ArrowRight, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AiCommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitCommand: (instruction: string) => Promise<void>;
  onOpenConcepts: () => void;
  onOpenCopyMatrix: () => void;
}

export function AiCommandBar({
  open,
  onOpenChange,
  onSubmitCommand,
  onOpenConcepts,
  onOpenCopyMatrix,
}: AiCommandBarProps) {
  const [instruction, setInstruction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Global Cmd+K trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!instruction.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      await onSubmitCommand(instruction.trim());
      setInstruction('');
      onOpenChange(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePillClick = async (presetText: string) => {
    setIsProcessing(true);
    try {
      await onSubmitCommand(presetText);
      onOpenChange(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900/95 border border-emerald-500/30 rounded-3xl p-4 shadow-2xl space-y-3 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/20 blur-3xl pointer-events-none" />

        {/* Input Bar Form */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 relative">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <Input
            ref={inputRef}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Ask AI Director... (e.g. 'Make headline pop', 'Move subject left', 'Optimize for mobile')"
            className="h-11 bg-slate-950 border-slate-800 text-sm font-semibold text-white placeholder:text-slate-500 rounded-2xl pl-3 pr-10 focus-visible:ring-emerald-400"
            disabled={isProcessing}
          />
          {instruction && (
            <Button
              type="submit"
              disabled={isProcessing}
              size="sm"
              className="h-9 px-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shrink-0 active:scale-[0.97]"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </Button>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 text-slate-500 hover:text-white rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Action Pills */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
            Instant Directives
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onOpenConcepts();
              }}
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-bold bg-slate-950 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"
            >
              <Wand2 className="w-3 h-3 mr-1" /> 💡 3 Concepts Ideator
            </Button>

            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onOpenCopyMatrix();
              }}
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-bold bg-slate-950 border-slate-800 text-slate-300 hover:text-white rounded-lg"
            >
              ✍️ Copy Variation Matrix
            </Button>

            <Button
              type="button"
              onClick={() => handlePillClick('Make headline bolder, larger, with high contrast stroke')}
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-bold bg-slate-950 border-slate-800 text-slate-300 hover:text-white rounded-lg"
            >
              💥 Make Headline Pop
            </Button>

            <Button
              type="button"
              onClick={() => handlePillClick('Optimize typography and layout for mobile scan readability')}
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-bold bg-slate-950 border-slate-800 text-slate-300 hover:text-white rounded-lg"
            >
              📱 Optimize for Mobile
            </Button>

            <Button
              type="button"
              onClick={() => handlePillClick('Apply workspace brand kit colors and typography')}
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-bold bg-slate-950 border-slate-800 text-slate-300 hover:text-white rounded-lg"
            >
              🎨 Apply Brand Kit
            </Button>

            <Button
              type="button"
              onClick={() => handlePillClick('Simplify composition, center message, and remove visual clutter')}
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-bold bg-slate-950 border-slate-800 text-slate-300 hover:text-white rounded-lg"
            >
              ✨ Clean Clutter
            </Button>
          </div>
        </div>

        {/* Footer Hint */}
        <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
          <span>Press ESC to dismiss</span>
          <span className="flex items-center gap-1 font-mono">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">Cmd</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
