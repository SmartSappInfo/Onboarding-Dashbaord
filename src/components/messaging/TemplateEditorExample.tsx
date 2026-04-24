'use client';

import * as React from 'react';
import { VariablePicker } from './VariablePicker';
import { TemplateTextarea } from './TemplateTextarea';
import { useTemplateEditor } from '@/hooks/use-template-editor';
import { getVariablesForContext } from '@/lib/template-variable-utils';
import type { VariableContext } from '@/lib/types';
import { Label } from '@/components/ui/label';

interface TemplateEditorExampleProps {
  /**
   * Variable context to determine which variables to show
   */
  context: VariableContext;
  /**
   * Initial template value
   */
  initialValue?: string;
  /**
   * Callback when template value changes
   */
  onChange?: (value: string) => void;
  /**
   * Label for the editor
   */
  label?: string;
  /**
   * Placeholder text
   */
  placeholder?: string;
}

/**
 * TemplateEditorExample Component
 * 
 * Example integration showing how to use VariablePicker with TemplateTextarea.
 * This demonstrates the complete workflow for Task 10:
 * 
 * - Variable picker dropdown with search (Task 10.1, 10.2)
 * - Insert variables at cursor position (Task 10.3)
 * - Highlight variable tokens (Task 10.4)
 * - Show tooltips on hover (Task 10.5)
 * 
 * Usage:
 * ```tsx
 * <TemplateEditorExample
 *   context="meeting"
 *   initialValue="Hello {{contact_name}}"
 *   onChange={(value) => console.log(value)}
 * />
 * ```
 */
export function TemplateEditorExample({
  context,
  initialValue = '',
  onChange,
  label = 'Template Body',
  placeholder = 'Enter your template content here. Use the "Insert Variable" button to add dynamic variables.',
}: TemplateEditorExampleProps) {
  const { value, setValue, textareaRef, insertVariable, handleSelectionChange } =
    useTemplateEditor(initialValue);

  // Get available variables for the context
  const variables = React.useMemo(() => getVariablesForContext(context), [context]);

  // Notify parent of changes
  React.useEffect(() => {
    onChange?.(value);
  }, [value, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="template-body">{label}</Label>
        <VariablePicker
          variables={variables}
          onVariableSelect={insertVariable}
          triggerLabel="Insert Variable"
        />
      </div>

      <TemplateTextarea
        id="template-body"
        ref={textareaRef}
        value={value}
        onChange={setValue}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        rows={8}
      />

      <div className="text-xs text-muted-foreground">
        Tip: Click "Insert Variable" to add dynamic content to your template. Variables will be
        replaced with actual values when the message is sent.
      </div>
    </div>
  );
}
