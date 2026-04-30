'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface TagInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export const TagInput = React.forwardRef<HTMLInputElement, TagInputProps>(
  ({ className, value = [], onChange, placeholder, ...props }, ref) => {
    const [pendingDataPoint, setPendingDataPoint] = React.useState('');

    const addPendingDataPoint = () => {
      if (pendingDataPoint) {
        const newTags = new Set(value);
        // Split by commas or semicolons
        const rawTags = pendingDataPoint.split(/[,;]/);
        rawTags.forEach(tag => {
            const trimmed = tag.trim();
            if (trimmed) newTags.add(trimmed);
        });
        onChange(Array.from(newTags));
        setPendingDataPoint('');
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
        e.preventDefault();
        addPendingDataPoint();
      } else if (e.key === 'Backspace' && pendingDataPoint.length === 0 && value.length > 0) {
        e.preventDefault();
        const newTags = [...value];
        newTags.pop();
        onChange(newTags);
      }
    };

    const handleRemove = (tagToRemove: string) => {
      onChange(value.filter((tag) => tag !== tagToRemove));
    };

    return (
      <div
        className={cn(
          "flex min-h-11 w-full flex-wrap gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-sm ring-offset-background transition-colors focus-within:ring-1 focus-within:ring-primary/20",
          className
        )}
      >
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="font-semibold text-xs py-0.5 px-2 flex items-center gap-1 rounded-lg bg-card border border-border shadow-sm">
            {tag}
            <button
              type="button"
              className="ml-1 rounded-full outline-none hover:text-destructive focus:ring-2 focus:ring-ring focus:ring-offset-2 opacity-70 hover:opacity-100 transition-opacity"
              onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemove(tag);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          className="flex-1 bg-transparent outline-none min-w-[120px] text-sm font-semibold text-foreground placeholder:text-muted-foreground"
          value={pendingDataPoint}
          onChange={(e) => setPendingDataPoint(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addPendingDataPoint}
          placeholder={value.length === 0 ? placeholder : ''}
          {...props}
          ref={ref}
        />
      </div>
    );
  }
);

TagInput.displayName = 'TagInput';
