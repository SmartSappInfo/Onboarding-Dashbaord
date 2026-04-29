'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { TemplateVariable, VariableContext } from '@/lib/types';

interface VariablePickerProps {
  /**
   * Available variables to display in the picker
   */
  variables: TemplateVariable[];
  /**
   * Callback when a variable is selected
   * @param variableName - The variable name to insert (e.g., "meeting_link")
   */
  onVariableSelect: (variableName: string) => void;
  /**
   * Optional trigger button content
   */
  triggerLabel?: string;
  /**
   * Optional className for the trigger button
   */
  triggerClassName?: string;
}

/**
 * VariablePicker Component
 * 
 * A dropdown/popover component that displays available template variables
 * grouped by context. Users can search/filter variables and click to insert
 * them into the template editor.
 * 
 * Features:
 * - Search/filter functionality
 * - Variables grouped by context (Common, Meeting, Form, etc.)
 * - Click to insert {{variable_name}} at cursor position
 * - Displays variable label and example value in tooltip
 * 
 * Task 10.1: Create VariablePicker component
 * Task 10.2: Add search/filter within the variable picker
 */
export function VariablePicker({
  variables,
  onVariableSelect,
  triggerLabel = 'Insert Variable',
  triggerClassName,
}: VariablePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Filter variables based on search query
  const filteredVariables = React.useMemo(() => {
    if (!searchQuery.trim()) return variables;

    const query = searchQuery.toLowerCase();
    return variables.filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        v.label.toLowerCase().includes(query) ||
        v.description.toLowerCase().includes(query)
    );
  }, [variables, searchQuery]);

  // Group variables by context
  const groupedVariables = React.useMemo(() => {
    const groups: Record<string, TemplateVariable[]> = {};

    filteredVariables.forEach((variable) => {
      const ctx = variable.context || 'common';
      if (!groups[ctx]) {
        groups[ctx] = [];
      }
      groups[ctx].push(variable);
    });

    // Sort groups so 'common' is first, then alphabetical
    return Object.entries(groups)
      .filter(([_, vars]) => vars.length > 0)
      .sort(([a], [b]) => {
        if (a === 'common') return -1;
        if (b === 'common') return 1;
        return a.localeCompare(b);
      });
  }, [filteredVariables]);

  const handleVariableClick = (variableName: string) => {
    onVariableSelect(variableName);
    setOpen(false);
    setSearchQuery(''); // Reset search on selection
  };

  const getContextLabel = (context: string) => {
    const defaultLabels: Record<string, string> = {
      common: 'Common',
      meeting: 'Meeting',
      form: 'Form',
      survey: 'Survey',
      agreement: 'Agreement',
      entity: 'Entity',
      campaign: 'Campaign',
    };
    return defaultLabels[context] || context;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2', triggerClassName)}
          type="button"
        >
          <span>{triggerLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex flex-col">
          {/* Search Input */}
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search variables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Variable List */}
          <ScrollArea className="h-[400px]">
            <div className="p-2">
              {groupedVariables.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No variables found
                </div>
              ) : (
                groupedVariables.map(([context, vars]) => (
                  <div key={context} className="mb-4 last:mb-0">
                    {/* Context Header */}
                    <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {getContextLabel(context)}
                    </div>

                    {/* Variables in this context */}
                    <div className="space-y-1">
                      {vars.map((variable) => (
                        <VariableItem
                          key={variable.id}
                          variable={variable}
                          onClick={() => handleVariableClick(variable.name)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * VariableItem Component
 * 
 * Displays a single variable in the picker with hover tooltip
 * showing the variable's label and example value.
 * 
 * Task 10.5: Show tooltip on hover displaying variable label and example value
 */
interface VariableItemProps {
  variable: TemplateVariable;
  onClick: () => void;
}

function VariableItem({ variable, onClick }: VariableItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      title={`${variable.label}\nExample: ${variable.exampleValue}`}
    >
      <div className="flex-1 space-y-1">
        {/* Variable name with {{}} syntax */}
        <div className="font-mono text-xs font-medium text-primary">
          {`{{${variable.name}}}`}
        </div>

        {/* Variable label */}
        <div className="text-xs text-muted-foreground">{variable.label}</div>

        {/* Example value (shown on hover) */}
        <div className="hidden text-xs italic text-muted-foreground group-hover:block">
          Example: {variable.exampleValue}
        </div>
      </div>

      {/* Dynamic/Computed badge */}
      {(variable.isDynamic || variable.isComputed) && (
        <div className="mt-1 flex gap-1">
          {variable.isDynamic && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              Dynamic
            </span>
          )}
          {variable.isComputed && (
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              Computed
            </span>
          )}
        </div>
      )}
    </button>
  );
}
