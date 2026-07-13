'use client';

import * as React from 'react';
import type { TemplateVariable } from '@/lib/types';

export function convertToCleanHtml(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  const pills = clone.querySelectorAll('[data-variable]');
  pills.forEach((pill) => {
    const varName = pill.getAttribute('data-variable');
    const textNode = clone.ownerDocument.createTextNode(`{{${varName}}}`);
    pill.parentNode?.replaceChild(textNode, pill);
  });
  return clone.innerHTML;
}

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
  const getCaretCoordinates = React.useCallback((element: HTMLTextAreaElement | HTMLInputElement | HTMLDivElement, position: number) => {
    if (element instanceof HTMLDivElement) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const parentRect = element.parentElement?.getBoundingClientRect();
        if (parentRect) {
          return {
            top: rect.bottom - parentRect.top + (element.parentElement?.scrollTop || 0) + 4,
            left: rect.left - parentRect.left + (element.parentElement?.scrollLeft || 0),
          };
        }
      }
      return { top: 0, left: 0 };
    }

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
        top: spanRect.top - parentRect.top + parent.scrollTop - element.scrollTop + 18, // 18px line-height offset, correcting for scroll
        left: spanRect.left - parentRect.left + parent.scrollLeft - element.scrollLeft,
      };
    } finally {
      parent.removeChild(div);
    }
  }, []);

  const checkTrigger = React.useCallback((element: HTMLTextAreaElement | HTMLInputElement | HTMLDivElement) => {
    if (element instanceof HTMLDivElement) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setShowAutocomplete(false);
        return;
      }
      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      if (container.nodeType !== Node.TEXT_NODE) {
        setShowAutocomplete(false);
        return;
      }
      const text = container.textContent || '';
      const offset = range.startOffset;
      const lastSlashIdx = text.lastIndexOf('/', offset - 1);
      if (lastSlashIdx === -1) {
        setShowAutocomplete(false);
        return;
      }
      const textBetween = text.substring(lastSlashIdx + 1, offset);
      if (/\s/.test(textBetween) || textBetween.includes('\n')) {
        setShowAutocomplete(false);
        return;
      }
      if (lastSlashIdx > 0 && !/\s/.test(text.charAt(lastSlashIdx - 1))) {
        setShowAutocomplete(false);
        return;
      }
      if (!showAutocomplete || textBetween !== autocompleteQuery) {
        setAutocompleteQuery(textBetween);
        setAutocompleteIndex(0);
      }
      setShowAutocomplete(true);
      
      const coords = getCaretCoordinates(element, lastSlashIdx);
      setAutocompleteCoords(coords);
      return;
    }

    const text = element.value;
    const selectionEnd = element.selectionEnd;
    
    if (selectionEnd === null) {
      setShowAutocomplete(false);
      return;
    }
    
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
    
    if (!showAutocomplete || textBetween !== autocompleteQuery) {
      setAutocompleteQuery(textBetween);
      setAutocompleteIndex(0);
    }
    setShowAutocomplete(true);
    
    const coords = getCaretCoordinates(element, lastSlashIdx);
    setAutocompleteCoords(coords);
  }, [getCaretCoordinates, showAutocomplete, autocompleteQuery]);

  // Filter variables matching typed query
  const filteredVars = React.useMemo(() => {
    const query = autocompleteQuery.toLowerCase();
    if (!query) return variables;
    return variables.filter(
      v => v.name.toLowerCase().includes(query) || v.label.toLowerCase().includes(query)
    );
  }, [variables, autocompleteQuery]);

  const selectAndInsert = React.useCallback((varName: string, element: HTMLTextAreaElement | HTMLInputElement | HTMLDivElement) => {
    if (element instanceof HTMLDivElement) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      if (container.nodeType !== Node.TEXT_NODE) return;
      
      const text = container.textContent || '';
      const offset = range.startOffset;
      const lastSlashIdx = text.lastIndexOf('/', offset - 1);
      if (lastSlashIdx === -1) return;
      
      range.setStart(container, lastSlashIdx);
      range.setEnd(container, offset);
      range.deleteContents();
      
      const pill = document.createElement('span');
      pill.contentEditable = 'false';
      pill.className = 'inline-flex items-center mx-0.5 px-2 py-0.5 rounded bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono text-[90%] font-bold border border-blue-200/50 align-baseline select-none';
      pill.setAttribute('data-variable', varName);
      pill.textContent = varName;
      
      range.insertNode(pill);
      
      const newRange = document.createRange();
      newRange.setStartAfter(pill);
      newRange.setEndAfter(pill);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      setShowAutocomplete(false);
      onChange(convertToCleanHtml(element));
      return;
    }

    const text = element.value;
    const selectionEnd = element.selectionEnd;
    if (selectionEnd === null) return;
    
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
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement | HTMLDivElement>) => {
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

  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement | HTMLDivElement>) => {
    checkTrigger(e.target);
  }, [checkTrigger]);

  const handleSelectChange = React.useCallback((e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement | HTMLDivElement>) => {
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
