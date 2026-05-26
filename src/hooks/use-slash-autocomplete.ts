'use client';

import * as React from 'react';
import type { TemplateVariable } from '@/lib/types';

interface UseSlashAutocompleteProps {
  variables: TemplateVariable[];
  value: string;
  onChange: (val: string) => void;
  registerInsertCallback?: (cb: ((key: string) => void) | null) => void;
}

export function useSlashAutocomplete({
  variables,
  value,
  onChange,
  registerInsertCallback,
}: UseSlashAutocompleteProps) {
  const [showAutocomplete, setShowAutocomplete] = React.useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = React.useState('');
  const [autocompleteIndex, setAutocompleteIndex] = React.useState(0);
  const [autocompleteCoords, setAutocompleteCoords] = React.useState({ top: 0, left: 0 });

  // Get caret coordinates relative to parent container
  const getCaretCoordinates = React.useCallback((element: HTMLTextAreaElement, position: number) => {
    const div = document.createElement('div');
    const style = window.getComputedStyle(element);
    
    const properties = [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch',
      'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing', 'textRendering',
      'width', 'height', 'boxSizing', 'wordBreak', 'wordWrap', 'whiteSpace',
      'overflowY', 'overflowX'
    ];
    
    properties.forEach((p) => {
      div.style[p as any] = style[p as any];
    });
    
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.top = element.offsetTop + 'px';
    div.style.left = element.offsetLeft + 'px';
    
    div.textContent = element.value.substring(0, position);
    
    const span = document.createElement('span');
    span.textContent = element.value.substring(position, position + 1) || '.';
    div.appendChild(span);
    
    const parent = element.parentElement || document.body;
    parent.appendChild(div);
    
    try {
      const spanRect = span.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      
      return {
        top: spanRect.top - parentRect.top + parent.scrollTop - element.scrollTop + 18, // 18px line-height offset, correcting for textarea scroll
        left: spanRect.left - parentRect.left + parent.scrollLeft - element.scrollLeft,
      };
    } finally {
      parent.removeChild(div);
    }
  }, []);

  const checkTrigger = React.useCallback((element: HTMLTextAreaElement) => {
    const text = element.value;
    const selectionEnd = element.selectionEnd;
    
    const lastSlashIdx = text.lastIndexOf('/', selectionEnd - 1);
    if (lastSlashIdx === -1) {
      setShowAutocomplete(false);
      return;
    }
    
    const textBetween = text.substring(lastSlashIdx + 1, selectionEnd);
    if (/\s/.test(textBetween) || textBetween.includes('\n')) {
      setShowAutocomplete(false);
      return;
    }
    
    if (lastSlashIdx > 0 && !/\s/.test(text.charAt(lastSlashIdx - 1))) {
      setShowAutocomplete(false);
      return;
    }
    
    setAutocompleteQuery(textBetween);
    setAutocompleteIndex(0);
    setShowAutocomplete(true);
    
    const coords = getCaretCoordinates(element, lastSlashIdx);
    setAutocompleteCoords(coords);
  }, [getCaretCoordinates]);

  // Filter variables matching typed query
  const filteredVars = React.useMemo(() => {
    const query = autocompleteQuery.toLowerCase();
    if (!query) return variables;
    return variables.filter(
      v => v.name.toLowerCase().includes(query) || v.label.toLowerCase().includes(query)
    );
  }, [variables, autocompleteQuery]);

  const selectAndInsert = React.useCallback((varName: string, element: HTMLTextAreaElement) => {
    const text = element.value;
    const selectionEnd = element.selectionEnd;
    const lastSlashIdx = text.lastIndexOf('/', selectionEnd - 1);
    
    const before = text.substring(0, lastSlashIdx);
    const after = text.substring(selectionEnd);
    const token = `{{${varName}}}`;
    const newValue = before + token + after;
    
    setShowAutocomplete(false);
    onChange(newValue);
    
    requestAnimationFrame(() => {
      element.focus();
      const newPos = lastSlashIdx + token.length;
      element.setSelectionRange(newPos, newPos);
    });
  }, [onChange]);

  // General keyboard listener for intercepting inputs when autocomplete is active
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showAutocomplete || filteredVars.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAutocompleteIndex(prev => (prev + 1) % filteredVars.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAutocompleteIndex(prev => (prev - 1 + filteredVars.length) % filteredVars.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedVar = filteredVars[autocompleteIndex];
      if (selectedVar) {
        selectAndInsert(selectedVar.name, e.currentTarget);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowAutocomplete(false);
    }
  }, [showAutocomplete, filteredVars, autocompleteIndex, selectAndInsert]);

  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    checkTrigger(e.target);
  }, [checkTrigger]);

  const handleSelectChange = React.useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    checkTrigger(e.currentTarget);
  }, [checkTrigger]);

  return {
    showAutocomplete,
    autocompleteCoords,
    autocompleteIndex,
    filteredVars,
    handleKeyDown,
    handleInputChange,
    handleSelectChange,
    selectAndInsert,
    setShowAutocomplete,
  };
}
