'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/* ── Types ──────────────────────────────────────────────────────────────────── */
export interface VariableGroup {
  group: string;
  items: string[];
}

export interface LegacyScriptEditorHandle {
  insertVariable: (varName: string) => void;
  focus: () => void;
}

interface LegacyScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Optional dynamic variable groups. Falls back to a minimal hardcoded set. */
  variableGroups?: VariableGroup[];
  placeholder?: string;
  className?: string;
  /** Override the minimum height of the inner editable area (default: '420px'). */
  minHeight?: string;
}

/* ── Fallback variable catalogue (used when no groups are passed) ──────────── */
const FALLBACK_VARIABLE_GROUPS: VariableGroup[] = [
  {
    group: 'Entity Fields',
    items: ['ENTITY_NAME', 'ENTITY_EMAIL', 'ENTITY_PHONE', 'ENTITY_TYPE', 'PRIMARY_CONTACT_NAME', 'PRIMARY_CONTACT_PHONE', 'AGENT_NAME'],
  },
  {
    group: 'Deal Fields',
    items: ['DEAL_NAME', 'DEAL_VALUE', 'DEAL_STAGE', 'DEAL_STATUS', 'DEAL_EXPECTED_CLOSE'],
  },
];

/* ── Inline style constants for pills (needed for dynamically-created DOM) ─ */
const PILL_STYLE = [
  'display:inline-flex', 'align-items:center', 'gap:3px',
  'padding:2px 8px 2px 8px', 'margin:0 2px', 'border-radius:6px',
  'font-size:11px', 'font-family:ui-monospace,monospace', 'font-weight:700',
  'vertical-align:baseline', 'user-select:none', 'line-height:1.6',
  'white-space:nowrap',
  'background:hsl(var(--primary)/0.12)',
  'border:1px solid hsl(var(--primary)/0.25)',
  'color:hsl(var(--primary))',
].join(';');

const DELETE_STYLE = [
  'cursor:pointer', 'margin-left:2px', 'font-size:10px',
  'opacity:0.45', 'line-height:1', 'border:none',
  'background:none', 'padding:0', 'color:inherit',
  'transition:opacity 0.15s,color 0.15s',
].join(';');

/* ── Helpers ────────────────────────────────────────────────────────────────── */

/** Recursively extract plain text from a DOM tree, converting pills back to {{VAR}}. */
function extractTextFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  if (el.dataset.variable) return `{{${el.dataset.variable}}}`;
  if (el.tagName === 'BR') return '\n';

  let text = '';
  // Chrome wraps new lines in <div> elements inside contenteditable
  if ((el.tagName === 'DIV' || el.tagName === 'P') && el !== el.closest('[contenteditable]')) {
    text += '\n';
  }
  for (const child of Array.from(el.childNodes)) text += extractTextFromNode(child);
  return text;
}

/** Build pill HTML string for innerHTML rendering. */
function pillHtml(varName: string): string {
  return `<span contenteditable="false" data-variable="${varName}" style="${PILL_STYLE}">${varName}<span data-delete-var="${varName}" style="${DELETE_STYLE}">✕</span></span>`;
}

/** Convert plain text with {{VAR}} to HTML with inline pills. */
function textToHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, v) => pillHtml(v))
    .replace(/\n/g, '<br>');
}

/** Create a pill DOM element for programmatic insertion. */
function createPillElement(varName: string): HTMLSpanElement {
  const pill = document.createElement('span');
  pill.contentEditable = 'false';
  pill.dataset.variable = varName;
  pill.style.cssText = PILL_STYLE;

  const nameNode = document.createTextNode(varName);
  pill.appendChild(nameNode);

  const del = document.createElement('span');
  del.dataset.deleteVar = varName;
  del.style.cssText = DELETE_STYLE;
  del.textContent = '✕';
  del.addEventListener('mouseover', () => { del.style.opacity = '1'; del.style.color = 'hsl(0 72% 55%)'; });
  del.addEventListener('mouseout', () => { del.style.opacity = '0.45'; del.style.color = 'inherit'; });
  pill.appendChild(del);

  return pill;
}

/* ── Component ──────────────────────────────────────────────────────────────── */
export const LegacyScriptEditor = React.forwardRef<LegacyScriptEditorHandle, LegacyScriptEditorProps>(
  function LegacyScriptEditor({ value, onChange, variableGroups, placeholder = 'Start typing your script here…', className, minHeight = '420px' }, ref) {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const [showMenu, setShowMenu] = React.useState(false);
    const [filter, setFilter] = React.useState('');
    const [menuPos, setMenuPos] = React.useState({ top: 0, left: 0 });
    const [selIdx, setSelIdx] = React.useState(0);
    const [isEmpty, setIsEmpty] = React.useState(!value);
    const isInternal = React.useRef(false);
    const lastRangeRef = React.useRef<Range | null>(null);

    /* Use passed-in groups or fall back to the hardcoded catalogue */
    const activeGroups = variableGroups && variableGroups.length > 0 ? variableGroups : FALLBACK_VARIABLE_GROUPS;

    const saveSelection = React.useCallback(() => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (editorRef.current && editorRef.current.contains(range.startContainer)) {
          lastRangeRef.current = range.cloneRange();
        }
      }
    }, []);

    /* Filtered slash-command items */
    const filteredGroups = React.useMemo(() => {
      const q = filter.toLowerCase();
      if (!q) return activeGroups;
      return activeGroups
        .map(g => ({ ...g, items: g.items.filter(i => i.toLowerCase().includes(q) || g.group.toLowerCase().includes(q)) }))
        .filter(g => g.items.length > 0);
    }, [filter, activeGroups]);

    const flatItems = React.useMemo(() => filteredGroups.flatMap(g => g.items), [filteredGroups]);

    /* ── Extract plain text from editor DOM ─── */
    const extractText = React.useCallback(() => {
      if (!editorRef.current) return '';
      let t = '';
      for (const child of Array.from(editorRef.current.childNodes)) t += extractTextFromNode(child);
      return t.replace(/^\n/, '');
    }, []);

    /* ── Sync external value → editor HTML ─── */
    React.useEffect(() => {
      if (isInternal.current) { isInternal.current = false; return; }
      if (editorRef.current) {
        editorRef.current.innerHTML = textToHtml(value);
        setIsEmpty(!value);
      }
    }, [value]);

    /* ── Notify parent of content change ─── */
    const syncAndNotify = React.useCallback(() => {
      isInternal.current = true;
      const t = extractText();
      setIsEmpty(!t);
      onChange(t);
    }, [extractText, onChange]);

    /* ── Insert a variable pill at cursor ─── */
    const insertVariable = React.useCallback((varName: string) => {
      if (!editorRef.current) return;
      editorRef.current.focus();

      const sel = window.getSelection();
      if (!sel) return;

      // Restore last range if it exists
      if (lastRangeRef.current) {
        sel.removeAllRanges();
        sel.addRange(lastRangeRef.current);
      }

      // If still no range or range is outside editor, put caret at the end of the text
      let range: Range;
      if (sel.rangeCount > 0 && editorRef.current.contains(sel.getRangeAt(0).startContainer)) {
        range = sel.getRangeAt(0);
      } else {
        range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      /* If slash menu is open, remove the "/" and any filter text first */
      if (showMenu) {
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          const offset = range.startOffset;
          const before = text.substring(0, offset);
          const slashIdx = before.lastIndexOf('/');
          if (slashIdx >= 0) {
            const delRange = document.createRange();
            delRange.setStart(node, slashIdx);
            delRange.setEnd(node, offset);
            delRange.deleteContents();

            const pill = createPillElement(varName);
            delRange.insertNode(pill);
            const space = document.createTextNode('\u00A0');
            pill.after(space);

            const nr = document.createRange();
            nr.setStartAfter(space);
            nr.collapse(true);
            sel.removeAllRanges();
            sel.addRange(nr);

            // Update saved range to the new cursor position
            lastRangeRef.current = nr.cloneRange();

            setShowMenu(false);
            syncAndNotify();
            return;
          }
        }
      }

      /* Normal cursor insertion */
      range.deleteContents();
      const pill = createPillElement(varName);
      range.insertNode(pill);
      const space = document.createTextNode('\u00A0');
      pill.after(space);

      const nr = document.createRange();
      nr.setStartAfter(space);
      nr.collapse(true);
      sel.removeAllRanges();
      sel.addRange(nr);

      // Update saved range to the new cursor position
      lastRangeRef.current = nr.cloneRange();

      setShowMenu(false);
      syncAndNotify();
    }, [showMenu, syncAndNotify, onChange, value]);

    /* ── Imperative handle for parent ─── */
    React.useImperativeHandle(ref, () => ({
      insertVariable,
      focus: () => editorRef.current?.focus(),
    }), [insertVariable]);

    /* ── Input handler ─── */
    const handleInput = React.useCallback(() => {
      syncAndNotify();
      saveSelection();
      if (showMenu) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const node = range.startContainer;
          if (node.nodeType === Node.TEXT_NODE) {
            const before = (node.textContent || '').substring(0, range.startOffset);
            const slashIdx = before.lastIndexOf('/');
            if (slashIdx >= 0) {
              setFilter(before.substring(slashIdx + 1));
              setSelIdx(0);
              return;
            }
          }
        }
        setShowMenu(false);
      }
    }, [syncAndNotify, showMenu, saveSelection]);

    /* ── Click handler (pill deletion / selection save) ─── */
    const handleClick = React.useCallback((e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.dataset.deleteVar) {
        e.preventDefault();
        e.stopPropagation();
        const pill = target.closest('[data-variable]');
        if (pill) { pill.remove(); syncAndNotify(); }
      } else {
        saveSelection();
      }
    }, [syncAndNotify, saveSelection]);

    /* ── Keyboard handler ─── */
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
      /* Open slash menu on "/" */
      if (e.key === '/' && !showMenu && !e.metaKey && !e.ctrlKey) {
        requestAnimationFrame(() => {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            const eRect = editorRef.current?.getBoundingClientRect();
            if (eRect) {
              setMenuPos({
                top: rect.bottom - eRect.top + 6,
                left: Math.min(Math.max(0, rect.left - eRect.left), eRect.width - 256),
              });
            }
          }
          setShowMenu(true);
          setFilter('');
          setSelIdx(0);
        });
        return;
      }

      /* Slash-menu keyboard navigation */
      if (showMenu) {
        if (e.key === 'Escape') { e.preventDefault(); setShowMenu(false); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(p => Math.min(p + 1, flatItems.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelIdx(p => Math.max(0, p - 1)); return; }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          if (flatItems[selIdx]) insertVariable(flatItems[selIdx]);
          return;
        }
      }
    }, [showMenu, flatItems, selIdx, insertVariable]);

    /* ── Paste as plain text only ─── */
    const handlePaste = React.useCallback((e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    }, []);

    /* ── Dismiss slash menu on blur (delayed to allow click) ─── */
    const handleBlur = React.useCallback(() => {
      setTimeout(() => setShowMenu(false), 200);
    }, []);

    /* ── Render ─── */
    return (
      <div className={cn('relative', className)}>
        {/* Placeholder overlay */}
        {isEmpty && (
          <div className="absolute top-4 left-4 right-4 pointer-events-none select-none flex items-center gap-2">
            <span className="text-xs text-muted-foreground/40 font-serif">{placeholder}</span>
            <span className="text-[9px] font-mono text-muted-foreground/25 bg-muted/40 px-1.5 py-0.5 rounded border border-border/30">/</span>
            <span className="text-[9px] text-muted-foreground/30">to insert variables</span>
          </div>
        )}

        {/* Editable area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onPaste={handlePaste}
          onBlur={handleBlur}
          className={cn(
            'overflow-y-auto',
            'bg-background border border-border rounded-xl',
            'text-sm leading-[1.85] p-4 font-serif text-foreground',
            'outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10',
            'transition-colors whitespace-pre-wrap break-words resize-y',
          )}
          style={{ minHeight, maxHeight: minHeight === '420px' ? '600px' : undefined }}
          role="textbox"
          aria-multiline="true"
          aria-placeholder={placeholder}
        />

        {/* ── Slash Command Dropdown ── */}
        {showMenu && flatItems.length > 0 && (
          <div
            className="absolute z-50 w-[248px] bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center gap-1.5">
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Insert Variable</span>
              <kbd className="ml-auto text-[7px] font-mono text-muted-foreground/50 bg-muted px-1 rounded border border-border/40">Esc</kbd>
            </div>
            <div className="max-h-[230px] overflow-y-auto p-1">
              {filteredGroups.map(group => (
                <div key={group.group}>
                  <div className="px-2 pt-2.5 pb-1">
                    <span className="text-[7px] font-bold text-muted-foreground/60 uppercase tracking-widest">{group.group}</span>
                  </div>
                  {group.items.map(item => {
                    const idx = flatItems.indexOf(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); insertVariable(item); }}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 text-[10px] font-mono font-bold rounded-lg transition-colors',
                          idx === selIdx ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
);
