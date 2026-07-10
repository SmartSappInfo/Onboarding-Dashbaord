'use client';

import React, { useEffect, useRef, useState, useContext, useMemo } from 'react';
import { sanitizeHtml } from '@/lib/page-builder/sanitize';
import { WorkspaceContext } from './WorkspaceContext';
import { getVariablesAction } from '@/lib/services/fields-variables-service';
import type { UnifiedVariable } from '@/lib/types/variables';
import { cn } from '@/lib/utils';

interface InlineEditableProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  readonly value: string;
  readonly onChange?: (val: string) => void;
  readonly isEdit: boolean;
  readonly tagName?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'a' | 'blockquote' | 'figcaption';
  readonly html?: boolean;
  readonly placeholder?: string;
}

export const InlineEditable: React.FC<InlineEditableProps> = ({
  value,
  onChange,
  isEdit,
  tagName = 'span',
  html = false,
  className,
  placeholder,
  ...props
}) => {
  const elementRef = useRef<HTMLElement>(null);
  const lastValueRef = useRef<string>(value);
  const [hasMounted, setHasMounted] = useState(false);

  // Slash commands inline popover states
  const [showMenu, setShowMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuIndex, setMenuIndex] = useState(0);
  const [variables, setVariables] = useState<UnifiedVariable[]>([]);
  const { workspaceId } = useContext(WorkspaceContext);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Sync variables dynamically for search dropdown when in edit mode
  useEffect(() => {
    if (!workspaceId || !isEdit) return;
    getVariablesAction({ workspaceId, featureContext: 'all' })
      .then(setVariables)
      .catch((err) => console.warn('[InlineEditable] Failed to fetch variables:', err));
  }, [workspaceId, isEdit]);

  // Sync value from parent prop
  useEffect(() => {
    if (!hasMounted || !elementRef.current) return;
    
    // If the element is currently focused, do not overwrite the user's active typing
    if (document.activeElement === elementRef.current) {
      return;
    }

    const targetVal = value || '';
    const currentVal = html ? elementRef.current.innerHTML : elementRef.current.textContent || '';
    
    if (currentVal !== targetVal) {
      if (html) {
        elementRef.current.innerHTML = targetVal;
      } else {
        elementRef.current.textContent = targetVal;
      }
    }
    lastValueRef.current = targetVal;
  }, [value, html, hasMounted]);

  // Filter dropdown variables list
  const filteredVars = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return variables.slice(0, 10);
    return variables
      .filter((v) => v.key.toLowerCase().includes(query) || v.label.toLowerCase().includes(query))
      .slice(0, 10);
  }, [variables, searchQuery]);

  // Reset selected list index on filter query update
  useEffect(() => {
    setMenuIndex(0);
  }, [filteredVars]);

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    const currentValue = html ? e.currentTarget.innerHTML : e.currentTarget.textContent || '';
    lastValueRef.current = currentValue;
    if (onChange) {
      onChange(currentValue);
    }
  };

  const handleInput = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setShowMenu(false);
      return;
    }
    
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType === Node.TEXT_NODE) {
      const textVal = textNode.nodeValue || '';
      const offset = range.startOffset;
      const textBeforeCursor = textVal.substring(0, offset);
      const slashIdx = textBeforeCursor.lastIndexOf('/');
      
      if (slashIdx !== -1) {
        const query = textBeforeCursor.substring(slashIdx + 1);
        if (!query.includes(' ')) {
          setShowMenu(true);
          setSearchQuery(query);
          return;
        }
      }
    }
    setShowMenu(false);
  };

  const insertVariable = (varKey: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !elementRef.current) return;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    const replacement = `{{${varKey}}}`;
    
    if (textNode.nodeType === Node.TEXT_NODE) {
      const text = textNode.nodeValue || '';
      const offset = range.startOffset;
      const textBeforeCursor = text.substring(0, offset);
      const slashIdx = textBeforeCursor.lastIndexOf('/');
      
      if (slashIdx !== -1) {
        const before = text.substring(0, slashIdx);
        const after = text.substring(offset);
        textNode.nodeValue = before + replacement + after;
        
        // Move selection cursor to end of replacement
        const newRange = document.createRange();
        newRange.setStart(textNode, slashIdx + replacement.length);
        newRange.setEnd(textNode, slashIdx + replacement.length);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else {
      const currentValue = html ? elementRef.current.innerHTML : elementRef.current.textContent || '';
      const slashIdx = currentValue.lastIndexOf('/');
      if (slashIdx !== -1) {
        const newValue = currentValue.substring(0, slashIdx) + replacement;
        if (html) {
          elementRef.current.innerHTML = newValue;
        } else {
          elementRef.current.textContent = newValue;
        }
      }
    }

    const finalValue = html ? elementRef.current.innerHTML : elementRef.current.textContent || '';
    lastValueRef.current = finalValue;
    if (onChange) {
      onChange(finalValue);
    }
    setShowMenu(false);
    elementRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (showMenu && filteredVars.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMenuIndex((prev) => (prev + 1) % filteredVars.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuIndex((prev) => (prev - 1 + filteredVars.length) % filteredVars.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredVars[menuIndex];
        if (selected) {
          insertVariable(selected.key);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMenu(false);
        return;
      }
    }

    if (!html && e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const Tag = tagName as any;

  if (!isEdit) {
    if (html) {
      return (
        <Tag
          className={className}
          dangerouslySetInnerHTML={{ __html: value }}
          {...props}
        />
      );
    }
    return (
      <Tag className={className} {...props}>
        {value || placeholder}
      </Tag>
    );
  }

  return (
    <div className="relative inline-block w-full">
      <Tag
        ref={elementRef}
        contentEditable={true}
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        className={cn(className, "outline-none")}
        placeholder={placeholder}
        dangerouslySetInnerHTML={
          !hasMounted
            ? { __html: html ? sanitizeHtml(value || '') : (value || '') }
            : undefined
        }
        {...props}
      />
      {showMenu && filteredVars.length > 0 && (
        <div 
          className="absolute left-0 z-[9999] mt-1 max-h-40 w-64 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-1 shadow-2xl custom-scrollbar text-[11px] text-left"
          onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
        >
          {filteredVars.map((v, idx) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              onMouseEnter={() => setMenuIndex(idx)}
              className={cn(
                "w-full text-left px-2.5 py-2 rounded flex flex-col gap-0.5 transition-colors cursor-pointer select-none outline-none border border-transparent",
                idx === menuIndex 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : "text-slate-300 hover:text-slate-100"
              )}
            >
              <span className="font-semibold">{v.label}</span>
              <code className="text-[9px] text-slate-500 font-mono">{`{{${v.key}}}`}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
