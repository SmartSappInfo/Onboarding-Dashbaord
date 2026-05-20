'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface BentoPaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}

export function BentoPagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
}: BentoPaginationProps) {
  const startRecord = Math.min((currentPage - 1) * pageSize + 1, totalRecords);
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  // Generate page numbers with ellipsis for dynamic list views
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 2) {
        end = 4;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 3;
      }

      if (start > 2) {
        pages.push('ellipsis-start');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('ellipsis-end');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border bg-card/20 backdrop-blur-sm select-none',
        className
      )}
    >
      {/* Information status */}
      <div className="text-xs font-bold text-muted-foreground tracking-tight order-2 sm:order-1">
        Showing <span className="font-mono text-foreground">{totalRecords === 0 ? 0 : startRecord}</span> to{' '}
        <span className="font-mono text-foreground">{endRecord}</span> of{' '}
        <span className="font-mono text-foreground">{totalRecords}</span> records
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-6 order-1 sm:order-2 w-full sm:w-auto justify-between sm:justify-end">
        {/* Page size dropdown limit selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Limit:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={val => onPageSizeChange(parseInt(val, 10))}
          >
            <SelectTrigger className="h-8 w-[72px] rounded-xl font-bold bg-muted/20 border-border/60 hover:bg-muted/40 transition-colors shadow-inner text-xs">
              <SelectValue placeholder={pageSize.toString()} />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl bg-popover">
              {[50, 100, 200, 500, 1000].map(size => (
                <SelectItem
                  key={size}
                  value={size.toString()}
                  className="font-bold text-xs cursor-pointer focus:bg-primary/10 rounded-lg"
                >
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Buttons page controls */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="h-8 w-8 rounded-xl bg-muted/10 border-border/50 hover:bg-muted/30 disabled:opacity-40 transition-all"
            aria-label="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 rounded-xl bg-muted/10 border-border/50 hover:bg-muted/30 disabled:opacity-40 transition-all"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {/* Page index indicators */}
          <div className="hidden md:flex items-center gap-1">
            {getPageNumbers().map((pageNum, idx) => {
              if (typeof pageNum === 'string') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-8 text-center text-xs font-bold text-muted-foreground opacity-55"
                  >
                    •••
                  </span>
                );
              }

              const isCurrent = pageNum === currentPage;
              return (
                <Button
                  key={`page-${pageNum}`}
                  variant={isCurrent ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    'h-8 w-8 rounded-xl font-bold font-mono text-xs transition-all',
                    isCurrent
                      ? 'shadow-md shadow-primary/20 scale-105'
                      : 'bg-muted/10 border-border/50 hover:bg-muted/30'
                  )}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 rounded-xl bg-muted/10 border-border/50 hover:bg-muted/30 disabled:opacity-40 transition-all"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 rounded-xl bg-muted/10 border-border/50 hover:bg-muted/30 disabled:opacity-40 transition-all"
            aria-label="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
