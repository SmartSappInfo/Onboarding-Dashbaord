'use client';

import * as React from 'react';
import AiModelSelector from '@/components/ai/AiModelSelector';
import { Sparkles, X } from 'lucide-react';

interface AiAssistantModalHeaderProps {
  title: string;
  description?: string;
  onClose: () => void;
}

export function AiAssistantModalHeader({
  title,
  description,
  onClose,
}: AiAssistantModalHeaderProps) {
  return (
    <div className="flex flex-col gap-2 pb-4 border-b border-border/40 w-full">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-500 shrink-0">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
          <h3 className="font-bold text-sm text-foreground truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Universal Model Selector */}
          <AiModelSelector hideLabel={true} className="scale-90 origin-right" />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{description}</p>
      )}
    </div>
  );
}
