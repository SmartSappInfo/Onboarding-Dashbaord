'use client';

import * as React from 'react';
import { useSlashAutocomplete } from '@/hooks/use-slash-autocomplete';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { TemplateVariable } from '@/lib/types';

export const SCRIPT_VARIABLES: TemplateVariable[] = [
  { id: 'entity_name', name: 'ENTITY_NAME', label: 'Entity Name', context: 'entity', description: 'Name of the entity', dataType: 'string', exampleValue: 'SmartSapp Inc', isDynamic: false, isComputed: false },
  { id: 'entity_type', name: 'ENTITY_TYPE', label: 'Entity Type', context: 'entity', description: 'Type of the entity', dataType: 'string', exampleValue: 'lead', isDynamic: false, isComputed: false },
  { id: 'primary_contact_name', name: 'PRIMARY_CONTACT_NAME', label: 'Primary Contact Name', context: 'entity', description: 'Name of primary contact', dataType: 'string', exampleValue: 'John Doe', isDynamic: false, isComputed: false },
  { id: 'primary_contact_phone', name: 'PRIMARY_CONTACT_PHONE', label: 'Primary Contact Phone', context: 'entity', description: 'Phone number of primary contact', dataType: 'string', exampleValue: '+1234567890', isDynamic: false, isComputed: false },
  { id: 'current_contact_name', name: 'CURRENT_CONTACT_NAME', label: 'Current Contact Name', context: 'entity', description: 'Name of the current contact being processed', dataType: 'string', exampleValue: 'Jane Smith', isDynamic: false, isComputed: false },
  { id: 'current_contact_phone', name: 'CURRENT_CONTACT_PHONE', label: 'Current Contact Phone', context: 'entity', description: 'Phone number of the current contact', dataType: 'string', exampleValue: '+1098765432', isDynamic: false, isComputed: false },
  { id: 'current_contact_email', name: 'CURRENT_CONTACT_EMAIL', label: 'Current Contact Email', context: 'entity', description: 'Email address of the current contact', dataType: 'string', exampleValue: 'jane@example.com', isDynamic: false, isComputed: false },
  { id: 'agent_name', name: 'AGENT_NAME', label: 'Agent Name', context: 'agent', description: 'Name of the logged-in agent', dataType: 'string', exampleValue: 'Agent Ada', isDynamic: false, isComputed: false },
  { id: 'deal_name', name: 'DEAL_NAME', label: 'Deal Name', context: 'deal', description: 'Name of the active deal', dataType: 'string', exampleValue: 'Workspace Upgrade Deal', isDynamic: false, isComputed: false },
  { id: 'deal_value', name: 'DEAL_VALUE', label: 'Deal Value', context: 'deal', description: 'Value of the active deal', dataType: 'number', exampleValue: '5000', isDynamic: false, isComputed: false },
  { id: 'deal_stage', name: 'DEAL_STAGE', label: 'Deal Stage', context: 'deal', description: 'Stage of the active deal', dataType: 'string', exampleValue: 'Negotiation', isDynamic: false, isComputed: false },
  { id: 'deal_status', name: 'DEAL_STATUS', label: 'Deal Status', context: 'deal', description: 'Status of the active deal', dataType: 'string', exampleValue: 'open', isDynamic: false, isComputed: false },
  { id: 'deal_expected_close', name: 'DEAL_EXPECTED_CLOSE', label: 'Expected Close Date', context: 'deal', description: 'Expected deal close date', dataType: 'date', exampleValue: '2026-12-31', isDynamic: false, isComputed: false },
];

const contextLabels: Record<string, string> = {
  entity: 'Entity',
  deal: 'Deal',
  agent: 'Agent',
};

interface SlashInputProps extends Omit<React.ComponentPropsWithoutRef<typeof Input>, 'onChange' | 'value'> {
  value: string;
  onChange: (val: string) => void;
  variables?: TemplateVariable[];
}

export const SlashInput = React.forwardRef<HTMLInputElement, SlashInputProps>(
  ({ value, onChange, variables = SCRIPT_VARIABLES, className, ...props }, ref) => {
    const localRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => localRef.current!);

    const {
      showAutocomplete,
      autocompleteCoords,
      autocompleteIndex,
      filteredVars,
      handleKeyDown,
      handleInputChange,
      handleSelectChange,
      selectAndInsert,
      setShowAutocomplete,
    } = useSlashAutocomplete({
      variables,
      value,
      onChange,
    });

    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      if (!dropdownRef.current) return;
      const activeEl = dropdownRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }, [autocompleteIndex, showAutocomplete]);

    const handleBlur = React.useCallback(() => {
      setTimeout(() => setShowAutocomplete(false), 200);
    }, [setShowAutocomplete]);

    return (
      <div className="relative w-full">
        <Input
          {...props}
          ref={localRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            handleInputChange(e as any);
          }}
          onKeyDown={(e) => {
            if (e.key === '/' || e.key === 'Slash') {
              e.stopPropagation();
            }
            handleKeyDown(e as any);
          }}
          onKeyUp={(e) => handleSelectChange(e as any)}
          onMouseUp={(e) => handleSelectChange(e as any)}
          onBlur={handleBlur}
          className={className}
        />

        {showAutocomplete && filteredVars.length > 0 && (
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              zIndex: 1000,
            }}
            className="w-64 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 text-left text-popover-foreground scrollbar-thin scrollbar-thumb-muted"
          >
            {filteredVars.map((v, idx) => {
              const labelText = contextLabels[v.context] || String(v.context);
              const isSelected = idx === autocompleteIndex;

              return (
                <button
                  key={v.id}
                  type="button"
                  data-active={isSelected ? 'true' : 'false'}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (localRef.current) {
                      selectAndInsert(v.name, localRef.current);
                    }
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex flex-col gap-0.5 outline-none",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <span className="truncate w-full">{v.label}</span>
                  <span className={cn("text-[9px] font-mono truncate w-full", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {`{{${v.name}}}`} • {labelText}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

SlashInput.displayName = 'SlashInput';

interface SlashTextareaProps extends Omit<React.ComponentPropsWithoutRef<typeof Textarea>, 'onChange' | 'value'> {
  value: string;
  onChange: (val: string) => void;
  variables?: TemplateVariable[];
}

export const SlashTextarea = React.forwardRef<HTMLTextAreaElement, SlashTextareaProps>(
  ({ value, onChange, variables = SCRIPT_VARIABLES, className, ...props }, ref) => {
    const localRef = React.useRef<HTMLTextAreaElement>(null);
    React.useImperativeHandle(ref, () => localRef.current!);

    const {
      showAutocomplete,
      autocompleteCoords,
      autocompleteIndex,
      filteredVars,
      handleKeyDown,
      handleInputChange,
      handleSelectChange,
      selectAndInsert,
      setShowAutocomplete,
    } = useSlashAutocomplete({
      variables,
      value,
      onChange,
    });

    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      if (!dropdownRef.current) return;
      const activeEl = dropdownRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }, [autocompleteIndex, showAutocomplete]);

    const handleBlur = React.useCallback(() => {
      setTimeout(() => setShowAutocomplete(false), 200);
    }, [setShowAutocomplete]);

    return (
      <div className="relative w-full">
        <Textarea
          {...props}
          ref={localRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            handleInputChange(e as any);
          }}
          onKeyDown={(e) => {
            if (e.key === '/' || e.key === 'Slash') {
              e.stopPropagation();
            }
            handleKeyDown(e as any);
          }}
          onKeyUp={(e) => handleSelectChange(e as any)}
          onMouseUp={(e) => handleSelectChange(e as any)}
          onBlur={handleBlur}
          className={className}
        />

        {showAutocomplete && filteredVars.length > 0 && (
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              zIndex: 1000,
            }}
            className="w-64 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 text-left text-popover-foreground scrollbar-thin scrollbar-thumb-muted"
          >
            {filteredVars.map((v, idx) => {
              const labelText = contextLabels[v.context] || String(v.context);
              const isSelected = idx === autocompleteIndex;

              return (
                <button
                  key={v.id}
                  type="button"
                  data-active={isSelected ? 'true' : 'false'}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (localRef.current) {
                      selectAndInsert(v.name, localRef.current);
                    }
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex flex-col gap-0.5 outline-none",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <span className="truncate w-full">{v.label}</span>
                  <span className={cn("text-[9px] font-mono truncate w-full", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {`{{${v.name}}}`} • {labelText}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

SlashTextarea.displayName = 'SlashTextarea';
