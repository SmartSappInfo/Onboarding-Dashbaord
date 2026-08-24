'use client';

/**
 * SmartSapp Finance 2.0 - Report Export Toolbar Component
 * Universal CSV, Print, and PDF export toolbar.
 */

import * as React from 'react';
import { Download, Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ReportExportToolbarProps {
  title: string;
  onExportCsv: () => void;
  onPrintPdf?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ReportExportToolbar({
  onExportCsv,
  onPrintPdf,
  isLoading,
  disabled,
}: ReportExportToolbarProps) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      {onPrintPdf && (
        <Button
          variant="outline"
          size="sm"
          onClick={onPrintPdf}
          disabled={disabled || isLoading}
          className="rounded-xl h-10 min-h-[44px] text-xs font-semibold active:scale-[0.97]"
        >
          <Printer className="h-4 w-4 mr-1.5" />
          Print / PDF
        </Button>
      )}

      <Button
        size="sm"
        onClick={onExportCsv}
        disabled={disabled || isLoading}
        className="rounded-xl h-10 min-h-[44px] text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md active:scale-[0.97]"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </>
        )}
      </Button>
    </div>
  );
}
