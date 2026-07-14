'use client';

import React, { useEffect, useRef, useState, useContext, useMemo } from 'react';
import { sanitizeHtml } from '@/lib/page-builder/sanitize';
import { WorkspaceContext } from './WorkspaceContext';
import { getVariablesAction } from '@/lib/services/fields-variables-service';
import type { UnifiedVariable } from '@/lib/types/variables';
import { cn } from '@/lib/utils';
import { FallbackEditorModal } from '@/components/shared/FallbackEditorModal';

interface InlineEditableProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  readonly value: string;
  readonly onChange?: (val: string) => void;
  readonly isEdit: boolean;
  readonly tagName?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'a' | 'blockquote' | 'figcaption';
  readonly html?: boolean;
  readonly placeholder?: string;
}

export function convertToVisualHtml(text: string): string {
  if (!text) return '';
  return text.replace(/\{\{(.*?)\}\}/g, (match, rawKey) => {
    const parts = rawKey.split(/\|\||\|/);
    const varName = parts[0].trim();
    const fallback = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
    const fallbackText = fallback ? ` (${fallback})` : '';

    return `<span contenteditable="false" data-variable="${varName}" data-fallback="${fallback}" class="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[90%] font-bold border border-emerald-500/20 align-baseline select-none hover:bg-emerald-500/20 transition-all">
      <span>${varName}${fallbackText}</span>
      <button type="button" data-variable-settings="${varName}" class="hover:bg-emerald-500/30 p-0.5 rounded transition-all inline-flex items-center justify-center ml-1 text-[9px] cursor-pointer border-0 bg-transparent text-emerald-300 select-none" title="Configure fallback">⚙️</button>
    </span>`;
  });
}

export function convertToCleanHtml(element: HTMLElement, htmlMode = false): string {
  const clone = element.cloneNode(true) as HTMLElement;
  const pills = clone.querySelectorAll('[data-variable]');
  pills.forEach((pill) => {
    const varName = pill.getAttribute('data-variable');
    const fallback = pill.getAttribute('data-fallback') || '';
    const token = fallback ? `{{${varName} | ${fallback}}}` : `{{${varName}}}`;
    const textNode = clone.ownerDocument.createTextNode(token);
    pill.parentNode?.replaceChild(textNode, pill);
  });
  return htmlMode ? clone.innerHTML : (clone.textContent || '');
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
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [menuIndex, setMenuIndex] = useState(0);
  const [variables, setVariables] = useState<UnifiedVariable[]>([]);
  const { workspaceId, organizationId } = useContext(WorkspaceContext);

  // Fallback settings modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVarKey, setEditingVarKey] = useState('');
  const [editingVarCurrentFallback, setEditingVarCurrentFallback] = useState('');
  const [activePillElement, setActivePillElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Sync variables dynamically for search dropdown when in edit mode
  useEffect(() => {
    if (!workspaceId || !isEdit) return;
    getVariablesAction({ workspaceId, organizationId, featureContext: 'all' })
      .then(setVariables)
      .catch((err) => console.warn('[InlineEditable] Failed to fetch variables:', err));
  }, [workspaceId, organizationId, isEdit]);

  // Sync value from parent prop
  useEffect(() => {
    if (!hasMounted || !elementRef.current) return;
    
    // If the element is currently focused, do not overwrite the user's active typing
    if (document.activeElement === elementRef.current) {
      return;
    }

    const targetVal = value || '';
    const cleanCurrent = convertToCleanHtml(elementRef.current, html);
    
    if (cleanCurrent !== targetVal) {
      elementRef.current.innerHTML = convertToVisualHtml(targetVal);
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
    const cleanCurrent = convertToCleanHtml(e.currentTarget, html);
    lastValueRef.current = cleanCurrent;
    if (onChange) {
      onChange(cleanCurrent);
    }
  };

  const handleInput = () => {
    if (elementRef.current) {
      const cleanCurrent = convertToCleanHtml(elementRef.current, html);
      lastValueRef.current = cleanCurrent;
      if (onChange) {
        onChange(cleanCurrent);
      }
    }

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
          try {
            const rangeClone = range.cloneRange();
            rangeClone.setStart(textNode, slashIdx);
            rangeClone.setEnd(textNode, Math.min(slashIdx + 1, textVal.length));
            const rect = rangeClone.getBoundingClientRect();
            
            if (elementRef.current) {
              const parentRect = elementRef.current.parentElement?.getBoundingClientRect();
              if (parentRect) {
                setMenuCoords({
                  top: rect.bottom - parentRect.top,
                  left: rect.left - parentRect.left,
                });
              }
            }
          } catch (e) {
            setMenuCoords({ top: 24, left: 0 });
          }
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
    
    if (textNode.nodeType === Node.TEXT_NODE) {
      const text = textNode.nodeValue || '';
      const offset = range.startOffset;
      const textBeforeCursor = text.substring(0, offset);
      const slashIdx = textBeforeCursor.lastIndexOf('/');
      
      if (slashIdx !== -1) {
        range.setStart(textNode, slashIdx);
        range.setEnd(textNode, offset);
        range.deleteContents();
        
        const pill = document.createElement('span');
        pill.contentEditable = 'false';
        pill.className = 'inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[90%] font-bold border border-emerald-500/20 align-baseline select-none hover:bg-emerald-500/20 transition-all';
        pill.setAttribute('data-variable', varKey);
        
        const labelSpan = document.createElement('span');
        labelSpan.textContent = varKey;
        pill.appendChild(labelSpan);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-variable-settings', varKey);
        btn.className = 'hover:bg-emerald-500/30 p-0.5 rounded transition-all inline-flex items-center justify-center ml-1 text-[9px] cursor-pointer border-0 bg-transparent text-emerald-300 select-none';
        btn.title = 'Configure fallback';
        btn.textContent = '⚙️';
        pill.appendChild(btn);
        
        range.insertNode(pill);
        
        const newRange = document.createRange();
        newRange.setStartAfter(pill);
        newRange.setEndAfter(pill);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else {
      const currentValue = convertToCleanHtml(elementRef.current, html);
      const slashIdx = currentValue.lastIndexOf('/');
      if (slashIdx !== -1) {
        const newValue = currentValue.substring(0, slashIdx) + `{{${varKey}}}`;
        elementRef.current.innerHTML = convertToVisualHtml(newValue);
      }
    }

    const finalValue = convertToCleanHtml(elementRef.current, html);
    lastValueRef.current = finalValue;
    if (onChange) {
      onChange(finalValue);
    }
    setShowMenu(false);
    elementRef.current.focus();
  };

  const handleSaveFallback = (fallbackVal: string) => {
    if (!activePillElement) return;
    const cleanFallback = fallbackVal.trim();
    activePillElement.setAttribute('data-fallback', cleanFallback);
    
    const labelSpan = activePillElement.querySelector('span');
    const varName = activePillElement.getAttribute('data-variable') || '';
    if (labelSpan) {
      labelSpan.textContent = cleanFallback ? `${varName} (${cleanFallback})` : varName;
    }
    
    if (elementRef.current) {
      const cleanCurrent = convertToCleanHtml(elementRef.current, html);
      lastValueRef.current = cleanCurrent;
      if (onChange) {
        onChange(cleanCurrent);
      }
    }
    
    setModalOpen(false);
    setActivePillElement(null);
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

  const Tag = tagName as React.ElementType;

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
        onClick={(e: React.MouseEvent<HTMLElement>) => {
          const target = e.target as HTMLElement;
          const settingsBtn = target.closest('[data-variable-settings]');
          if (settingsBtn) {
            e.preventDefault();
            e.stopPropagation();
            const pill = settingsBtn.closest('[data-variable]');
            if (pill) {
              const varName = pill.getAttribute('data-variable') || '';
              const fallback = pill.getAttribute('data-fallback') || '';
              setEditingVarKey(varName);
              setEditingVarCurrentFallback(fallback);
              setActivePillElement(pill as HTMLElement);
              setModalOpen(true);
            }
          }
        }}
        className={cn(className, "outline-none")}
        placeholder={placeholder}
        dangerouslySetInnerHTML={
          !hasMounted
            ? { __html: convertToVisualHtml(value || '') }
            : undefined
        }
        {...props}
      />
      {showMenu && filteredVars.length > 0 && (
        <div 
          className="absolute left-0 z-[9999] mt-1 max-h-40 w-64 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-1 shadow-2xl custom-scrollbar text-[11px] text-left"
          style={{ top: `${menuCoords.top}px`, left: `${menuCoords.left}px` }}
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

      <FallbackEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        variableKey={editingVarKey}
        currentFallback={editingVarCurrentFallback}
        onSave={handleSaveFallback}
      />
    </div>
  );
};
