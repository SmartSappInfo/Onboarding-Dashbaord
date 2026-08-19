'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useSlashAutocomplete } from '@/hooks/use-slash-autocomplete';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { TemplateVariable } from '@/lib/types';
import { Bold, Italic, Underline, Strikethrough } from 'lucide-react';
import { FallbackEditorModal } from '@/components/shared/FallbackEditorModal';

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
  core: 'General Identity & Contacts',
  contact: 'General Identity & Contacts',
  contact_specific: 'Contact Specific Role',
  general: 'General Variables',
  common: 'Common Variables',
  custom: 'Custom Variables',
  regional: 'Regional Metadata',
  financial: 'Financial Configuration',
  interests: 'Interests',
};

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Escapes HTML entities to prevent Stored XSS attacks when raw text strings
 * are converted to contentEditable HTML pills inside SlashTextarea.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const ALLOWED_RICH_TAGS = new Set([
  'strong', 'b', 'em', 'i', 'u', 'del', 's', 'strike', 
  'span', 'font', 'br', 'p', 'div', 'a'
]);

const ALLOWED_RICH_ATTRS: Record<string, Set<string>> = {
  span: new Set(['style', 'class', 'data-variable', 'data-fallback', 'contenteditable']),
  font: new Set(['color', 'size', 'face']),
  a: new Set(['href', 'target', 'rel', 'style']),
  strong: new Set(['style']),
  b: new Set(['style']),
  em: new Set(['style']),
  i: new Set(['style']),
  u: new Set(['style']),
  del: new Set(['style']),
  s: new Set(['style']),
  strike: new Set(['style']),
  p: new Set(['style', 'class']),
  div: new Set(['style', 'class']),
  br: new Set([]),
};

/**
 * ARCHITECTURAL NOTE & SECURITY STANDARD (Rule 8 & 10 Maintainer Guidance):
 * Sanitizes rich HTML content by whitelisting safe inline formatting tags (strong, b, em, i, u, del, s, strike, span, font, br)
 * and their style/color attributes while stripping dangerous script, style, iframe, object, embed tags and all inline event handlers (on*).
 * Prevents Stored XSS attacks while preserving user-selected text colors, weights, and styles.
 *
 * TESTABILITY: Covered in visual-block.formatting.test.tsx.
 * RELATED SURFACES: SlashTextarea, SlashInput, VisualBlock, SafeHtml, template-workshop.tsx.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined') {
    // Basic regex fallback during SSR to strip dangerous tags and on* attributes
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const container = doc.body.firstElementChild || doc.body;

    const sanitizeElement = (el: Element) => {
      const children = Array.from(el.children);
      for (const child of children) {
        const tagName = child.tagName.toLowerCase();
        if (!ALLOWED_RICH_TAGS.has(tagName)) {
          if (['script', 'style', 'iframe', 'object', 'embed', 'head', 'meta', 'title'].includes(tagName)) {
            child.remove();
          } else {
            // Unwrap disallowed wrapper element by replacing it with its child nodes
            while (child.firstChild) {
              child.parentNode?.insertBefore(child.firstChild, child);
            }
            child.remove();
          }
        } else {
          // Filter attributes on allowed tags
          const allowedAttrs = ALLOWED_RICH_ATTRS[tagName] || new Set();
          const attrNames = Array.from(child.attributes).map(a => a.name);
          for (const attr of attrNames) {
            const lowerAttr = attr.toLowerCase();
            if (lowerAttr.startsWith('on') || !allowedAttrs.has(lowerAttr)) {
              child.removeAttribute(attr);
            } else if (lowerAttr === 'href') {
              const val = child.getAttribute('href') || '';
              if (/^(javascript|data|vbscript):/i.test(val.trim())) {
                child.setAttribute('href', '#');
              }
            }
          }
          sanitizeElement(child);
        }
      }
    };

    sanitizeElement(container);
    return container.innerHTML;
  } catch (err) {
    console.error('Error sanitizing rich HTML:', err);
    return html;
  }
}

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Strips legacy container HTML tags (<font>, <span>, <div>, <p>, etc.) and converts line break elements (<br>)
 * into clean newline characters, while preserving double-brace variable tokens ({{var_name}}) and plain text.
 * Used for SMS, plain text mode, and raw string sanitization.
 *
 * TESTABILITY: Covered in visual-block.formatting.test.tsx.
 * RELATED SURFACES: SlashTextarea, PlainTextEditor, VisualBlock, BlockInspector, template-workshop.tsx.
 */
export function cleanContainerHtml(text: string): string {
  if (!text) return '';
  if (!/<[a-z\/\!\?][^>]*>/i.test(text)) return text;

  let clean = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n');

  clean = clean
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<font[^>]*>/gi, '')
    .replace(/<\/font>/gi, '')
    .replace(/<span[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '');

  clean = clean.replace(/<[^>]+>/g, '');

  clean = clean
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'");

  clean = clean.replace(/\n{3,}/g, '\n\n');

  return clean;
}

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Single Source of Truth (SSOT) utility to convert double-brace template strings (`{{key | fallback}}`)
 * into interactive visual pill HTML elements (`<span contenteditable="false" ...>`).
 *
 * When enableFormatting is true: Preserves safe inline rich text HTML (<font color="...">, <span style="...">, <b>, <u>)
 * while parsing variable tokens into visual badge pills with fallback configuration triggers.
 * When enableFormatting is false: Sanitizes container tags to plain text and escapes raw HTML for SMS/Plain Text mode.
 *
 * TESTABILITY: Covered in visual-block.formatting.test.tsx.
 * RELATED SURFACES: SlashTextarea, PlainTextEditor, ShareMediaDialog, VisualBlock.
 */
export function convertToVisualHtml(text: string, enableFormatting = true): string {
  if (!text) return '';

  const pillTemplate = (varName: string, fallback: string) => {
    const fallbackText = fallback ? ` (${fallback})` : '';
    return `<span contenteditable="false" data-variable="${varName}" data-fallback="${fallback}" class="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono text-[90%] font-bold border border-blue-200/50 align-baseline select-none hover:bg-blue-200/20 dark:hover:bg-blue-900/30 transition-all"><span>${varName}${fallbackText}</span><button type="button" data-variable-settings="${varName}" class="hover:bg-blue-500/20 p-0.5 rounded transition-all inline-flex items-center justify-center ml-1 text-[9px] cursor-pointer border-0 bg-transparent min-w-[28px] min-h-[28px] touch-manipulation" title="Configure fallback">⚙️</button></span>`;
  };

  const replaceTokens = (str: string) => {
    return str.replace(/\{\{(.*?)\}\}/g, (_match, rawKey) => {
      const parts = rawKey.split(/\|\||\|/);
      const varName = parts[0].trim();
      const fallback = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
      return pillTemplate(varName, fallback);
    });
  };

  if (!enableFormatting) {
    // 1. Sanitize legacy container HTML tags (<font color="...">, <span>, etc.) to prevent tag leakage in plain text mode
    const cleanedText = cleanContainerHtml(text);
    // 2. Escape raw HTML entities to prevent Stored XSS execution in contentEditable
    const safeText = escapeHtml(cleanedText);
    return replaceTokens(safeText);
  }

  // 1. Sanitize dangerous tags while keeping safe inline formatting HTML tags (<b>, <span>, <font>, etc.)
  const sanitized = sanitizeRichHtml(text);
  // 2. Convert variable tokens back to non-editable HTML spans
  return replaceTokens(sanitized);
}

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Single Source of Truth (SSOT) utility to convert contentEditable HTML DOM nodes
 * back into clean template text format (`{{variable_key | fallback}}`).
 *
 * When enableFormatting is true: Preserves safe inline rich text formatting (colors, bold, italic, underline)
 * while serializing visual pill elements back into {{variable}} tokens.
 * When enableFormatting is false (e.g. SMS/Plain Text mode): Converts line breaks to standard '\n'
 * and strips all container HTML tags cleanly.
 *
 * TESTABILITY: Covered in visual-block.formatting.test.tsx.
 * RELATED SURFACES: SlashTextarea, PlainTextEditor, ShareMediaDialog, VisualBlock.
 */
export function convertToCleanHtml(element: HTMLElement, enableFormatting = true): string {
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Convert visual spans back to {{variable}} tokens
  const pills = clone.querySelectorAll('[data-variable]');
  pills.forEach((pill) => {
    const varName = pill.getAttribute('data-variable');
    const fallback = pill.getAttribute('data-fallback') || '';
    const token = fallback ? `{{${varName} | ${fallback}}}` : `{{${varName}}}`;
    const textNode = clone.ownerDocument.createTextNode(token);
    pill.parentNode?.replaceChild(textNode, pill);
  });

  if (!enableFormatting) {
    const brs = clone.querySelectorAll('br');
    brs.forEach(br => br.parentNode?.replaceChild(clone.ownerDocument.createTextNode('\n'), br));
    const blockEls = clone.querySelectorAll('div, p');
    blockEls.forEach(block => {
      if (block.previousSibling) {
        block.parentNode?.insertBefore(clone.ownerDocument.createTextNode('\n'), block);
      }
    });
    return cleanContainerHtml(clone.textContent || '');
  }

  return sanitizeRichHtml(clone.innerHTML);
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
    <div className={cn("flex items-center gap-0.5 p-1 bg-popover/95 backdrop-blur-md border border-border/80 rounded-xl absolute -top-10 left-0 z-50 animate-in fade-in slide-in-from-bottom-1 duration-150 shadow-lg", className)}>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onFormat('bold'); }}
        className="p-1.5 hover:bg-muted active:scale-95 rounded-lg text-muted-foreground hover:text-foreground transition-all flex items-center justify-center min-w-[28px] min-h-[28px]"
        title="Bold (Ctrl/Cmd+B)"
        aria-label="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onFormat('italic'); }}
        className="p-1.5 hover:bg-muted active:scale-95 rounded-lg text-muted-foreground hover:text-foreground transition-all flex items-center justify-center min-w-[28px] min-h-[28px]"
        title="Italic (Ctrl/Cmd+I)"
        aria-label="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onFormat('underline'); }}
        className="p-1.5 hover:bg-muted active:scale-95 rounded-lg text-muted-foreground hover:text-foreground transition-all flex items-center justify-center min-w-[28px] min-h-[28px]"
        title="Underline (Ctrl/Cmd+U)"
        aria-label="Underline"
      >
        <Underline className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onFormat('strike'); }}
        className="p-1.5 hover:bg-muted active:scale-95 rounded-lg text-muted-foreground hover:text-foreground transition-all flex items-center justify-center min-w-[28px] min-h-[28px]"
        title="Strikethrough"
        aria-label="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </button>
      <div className="h-4 w-px bg-border mx-1" />
      <div className="flex gap-1 items-center pr-1">
        {colors.map((c) => (
          <button
            key={c.name}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onFormat('color', c.value); }}
            className="w-4 h-4 rounded-full border border-border/60 transition-transform hover:scale-110 active:scale-90 shrink-0 shadow-xs cursor-pointer"
            style={{ backgroundColor: c.value || 'currentColor' }}
            title={`Color: ${c.name}`}
            aria-label={`Color ${c.name}`}
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

    const containerRef = React.useRef<HTMLDivElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const lastValueRef = React.useRef(value);
    const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 250 });

    const [modalOpen, setModalOpen] = React.useState(false);
    const [editingVarKey, setEditingVarKey] = React.useState('');
    const [editingVarCurrentFallback, setEditingVarCurrentFallback] = React.useState('');
    const [activePillElement, setActivePillElement] = React.useState<HTMLElement | null>(null);

    const handleSaveFallback = React.useCallback((fallbackVal: string) => {
      if (!activePillElement) return;
      const cleanFallback = fallbackVal.trim();
      activePillElement.setAttribute('data-fallback', cleanFallback);
      
      const labelSpan = activePillElement.querySelector('span');
      const varName = activePillElement.getAttribute('data-variable') || '';
      if (labelSpan) {
        labelSpan.textContent = cleanFallback ? `${varName} (${cleanFallback})` : varName;
      }
      
      const el = localRef.current;
      if (el) {
        const cleanVal = convertToCleanHtml(el, enableFormatting);
        lastValueRef.current = cleanVal;
        onChange(cleanVal);
      }
      
      setModalOpen(false);
      setActivePillElement(null);
    }, [activePillElement, enableFormatting, onChange]);

    const updateCoords = React.useCallback(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: Math.max(250, rect.width),
        });
      }
    }, []);

    React.useEffect(() => {
      if (showAutocomplete) {
        updateCoords();
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
      }
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        window.removeEventListener('resize', updateCoords);
      };
    }, [showAutocomplete, updateCoords]);

    React.useEffect(() => {
      if (localRef.current) {
        localRef.current.innerHTML = convertToVisualHtml(value, enableFormatting);
      }
    }, []);

    React.useEffect(() => {
      const el = localRef.current;
      if (!el) return;
      const cleanVal = convertToCleanHtml(el, enableFormatting);
      if (cleanVal !== value) {
        lastValueRef.current = value;
        el.innerHTML = convertToVisualHtml(value, enableFormatting);
      }
    }, [value, enableFormatting]);

    React.useEffect(() => {
      if (!dropdownRef.current) return;
      const activeEl = dropdownRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }, [autocompleteIndex, showAutocomplete]);

    const handleBlur = React.useCallback(() => {
      setTimeout(() => setShowAutocomplete(false), 350);
    }, [setShowAutocomplete]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const cleanVal = convertToCleanHtml(el, enableFormatting);
      lastValueRef.current = cleanVal;
      onChange(cleanVal);
      handleInputChange({ target: el } as unknown as React.ChangeEvent<HTMLInputElement>);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rawText = e.clipboardData.getData('text/plain');
      if (!rawText) return;

      // Replace multiline breaks with clean space for single line SlashInput
      const plainText = rawText.replace(/[\r\n]+/g, ' ');

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();

      const textNode = document.createTextNode(plainText);
      range.insertNode(textNode);

      // Move caret directly after inserted plain text node
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);

      const el = e.currentTarget;
      const cleanVal = convertToCleanHtml(el, enableFormatting);
      lastValueRef.current = cleanVal;
      onChange(cleanVal);
      handleInputChange({ target: el } as unknown as React.ChangeEvent<HTMLInputElement>);
    };

    return (
      <div ref={containerRef} className="relative w-full">
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
          onPaste={handlePaste}
          onClick={(e) => {
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

        {showAutocomplete && filteredVars.length > 0 && typeof document !== 'undefined' && createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              marginTop: '4px',
              zIndex: 10000,
            }}
            className="max-h-60 overflow-y-auto rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 text-left text-popover-foreground scrollbar-thin scrollbar-thumb-muted"
          >
            {filteredVars.map((v, idx) => {
              const labelText = contextLabels[v.context] || String(v.context);
              const isSelected = idx === autocompleteIndex;

              return (
                <button
                  key={v.id}
                  type="button"
                  data-active={isSelected ? 'true' : 'false'}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (localRef.current) {
                      selectAndInsert(v.name, localRef.current);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (localRef.current) {
                      selectAndInsert(v.name, localRef.current);
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (localRef.current) {
                      selectAndInsert(v.name, localRef.current);
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (localRef.current) {
                      selectAndInsert(v.name, localRef.current);
                    }
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex flex-col gap-0.5 outline-none cursor-pointer select-none min-h-[44px] justify-center touch-manipulation",
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
          </div>,
          document.body
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

    const containerRef = React.useRef<HTMLDivElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const lastValueRef = React.useRef(value);
    const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 250 });

    const [modalOpen, setModalOpen] = React.useState(false);
    const [editingVarKey, setEditingVarKey] = React.useState('');
    const [editingVarCurrentFallback, setEditingVarCurrentFallback] = React.useState('');
    const [activePillElement, setActivePillElement] = React.useState<HTMLElement | null>(null);

    const handleSaveFallback = React.useCallback((fallbackVal: string) => {
      if (!activePillElement) return;
      const cleanFallback = fallbackVal.trim();
      activePillElement.setAttribute('data-fallback', cleanFallback);
      
      const labelSpan = activePillElement.querySelector('span');
      const varName = activePillElement.getAttribute('data-variable') || '';
      if (labelSpan) {
        labelSpan.textContent = cleanFallback ? `${varName} (${cleanFallback})` : varName;
      }
      
      const el = localRef.current;
      if (el) {
        const cleanVal = convertToCleanHtml(el, enableFormatting);
        lastValueRef.current = cleanVal;
        onChange(cleanVal);
      }
      
      setModalOpen(false);
      setActivePillElement(null);
    }, [activePillElement, enableFormatting, onChange]);

    const updateCoords = React.useCallback(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: Math.max(250, rect.width),
        });
      }
    }, []);

    React.useEffect(() => {
      if (showAutocomplete) {
        updateCoords();
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
      }
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        window.removeEventListener('resize', updateCoords);
      };
    }, [showAutocomplete, updateCoords]);

    React.useEffect(() => {
      if (localRef.current) {
        localRef.current.innerHTML = convertToVisualHtml(value, enableFormatting);
      }
    }, []);

    React.useEffect(() => {
      const el = localRef.current;
      if (!el) return;
      const cleanVal = convertToCleanHtml(el, enableFormatting);
      if (cleanVal !== value) {
        lastValueRef.current = value;
        el.innerHTML = convertToVisualHtml(value, enableFormatting);
      }
    }, [value, enableFormatting]);

    React.useEffect(() => {
      if (!dropdownRef.current) return;
      const activeEl = dropdownRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }, [autocompleteIndex, showAutocomplete]);

    const handleBlur = React.useCallback(() => {
      setTimeout(() => setShowAutocomplete(false), 350);
    }, [setShowAutocomplete]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const cleanVal = convertToCleanHtml(el, enableFormatting);
      lastValueRef.current = cleanVal;
      onChange(cleanVal);
      handleInputChange({ target: el } as unknown as React.ChangeEvent<HTMLInputElement>);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const plainText = e.clipboardData.getData('text/plain');
      if (!plainText) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();

      const textNode = document.createTextNode(plainText);
      range.insertNode(textNode);

      // Move caret directly after inserted plain text node
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);

      const el = e.currentTarget;
      const cleanVal = convertToCleanHtml(el, enableFormatting);
      lastValueRef.current = cleanVal;
      onChange(cleanVal);
      handleInputChange({ target: el } as unknown as React.ChangeEvent<HTMLInputElement>);
    };

    return (
      <div ref={containerRef} className="relative w-full">
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
          onPaste={handlePaste}
          onClick={(e) => {
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

        {showAutocomplete && filteredVars.length > 0 && typeof document !== 'undefined' && createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              marginTop: '4px',
              zIndex: 10000,
            }}
            className="max-h-60 overflow-y-auto rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 text-left text-popover-foreground scrollbar-thin scrollbar-thumb-muted"
          >
            {filteredVars.map((v, idx) => {
              const labelText = contextLabels[v.context] || String(v.context);
              const isSelected = idx === autocompleteIndex;

              return (
                <button
                  key={v.id}
                  type="button"
                  data-active={isSelected ? 'true' : 'false'}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (localRef.current) {
                      selectAndInsert(v.name, localRef.current);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (localRef.current) {
                      selectAndInsert(v.name, localRef.current);
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (localRef.current) {
                      selectAndInsert(v.name, localRef.current);
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (localRef.current) {
                      selectAndInsert(v.name, localRef.current);
                    }
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex flex-col gap-0.5 outline-none cursor-pointer select-none min-h-[44px] justify-center touch-manipulation",
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
          </div>,
          document.body
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
  }
);

SlashTextarea.displayName = 'SlashTextarea';
