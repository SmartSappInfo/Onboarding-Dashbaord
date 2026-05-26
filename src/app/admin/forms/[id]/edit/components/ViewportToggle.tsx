'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Monitor, Tablet, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewportSize = 'desktop' | 'tablet' | 'mobile';

interface ViewportToggleProps {
  currentSize: ViewportSize;
  onChange: (size: ViewportSize) => void;
  className?: string;
}

export default function ViewportToggle({
  currentSize,
  onChange,
  className,
}: ViewportToggleProps) {
  const options = [
    { value: 'desktop' as const, label: 'Desktop', icon: Monitor },
    { value: 'tablet' as const, label: 'Tablet', icon: Tablet },
    { value: 'mobile' as const, label: 'Mobile', icon: Smartphone },
  ];

  return (
    <div className={cn('flex items-center gap-1 bg-muted/40 p-1 border rounded-xl', className)}>
      {options.map(opt => {
        const Icon = opt.icon;
        const isActive = currentSize === opt.value;
        return (
          <Button
            key={opt.value}
            variant="ghost"
            size="sm"
            onClick={() => onChange(opt.value)}
            className={cn(
              'h-8 px-2.5 rounded-lg text-xs font-semibold gap-1.5 transition-all outline-none',
              isActive
                ? 'bg-background text-primary shadow-sm hover:bg-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{opt.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
