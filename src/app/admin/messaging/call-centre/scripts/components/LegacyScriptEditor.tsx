'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { isRichText } from '@/lib/call-centre-graph';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Type, CaseSensitive, Rows3, Baseline,
} from 'lucide-react';

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
  /**
   * Enable the rich-text formatting toolbar (bold/italic/underline, alignment,
   * bullet & numbered lists, font family, font size, line spacing).
   * When enabled the editor serializes to HTML (variables still stored as
   * `{{VAR}}`); otherwise it serializes to plain text as before.
   */
  richFormatting?: boolean;
}

/* ── Rich toolbar option catalogues ───────────────────────────────────────── */
const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Sans Serif', value: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif', value: 'ui-serif, Georgia, serif' },
  { label: 'Monospace', value: 'ui-monospace, monospace' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times', value: '"Times New Roman", Times, serif' },
];
const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32'];
const LINE_SPACINGS = [
  { label: 'Single', value: '1.4' },
  { label: '1.5×', value: '1.7' },
  { label: 'Double', value: '2.2' },
];
/* Quick-pick font colour swatches (a custom picker is also available). */
const FONT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Black', value: '#0f172a' },
  { label: 'Slate', value: '#64748b' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Purple', value: '#9333ea' },
];

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
  function LegacyScriptEditor({ value, onChange, variableGroups, placeholder = 'Start typing your script here…', className, minHeight = '420px', richFormatting = false }, ref) {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const [showMenu, setShowMenu] = React.useState(false);
    const [filter, setFilter] = React.useState('');
    const [menuPos, setMenuPos] = React.useState({ top: 0, left: 0 });
    const [selIdx, setSelIdx] = React.useState(0);
    const [isEmpty, setIsEmpty] = React.useState(!value);
    const [customColor, setCustomColor] = React.useState('#2563eb');
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

    /* ── Serialize editor DOM → HTML (rich mode), pills back to {{VAR}} ─── */
    const serializeRich = React.useCallback(() => {
      if (!editorRef.current) return '';
      const clone = editorRef.current.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[data-variable]').forEach((el) => {
        const varName = (el as HTMLElement).dataset.variable || '';
        el.replaceWith(document.createTextNode(`{{${varName}}}`));
      });
      const html = clone.innerHTML;
      // Treat a structurally-empty editor as empty string
      return clone.textContent?.trim() ? html : '';
    }, []);

    /* ── Sync external value → editor HTML ─── */
    React.useEffect(() => {
      if (isInternal.current) { isInternal.current = false; return; }
      if (editorRef.current) {
        if (richFormatting && isRichText(value)) {
          // value is already formatted HTML — only convert {{VAR}} tokens to pills
          editorRef.current.innerHTML = value.replace(
            /\{\{([A-Za-z0-9_]+)\}\}/g,
            (_, v) => pillHtml(v)
          );
        } else {
          editorRef.current.innerHTML = textToHtml(value);
        }
        setIsEmpty(!editorRef.current.textContent?.trim());
      }
    }, [value, richFormatting]);

    /* ── Notify parent of content change ─── */
    const syncAndNotify = React.useCallback(() => {
      isInternal.current = true;
      const out = richFormatting ? serializeRich() : extractText();
      setIsEmpty(!editorRef.current?.textContent?.trim());
      onChange(out);
    }, [extractText, onChange, richFormatting, serializeRich]);

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

    /* ── Rich-text formatting helpers ─────────────────────────────────────── */

    /** Re-focus the editor and restore the last saved selection range. */
    const restoreSelection = React.useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      if (lastRangeRef.current) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(lastRangeRef.current);
      }
    }, []);

    /** Run a document.execCommand formatting command on the active selection. */
    const runCommand = React.useCallback((command: string, value?: string) => {
      if (!editorRef.current) return;
      restoreSelection();
      try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* not supported */ }
      document.execCommand(command, false, value);
      saveSelection();
      syncAndNotify();
    }, [restoreSelection, saveSelection, syncAndNotify]);

    /** Apply a pixel font-size to the current selection (execCommand fontSize is 1–7 only). */
    const applyFontSize = React.useCallback((px: string) => {
      const editor = editorRef.current;
      if (!editor || !px) return;
      restoreSelection();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return; // nothing selected
      // Use a temporary marker size, then rewrite the generated <font> tags as styled spans.
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand('fontSize', false, '7');
      editor.querySelectorAll('font[size="7"]').forEach((f) => {
        const span = document.createElement('span');
        span.style.fontSize = `${px}px`;
        while (f.firstChild) span.appendChild(f.firstChild);
        f.replaceWith(span);
      });
      saveSelection();
      syncAndNotify();
    }, [restoreSelection, saveSelection, syncAndNotify]);

    /** Apply line-height (vertical spacing) to the selected block(s), or wrap all content. */
    const applyLineSpacing = React.useCallback((value: string) => {
      const editor = editorRef.current;
      if (!editor || !value) return;
      restoreSelection();
      const sel = window.getSelection();

      // Climb from a node up to the top-level block child of the editor root.
      const blockOf = (node: Node | null): HTMLElement | null => {
        let el: HTMLElement | null = node
          ? (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement))
          : null;
        while (el && el.parentElement && el.parentElement !== editor) el = el.parentElement;
        return el && el !== editor ? el : null;
      };

      let applied = false;
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const startBlock = blockOf(range.startContainer);
        const endBlock = blockOf(range.endContainer);
        if (startBlock) {
          const blocks: HTMLElement[] = [startBlock];
          let n: ChildNode | null = startBlock;
          while (n && n !== endBlock) {
            n = n.nextSibling;
            if (n && n.nodeType === Node.ELEMENT_NODE) blocks.push(n as HTMLElement);
          }
          blocks.forEach((b) => { b.style.lineHeight = value; });
          applied = true;
        }
      }

      if (!applied) {
        // No block wrapper (e.g. a single bare text line) — wrap the whole body.
        const wrapper = document.createElement('div');
        wrapper.style.lineHeight = value;
        while (editor.firstChild) wrapper.appendChild(editor.firstChild);
        editor.appendChild(wrapper);
      }
      saveSelection();
      syncAndNotify();
    }, [restoreSelection, saveSelection, syncAndNotify]);

    /** Apply a text colour to the current selection. Empty value resets to the default. */
    const applyFontColor = React.useCallback((color: string) => {
      if (!color) {
        const editor = editorRef.current;
        const computed = editor ? getComputedStyle(editor).color : '';
        runCommand('foreColor', computed || 'inherit');
        return;
      }
      runCommand('foreColor', color);
    }, [runCommand]);

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

    /* ── Reusable toolbar button ─── */
    const ToolbarBtn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
      <button
        type="button"
        title={title}
        aria-label={title}
        // preventDefault keeps the editor's text selection intact when the button is pressed
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
      >
        {children}
      </button>
    );

    const toolbarSelectClass =
      'h-7 rounded-lg bg-background border border-border text-[10px] font-semibold text-foreground px-1.5 outline-none focus:border-primary/40 cursor-pointer';

    /* ── Render ─── */
    return (
      <div className={cn('relative flex flex-col', className)}>
        {/* ── Rich-text formatting toolbar ── */}
        {richFormatting && (
          <div className="flex flex-wrap items-center gap-0.5 mb-2 p-1 bg-muted/40 border border-border rounded-xl">
            <ToolbarBtn title="Bold (Ctrl+B)" onClick={() => runCommand('bold')}><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn title="Italic (Ctrl+I)" onClick={() => runCommand('italic')}><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn title="Underline (Ctrl+U)" onClick={() => runCommand('underline')}><Underline className="h-3.5 w-3.5" /></ToolbarBtn>

            {/* Font colour: named presets + a custom colour swatch */}
            <div className="flex items-center gap-0.5">
              <select
                title="Text colour"
                aria-label="Text colour"
                defaultValue=""
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => { applyFontColor(e.target.value); e.currentTarget.selectedIndex = 0; }}
                className={toolbarSelectClass}
              >
                <option value="" disabled>Colour</option>
                {FONT_COLORS.map((c) => (
                  <option key={c.label} value={c.value}>{c.label}</option>
                ))}
              </select>
              <label
                title="Custom text colour"
                className="relative h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors cursor-pointer"
              >
                <Baseline className="h-3.5 w-3.5" />
                <span
                  className="absolute bottom-1 left-1.5 right-1.5 h-0.5 rounded-full"
                  style={{ backgroundColor: customColor }}
                />
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => { setCustomColor(e.target.value); applyFontColor(e.target.value); }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  aria-label="Pick custom text colour"
                />
              </label>
            </div>

            <span className="w-px h-5 bg-border mx-1" />

            <ToolbarBtn title="Align left" onClick={() => runCommand('justifyLeft')}><AlignLeft className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn title="Align centre" onClick={() => runCommand('justifyCenter')}><AlignCenter className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn title="Align right" onClick={() => runCommand('justifyRight')}><AlignRight className="h-3.5 w-3.5" /></ToolbarBtn>

            <span className="w-px h-5 bg-border mx-1" />

            <ToolbarBtn title="Bulleted list" onClick={() => runCommand('insertUnorderedList')}><List className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn title="Numbered list" onClick={() => runCommand('insertOrderedList')}><ListOrdered className="h-3.5 w-3.5" /></ToolbarBtn>

            <span className="w-px h-5 bg-border mx-1" />

            {/* Font family */}
            <div className="flex items-center gap-1">
              <Type className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                title="Font family"
                aria-label="Font family"
                defaultValue=""
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => { const v = e.target.value; if (v) runCommand('fontName', v); e.currentTarget.selectedIndex = 0; }}
                className={toolbarSelectClass}
              >
                <option value="" disabled>Font</option>
                {FONT_FAMILIES.filter((f) => f.value).map((f) => (
                  <option key={f.label} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Font size */}
            <div className="flex items-center gap-1">
              <CaseSensitive className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                title="Font size"
                aria-label="Font size"
                defaultValue=""
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => { const v = e.target.value; if (v) applyFontSize(v); e.currentTarget.selectedIndex = 0; }}
                className={toolbarSelectClass}
              >
                <option value="" disabled>Size</option>
                {FONT_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Line spacing */}
            <div className="flex items-center gap-1">
              <Rows3 className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                title="Line spacing"
                aria-label="Line spacing"
                defaultValue=""
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => { const v = e.target.value; if (v) applyLineSpacing(v); e.currentTarget.selectedIndex = 0; }}
                className={toolbarSelectClass}
              >
                <option value="" disabled>Spacing</option>
                {LINE_SPACINGS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Placeholder overlay */}
        {isEmpty && (
          <div className={cn(
            'absolute left-4 right-4 pointer-events-none select-none flex items-center gap-2',
            richFormatting ? 'top-[52px]' : 'top-4',
          )}>
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
            'overflow-y-auto flex-1 min-h-0',
            'bg-background border border-border rounded-xl',
            'text-sm leading-[1.85] p-4 font-serif text-foreground',
            'outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10',
            'transition-colors whitespace-pre-wrap break-words resize-y',
            // Render bullet/number lists correctly inside the editable area
            '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5',
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
