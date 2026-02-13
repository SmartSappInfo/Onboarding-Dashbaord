'use client';

import { ArrowDown } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ScrollDownIndicatorProps {
  href: string;
  className?: string;
}

export default function ScrollDownIndicator({ href, className }: ScrollDownIndicatorProps) {
  return (
    <div className={cn('absolute bottom-8 left-1/2 -translate-x-1/2 z-20', className)}>
      <Link
        href={href}
        className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors animate-bounce hover:animate-none active:animate-none"
      >
        <span className="text-xs font-semibold uppercase tracking-widest">Scroll</span>
        <ArrowDown className="h-6 w-6" />
      </Link>
    </div>
  );
}
