'use client';

import * as React from 'react';
import { useSlashAutocomplete } from '@/hooks/use-slash-autocomplete';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { TemplateVariable } from '@/lib/types';
import { Bold, Italic, Underline, Strikethrough } from 'lucide-react';

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

export function convertToVisualHtml(text: string): string {
  if (!text) return '';
  // Convert variable tokens back to non-editable HTML spans
  const parsed = text.replace(/\{\{([\w_]+)\}\}/g, (match, varName) => {
    return `<span contenteditable="false" data-variable="${varName}" class="inline-flex items-center mx-0.5 px-2 py-0.5 rounded bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono text-[90%] font-bold border border-blue-200/50 align-baseline select-none">${varName}</span>`;
  });
  return parsed;
}

export function convertToCleanHtml(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Convert visual spans back to {{variable}} tokens
  const pills = clone.querySelectorAll('[data-variable]');
  pills.forEach((pill) => {
    const varName = pill.getAttribute('data-variable');
    const textNode = clone.ownerDocument.createTextNode(`{{${varName}}}`);
    pill.parentNode?.replaceChild(textNode, pill);
  });

  return clone.innerHTML;
}

interface FormattingToolbarProps {
  onFormat: (type: 'bold' | 'italic' | 'underline' | 'strike' | 'color', color?: string) => void;
  className?: string;
}

function FormattingToolbar({ onFormat, className }: FormattingToolbarProps) {
  const colors = [
    { name: 'Default', value: '' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Slate', value: '#64748b' }
  ];

  return (
    <div className={cn("flex items-center gap-0.5 p-1 bg-popover border border-border/80 rounded-xl absolute -top-9 left-0 z-50 animate-in fade-in slide-in-from-bottom-1 duration-150 shadow-md", className)}>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onFormat('bold'); }}
        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onFormat('italic'); }}
        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onFormat('underline'); }}
        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
        title="Underline"
      >
        <Underline className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onFormat('strike'); }}
        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </button>
      <div className="h-4 w-px bg-border mx-1" />
      <div className="flex gap-0.5 items-center pr-1">
        {colors.map((c) => (
          <button
            key={c.name}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onFormat('color', c.value); }}
            className="w-3.5 h-3.5 rounded-full border border-border/50 transition-transform hover:scale-110"
            style={{ backgroundColor: c.value || 'currentColor' }}
            title={c.name}
          />
        ))}
      </div>
    </div>
  );
}

function useFormatting(
  localRef: React.RefObject<HTMLDivElement | null>,
  value: string,
  onChange: (val: string) => void
) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [hasSelection, setHasSelection] = React.useState(false);

  const checkSelection = React.useCallback(() => {
    const el = localRef.current;
    if (!el) return;
    const selection = window.getSelection();
    setHasSelection(
      selection !== null &&
      selection.rangeCount > 0 &&
      !selection.isCollapsed &&
      el.contains(selection.anchorNode) === true
    );
  }, [localRef]);

  const applyFormatting = React.useCallback((format: 'bold' | 'italic' | 'underline' | 'strike' | 'color', colorValue?: string) => {
    const el = localRef.current;
    if (!el) return;

    el.focus();
    document.execCommand('styleWithCSS', false, 'false');
    
    switch (format) {
      case 'bold':
        document.execCommand('bold', false);
        break;
      case 'italic':
        document.execCommand('italic', false);
        break;
      case 'underline':
        document.execCommand('underline', false);
        break;
      case 'strike':
        document.execCommand('strikeThrough', false);
        break;
      case 'color':
        document.execCommand('foreColor', false, colorValue || '#000000');
        break;
    }

    onChange(convertToCleanHtml(el));
    checkSelection();
  }, [localRef, onChange, checkSelection]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
    const hasModifier = isMac ? e.metaKey : e.ctrlKey;
    
    if (hasModifier) {
      if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        applyFormatting('bold');
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        applyFormatting('italic');
      } else if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        applyFormatting('underline');
      }
    }
  }, [applyFormatting]);

  return {
    isFocused,
    setIsFocused,
    hasSelection,
    checkSelection,
    applyFormatting,
    handleKeyDown,
  };
}

interface SlashInputProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'onChange' | 'value' | 'placeholder'> {
  value: string;
  onChange: (val: string) => void;
  variables?: TemplateVariable[];
  enableFormatting?: boolean;
  placeholder?: string;
  autoComplete?: string;
}

export const SlashInput = React.forwardRef<HTMLInputElement, SlashInputProps>(
  ({ value, onChange, variables = SCRIPT_VARIABLES, enableFormatting = false, className, placeholder, autoComplete, ...props }, ref) => {
    const localRef = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref, () => localRef.current as unknown as HTMLInputElement);

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

    const formatting = useFormatting(localRef, value, onChange);

    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const lastValueRef = React.useRef(value);

    React.useEffect(() => {
      if (localRef.current) {
        localRef.current.innerHTML = convertToVisualHtml(value);
      }
    }, []);

    React.useEffect(() => {
      const el = localRef.current;
      if (!el) return;
      const cleanVal = convertToCleanHtml(el);
      if (cleanVal !== value) {
        lastValueRef.current = value;
        el.innerHTML = convertToVisualHtml(value);
      }
    }, [value]);

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

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const cleanVal = convertToCleanHtml(el);
      lastValueRef.current = cleanVal;
      onChange(cleanVal);
      handleInputChange({ target: el } as unknown as React.ChangeEvent<HTMLInputElement>);
    };

    return (
      <div className="relative w-full">
        {enableFormatting && formatting.isFocused && formatting.hasSelection && (
          <FormattingToolbar 
            onFormat={formatting.applyFormatting} 
            className="-top-10"
          />
        )}
        {!value && (
          <div className="absolute pointer-events-none opacity-50 px-3 py-2 text-sm select-none">
            {placeholder}
          </div>
        )}
        <div
          {...props}
          contentEditable
          ref={localRef}
          onInput={handleInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (showAutocomplete && filteredVars.length > 0) {
                const selectedVar = filteredVars[autocompleteIndex];
                if (selectedVar) {
                  selectAndInsert(selectedVar.name, e.currentTarget);
                }
              }
              return;
            }
            if (e.key === '/' || e.key === 'Slash') {
              e.stopPropagation();
            }
            handleKeyDown(e as unknown as React.KeyboardEvent<HTMLDivElement>);
            if (enableFormatting) {
              formatting.handleKeyDown(e as unknown as React.KeyboardEvent<HTMLDivElement>);
            }
          }}
          onKeyUp={(e) => {
            handleSelectChange(e as unknown as React.SyntheticEvent<HTMLDivElement>);
            if (enableFormatting) {
              formatting.checkSelection();
            }
          }}
          onMouseUp={(e) => {
            handleSelectChange(e as unknown as React.SyntheticEvent<HTMLDivElement>);
            if (enableFormatting) {
              formatting.checkSelection();
            }
          }}
          onSelect={(e) => {
            if (enableFormatting) {
              formatting.checkSelection();
            }
          }}
          onFocus={() => {
            if (enableFormatting) {
              formatting.setIsFocused(true);
            }
          }}
          onBlur={(e) => {
            handleBlur();
            if (enableFormatting) {
              setTimeout(() => formatting.setIsFocused(false), 250);
            }
          }}
          className={cn(
            "w-full bg-background border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[40px] break-words whitespace-nowrap overflow-x-auto outline-none",
            className
          )}
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

interface SlashTextareaProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'onChange' | 'value' | 'placeholder'> {
  value: string;
  onChange: (val: string) => void;
  variables?: TemplateVariable[];
  enableFormatting?: boolean;
  placeholder?: string;
  rows?: number;
}

export const SlashTextarea = React.forwardRef<HTMLTextAreaElement, SlashTextareaProps>(
  ({ value, onChange, variables = SCRIPT_VARIABLES, enableFormatting = false, className, placeholder, rows, ...props }, ref) => {
    const localRef = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref, () => localRef.current as unknown as HTMLTextAreaElement);

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

    const formatting = useFormatting(localRef, value, onChange);

    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const lastValueRef = React.useRef(value);

    React.useEffect(() => {
      if (localRef.current) {
        localRef.current.innerHTML = convertToVisualHtml(value);
      }
    }, []);

    React.useEffect(() => {
      const el = localRef.current;
      if (!el) return;
      const cleanVal = convertToCleanHtml(el);
      if (cleanVal !== value) {
        lastValueRef.current = value;
        el.innerHTML = convertToVisualHtml(value);
      }
    }, [value]);

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

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const cleanVal = convertToCleanHtml(el);
      lastValueRef.current = cleanVal;
      onChange(cleanVal);
      handleInputChange({ target: el } as unknown as React.ChangeEvent<HTMLInputElement>);
    };

    return (
      <div className="relative w-full">
        {enableFormatting && formatting.isFocused && formatting.hasSelection && (
          <FormattingToolbar 
            onFormat={formatting.applyFormatting} 
            className="-top-10"
          />
        )}
        {!value && (
          <div className="absolute pointer-events-none opacity-50 px-3 py-2 text-sm select-none">
            {placeholder}
          </div>
        )}
        <div
          {...props}
          contentEditable
          ref={localRef}
          onInput={handleInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && showAutocomplete && filteredVars.length > 0) {
              e.preventDefault();
              const selectedVar = filteredVars[autocompleteIndex];
              if (selectedVar) {
                selectAndInsert(selectedVar.name, e.currentTarget);
              }
              return;
            }
            if (e.key === '/' || e.key === 'Slash') {
              e.stopPropagation();
            }
            handleKeyDown(e as unknown as React.KeyboardEvent<HTMLDivElement>);
            if (enableFormatting) {
              formatting.handleKeyDown(e as unknown as React.KeyboardEvent<HTMLDivElement>);
            }
          }}
          onKeyUp={(e) => {
            handleSelectChange(e as unknown as React.SyntheticEvent<HTMLDivElement>);
            if (enableFormatting) {
              formatting.checkSelection();
            }
          }}
          onMouseUp={(e) => {
            handleSelectChange(e as unknown as React.SyntheticEvent<HTMLDivElement>);
            if (enableFormatting) {
              formatting.checkSelection();
            }
          }}
          onSelect={(e) => {
            if (enableFormatting) {
              formatting.checkSelection();
            }
          }}
          onFocus={() => {
            if (enableFormatting) {
              formatting.setIsFocused(true);
            }
          }}
          onBlur={(e) => {
            handleBlur();
            if (enableFormatting) {
              setTimeout(() => formatting.setIsFocused(false), 250);
            }
          }}
          className={cn(
            "w-full bg-background border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] break-words whitespace-pre-wrap outline-none",
            className
          )}
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
