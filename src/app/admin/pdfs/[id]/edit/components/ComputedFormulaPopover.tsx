'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Computed Field Formula Builder Popover (Phase 6 UI):
 * 1. Purpose:
 *    Allows template authors to configure dynamic calculated fields (e.g. Subtotals,
 *    Taxes, Discounts, Margins) with reactive AST evaluation and live cycle checking.
 * 2. Cycle Prevention (FM-P6-07):
 *    Validates proposed formulas using `detectFormulaCycles` before saving, alerting
 *    the author immediately if a circular dependency loop would be created.
 * 3. Mobile Ergonomics & Accessibility:
 *    - Touch targets >= 44x44px (`min-h-[44px]`).
 *    - Inputs lock font size at `text-base sm:text-sm` to prevent iOS Safari auto-zoom.
 *    - Tactile micro-interactions (`active:scale-[0.97]`).
 * 4. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calculator, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import {
  ComputedFieldFormula,
  ComputedFieldFormulaType,
} from '@/lib/types/document-signing';
import { detectFormulaCycles } from '@/lib/documents/computed-field-service';

export interface ComputedFormulaPopoverProps {
  currentFieldId: string;
  availableFields: Array<{ id: string; label?: string; type: string; formula?: ComputedFieldFormula }>;
  initialFormula?: ComputedFieldFormula;
  onApplyFormula: (formula: ComputedFieldFormula | undefined) => void;
  trigger?: React.ReactNode;
}

const FORMULA_TYPE_LABELS: Record<ComputedFieldFormulaType, string> = {
  sum: 'Sum (Addition)',
  multiply: 'Multiply (Product)',
  subtract: 'Subtract (Difference)',
  percentage: 'Percentage of Field',
  tax: 'Tax Calculation',
  custom_expression: 'Custom Arithmetic',
};

export function ComputedFormulaPopover({
  currentFieldId,
  availableFields,
  initialFormula,
  onApplyFormula,
  trigger,
}: ComputedFormulaPopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [type, setType] = React.useState<ComputedFieldFormulaType>(
    initialFormula?.type ?? 'sum'
  );
  const [selectedSourceIds, setSelectedSourceIds] = React.useState<string[]>(
    initialFormula?.sourceFieldIds ?? []
  );
  const [decimalPlaces, setDecimalPlaces] = React.useState<number>(
    initialFormula?.decimalPlaces ?? 2
  );
  const [currencySymbol, setCurrencySymbol] = React.useState<string>(
    initialFormula?.currencySymbol ?? '$'
  );

  // Exclude current field from potential sources to avoid self-reference
  const selectableFields = React.useMemo(() => {
    return availableFields.filter((f) => f.id !== currentFieldId);
  }, [availableFields, currentFieldId]);

  // Live dependency cycle check (FM-P6-07)
  const cycleWarning = React.useMemo(() => {
    const candidateFormula: ComputedFieldFormula = {
      type,
      expression: `${type.toUpperCase()}(${selectedSourceIds.join(', ')})`,
      sourceFieldIds: selectedSourceIds,
      decimalPlaces,
      currencySymbol,
    };

    const simulatedGraph = availableFields.map((f) => {
      if (f.id === currentFieldId) {
        return { id: f.id, formula: candidateFormula };
      }
      return { id: f.id, formula: f.formula };
    });

    const check = detectFormulaCycles(simulatedGraph);
    return check.hasCycle
      ? `Circular loop detected: ${check.cyclePath?.join(' → ')}`
      : null;
  }, [availableFields, currentFieldId, type, selectedSourceIds, decimalPlaces, currencySymbol]);

  const toggleSourceField = (fieldId: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handleApply = () => {
    if (cycleWarning) return;

    if (selectedSourceIds.length === 0) {
      onApplyFormula(undefined);
      setIsOpen(false);
      return;
    }

    const formula: ComputedFieldFormula = {
      type,
      expression: `${type.toUpperCase()}(${selectedSourceIds.join(', ')})`,
      sourceFieldIds: selectedSourceIds,
      decimalPlaces,
      currencySymbol: currencySymbol.trim() || undefined,
    };

    onApplyFormula(formula);
    setIsOpen(false);
  };

  const handleClear = () => {
    onApplyFormula(undefined);
    setSelectedSourceIds([]);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            type="button"
            variant={initialFormula ? 'secondary' : 'outline'}
            size="sm"
            className="min-h-[44px] gap-2 rounded-xl text-xs font-semibold active:scale-[0.97] transition-all"
          >
            <Calculator className="h-4 w-4 text-primary" />
            {initialFormula ? 'Formula Active' : 'Add Formula'}
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-96 p-4 rounded-2xl shadow-2xl border bg-background/95 backdrop-blur-md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <h4 className="font-bold text-sm">Dynamic Computed Field</h4>
            </div>
            {initialFormula && (
              <Badge variant="secondary" className="text-[10px]">
                Active
              </Badge>
            )}
          </div>

          {/* Formula Type */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold">Computation Type</Label>
            <Select
              value={type}
              onValueChange={(val) => setType(val as ComputedFieldFormulaType)}
            >
              <SelectTrigger className="min-h-[44px] rounded-xl text-base sm:text-sm">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {Object.entries(FORMULA_TYPE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" /> Quick Presets
            </Label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setType('sum')}
                className="text-xs h-7 rounded-lg active:scale-[0.97]"
              >
                Sum Items
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setType('multiply')}
                className="text-xs h-7 rounded-lg active:scale-[0.97]"
              >
                Qty × Price
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setType('percentage')}
                className="text-xs h-7 rounded-lg active:scale-[0.97]"
              >
                Subtotal × Tax%
              </Button>
            </div>
          </div>

          {/* Source Fields Selection */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold">Source Fields</Label>
            {selectableFields.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">
                No other fields defined on this document yet.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto rounded-xl border p-2 flex flex-col gap-1 bg-muted/20">
                {selectableFields.map((f) => {
                  const isChecked = selectedSourceIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleSourceField(f.id)}
                      className="min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-muted active:scale-[0.97] transition-all text-left"
                    >
                      <span className="font-medium truncate max-w-[200px]">
                        {f.label || f.id}
                      </span>
                      {isChecked ? (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Formatting Options */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Decimals</Label>
              <Input
                type="number"
                min={0}
                max={4}
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(parseInt(e.target.value, 10) || 0)}
                className="min-h-[44px] rounded-xl text-base sm:text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Prefix Symbol</Label>
              <Input
                type="text"
                placeholder="$"
                maxLength={3}
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="min-h-[44px] rounded-xl text-base sm:text-sm"
              />
            </div>
          </div>

          {/* Cycle Warning Alert */}
          {cycleWarning && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{cycleWarning}</span>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            {initialFormula && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs text-destructive hover:bg-destructive/10 min-h-[44px] active:scale-[0.97]"
              >
                Clear
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-xs min-h-[44px] rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                disabled={Boolean(cycleWarning) || selectedSourceIds.length === 0}
                className="text-xs min-h-[44px] rounded-xl active:scale-[0.97]"
              >
                Save Formula
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
