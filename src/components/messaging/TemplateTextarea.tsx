'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { parseTemplateText } from '@/hooks/use-template-editor';

interface TemplateTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onSelectionChange?: () => void;
  /**
   * Whether to show variable highlighting overlay
   * @default true
   */
  showHighlighting?: boolean;
}

/**
 * TemplateTextarea Component
 * 
 * A textarea with visual highlighting of {{variable}} tokens.
 * Uses an overlay technique to show highlighted variables while
 * maintaining native textarea editing behavior.
 * 
 * Task 10.4: Highlight all {{variable}} tokens in the template body editor
 * Task 10.5: Show tooltip on hover of a variable token
 */
export const TemplateTextarea = React.forwardRef<HTMLTextAreaElement, TemplateTextareaProps>(
  (
    {
      value,
      onChange,
      onSelectionChange,
      showHighlighting = true,
      className,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const highlightRef = React.useRef<HTMLDivElement>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Combine refs
    React.useImperativeHandle(ref, () => textareaRef.current!);

    // Sync scroll position between textarea and highlight overlay
    const handleScroll = React.useCallback(() => {
      if (textareaRef.current && highlightRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    };

    const handleSelect = () => {
      onSelectionChange?.();
    };

    const segments = React.useMemo(() => parseTemplateText(value), [value]);

    return (
      <div className="relative">
        {/* Highlight overlay */}
        {showHighlighting && (
          <div
            ref={highlightRef}
            className={cn(
              'pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words',
              'rounded-md border border-transparent px-3 py-2 font-mono text-sm leading-relaxed',
              'text-transparent'
            )}
            style={{
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
            aria-hidden="true"
          >
            {segments.map((segment, index) => (
              <span
                key={index}
                className={cn(
                  segment.isVariable &&
                    'rounded bg-blue-100 px-1 font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                )}
                title={
                  segment.isVariable
                    ? `Variable: ${segment.variableName}\nClick "Insert Variable" to see available variables`
                    : undefined
                }
              >
                {segment.text}
              </span>
            ))}
          </div>
        )}

        {/* Actual textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onSelect={handleSelect}
          onScroll={handleScroll}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            'relative z-10 flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2',
            'font-mono text-sm leading-relaxed ring-offset-background',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            showHighlighting && 'caret-primary',
            className
          )}
          style={{
            resize: 'vertical',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
          }}
          {...props}
        />

        {/* Variable count indicator */}
        {showHighlighting && segments.filter((s) => s.isVariable).length > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">
            {segments.filter((s) => s.isVariable).length} variable
            {segments.filter((s) => s.isVariable).length !== 1 ? 's' : ''} detected
          </div>
        )}
      </div>
    );
  }
);

TemplateTextarea.displayName = 'TemplateTextarea';
