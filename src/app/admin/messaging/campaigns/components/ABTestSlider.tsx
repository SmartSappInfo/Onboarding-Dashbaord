'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

interface ABTestSliderProps {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}

export function ABTestSlider({ value, onChange, disabled = false }: ABTestSliderProps) {
  const [mounted, setMounted] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const sliderRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-12 bg-muted/20 animate-pulse rounded-xl" />;
  }

  const handleUpdate = (clientX: number) => {
    if (!sliderRef.current || disabled) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const width = rect.width;
    const offsetX = Math.max(0, Math.min(clientX - rect.left, width));
    const percentage = Math.round((offsetX / width) * 100);
    // Limit range between 2% and 100%
    const capped = Math.max(2, Math.min(percentage, 100));
    onChange(capped);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleUpdate(e.clientX);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleUpdate(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleUpdate(e.touches[0].clientX);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      handleUpdate(moveEvent.touches[0].clientX);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  const pctA = Math.round(value / 2);
  const pctB = Math.round(value / 2);
  const pctRemainder = 100 - value;

  const presets = [
    { label: '10% Split', val: 10 },
    { label: '20% Split (Default)', val: 20 },
    { label: '50% Split', val: 50 },
    { label: '100% Split (50/50)', val: 100 },
  ];

  return (
    <div className="space-y-5 w-full">
      <div className="flex justify-between items-center px-1">
        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Test Group Size: {value}%
        </Label>
        <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {value === 100 
            ? '50% Variant A / 50% Variant B (No Remainder)' 
            : `${pctA}% A / ${pctB}% B / ${pctRemainder}% Remainder`}
        </span>
      </div>

      {/* Slider Widget */}
      <div 
        className={cn(
          "relative h-8 flex items-center select-none cursor-pointer rounded-2xl p-1 bg-muted/30 border border-border/30 backdrop-blur-sm",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Track Segments */}
        <div className="absolute inset-1 flex rounded-xl overflow-hidden pointer-events-none">
          {/* Variant A (Blue) */}
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-75"
            style={{ width: `${pctA}%` }}
          />
          {/* Variant B (Violet) */}
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-75"
            style={{ width: `${pctB}%` }}
          />
          {/* Remainder (Glass Slate) */}
          <div 
            className="h-full bg-slate-400/10 transition-all duration-75"
            style={{ width: `${pctRemainder}%` }}
          />
        </div>

        {/* Drag Handle */}
        <motion.div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-lg bg-background border border-violet-200 shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing",
            disabled && "cursor-not-allowed pointer-events-none"
          )}
          style={{ left: `calc(${value}% - 12px)` }}
          animate={{ scale: isHovered || isDragging ? 1.15 : 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div className="h-3 w-1 bg-violet-400 rounded-full mx-[1px]" />
          <div className="h-3 w-1 bg-violet-400 rounded-full mx-[1px]" />
        </motion.div>

        {/* Animated Tooltip Bubble */}
        <AnimatePresence>
          {(isHovered || isDragging) && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: -45, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="absolute left-1/2 -translate-x-1/2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 rounded-xl text-[9px] font-bold shadow-lg flex items-center gap-1.5 whitespace-nowrap z-30"
              style={{ left: `${value}%` }}
            >
              <span>A: {pctA}%</span>
              <span className="opacity-30">|</span>
              <span>B: {pctB}%</span>
              <span className="opacity-30">|</span>
              <span>Rem: {pctRemainder}%</span>
              <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-900 dark:bg-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Preset Badges */}
      <div className="flex flex-wrap gap-2 select-none">
        {presets.map((p) => (
          <Badge
            key={p.val}
            variant="outline"
            className={cn(
              "cursor-pointer text-[9px] font-bold rounded-lg border-border/50 py-1 px-2.5 transition-all hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 active:scale-95",
              value === p.val && "bg-violet-500 text-white border-transparent hover:bg-violet-600 hover:text-white"
            )}
            onClick={() => {
              if (!disabled) onChange(p.val);
            }}
          >
            {p.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
