'use client';

/**
 * SmartSapp Forms 2.0: Response Center Column Customizer
 * 
 * Allows users to toggle visibility of standard and custom form response columns,
 * persisting selections to local storage.
 */

import React from 'react';
import { Columns, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ColumnDefinition } from '@/lib/forms/form-response-types';

interface ColumnCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnDefinition[];
  onToggleColumn: (key: string) => void;
  onResetColumns: () => void;
}

export default function ColumnCustomizerModal({
  isOpen,
  onClose,
  columns = [],
  onToggleColumn,
  onResetColumns,
}: ColumnCustomizerModalProps) {
  const standardCols = columns.filter(c => !c.isCustomField);
  const customCols = columns.filter(c => c.isCustomField);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl max-w-md bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Columns className="h-4 w-4 text-primary" />
            Customize Table Columns
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose which standard metadata and form fields are displayed in the submissions grid.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {/* Standard Columns */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Standard Properties
            </span>
            <div className="space-y-1.5 rounded-2xl bg-muted/20 p-3 border border-border/40">
              {standardCols.map((col) => (
                <div key={col.key} className="flex items-center justify-between py-1 px-1 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      id={`col-${col.key}`}
                      checked={col.isVisible}
                      onCheckedChange={() => onToggleColumn(col.key)}
                      disabled={col.key === 'respondent'} // Respondent identity always pinned
                    />
                    <Label htmlFor={`col-${col.key}`} className="text-xs font-semibold cursor-pointer">
                      {col.label}
                    </Label>
                  </div>
                  {col.key === 'respondent' && (
                    <span className="text-[10px] text-muted-foreground italic">Always Pinned</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          {customCols.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Captured Form Fields
              </span>
              <div className="space-y-1.5 rounded-2xl bg-muted/20 p-3 border border-border/40">
                {customCols.map((col) => (
                  <div key={col.key} className="flex items-center justify-between py-1 px-1 rounded-lg hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        id={`col-${col.key}`}
                        checked={col.isVisible}
                        onCheckedChange={() => onToggleColumn(col.key)}
                      />
                      <Label htmlFor={`col-${col.key}`} className="text-xs font-semibold cursor-pointer">
                        {col.label}
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border/40 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetColumns}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-9 rounded-xl"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="text-xs font-bold px-5 h-9 rounded-xl"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
