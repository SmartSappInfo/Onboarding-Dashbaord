'use client';

import * as React from 'react';

/**
 * Hook for managing template editor state and variable insertion
 * 
 * Provides utilities for:
 * - Inserting variables at cursor position
 * - Tracking cursor position in textarea
 * - Highlighting variable tokens in the editor
 * 
 * Task 10.3: Insert {{variable_name}} at cursor position
 */
export function useTemplateEditor(initialValue = '') {
  const [value, setValue] = React.useState(initialValue);
  const [cursorPosition, setCursorPosition] = React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Update cursor position when selection changes
  const handleSelectionChange = React.useCallback(() => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  }, []);

  // Insert variable at current cursor position
  const insertVariable = React.useCallback(
    (variableName: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const textBefore = value.substring(0, start);
      const textAfter = value.substring(end);
      const variableToken = `{{${variableName}}}`;

      const newValue = textBefore + variableToken + textAfter;
      setValue(newValue);

      // Set cursor position after the inserted variable
      const newCursorPos = start + variableToken.length;
      
      // Use setTimeout to ensure the value is updated before setting cursor
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        setCursorPosition(newCursorPos);
      }, 0);
    },
    [value]
  );

  // Extract all variable tokens from the text
  const extractVariables = React.useCallback((text: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }

    return matches;
  }, []);

  // Get all variables currently in the template
  const variables = React.useMemo(() => extractVariables(value), [value, extractVariables]);

  return {
    value,
    setValue,
    cursorPosition,
    textareaRef,
    insertVariable,
    handleSelectionChange,
    variables,
  };
}

/**
 * Utility function to highlight variable tokens in text
 * Returns an array of text segments with metadata for rendering
 * 
 * Task 10.4: Highlight all {{variable}} tokens with distinct style
 */
export interface TextSegment {
  text: string;
  isVariable: boolean;
  variableName?: string;
}

export function parseTemplateText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the variable
    if (match.index > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, match.index),
        isVariable: false,
      });
    }

    // Add the variable token
    segments.push({
      text: match[0],
      isVariable: true,
      variableName: match[1],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last variable
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      isVariable: false,
    });
  }

  return segments;
}
