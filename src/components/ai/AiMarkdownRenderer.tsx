'use client';

/**
 * @fileoverview SmartSapp Survey Intelligence — AI Rich Markdown & Interactive Chat Renderer
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Safe Tokenization: Parses markdown headers, bold, italics, inline code, ordered/unordered lists,
 *    sub-bullets, and paragraphs purely into React virtual DOM nodes. Completely immune to XSS.
 * 2. Emil Kowalski Micro-Interactions: High-performance animations, active:scale-[0.97] on interactive chips,
 *    timing <= 250ms, hardware-accelerated transform & opacity.
 * 3. Mobile Ergonomics: Touch targets >= 44px on interactive controls, fluid responsive typography.
 * 4. Zero External Dependencies: Eliminates heavy markdown bundles (react-markdown, marked) to preserve fast bundle load.
 * 5. Caution for Maintainers: Keep regex tokenizers bounded and linear to avoid catastrophic backtracking on large texts.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Check, 
  Layers, 
  PlusCircle, 
  RotateCcw, 
  Sparkles 
} from 'lucide-react';
import type { InteractiveAction } from '@/ai/schemas/survey-schemas';

export interface AiMarkdownRendererProps {
  content: string;
  className?: string;
  isUser?: boolean;
  interactiveAction?: InteractiveAction | null;
  onApplyAction?: (actionType: 'replace' | 'append' | 'dismiss') => void;
  onUndoAction?: () => void;
  appliedActionStatus?: 'replaced' | 'appended' | 'dismissed' | null;
  canUndo?: boolean;
}

interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'code' | 'link';
  text: string;
  href?: string;
}

/**
 * Safely parses inline markdown syntax (bold, italic, code, link) into strongly typed tokens.
 */
function parseInlineTokens(rawText: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // Tokenizer pattern matching: code, bold, italic, and links
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        text: rawText.substring(lastIndex, match.index),
      });
    }

    const matchText = match[0];
    if (matchText.startsWith('`') && matchText.endsWith('`')) {
      tokens.push({
        type: 'code',
        text: matchText.slice(1, -1),
      });
    } else if (matchText.startsWith('**') && matchText.endsWith('**')) {
      tokens.push({
        type: 'bold',
        text: matchText.slice(2, -2),
      });
    } else if (matchText.startsWith('*') && matchText.endsWith('*')) {
      tokens.push({
        type: 'italic',
        text: matchText.slice(1, -1),
      });
    } else if (matchText.startsWith('[') && matchText.includes('](') && matchText.endsWith(')')) {
      const splitIdx = matchText.indexOf('](');
      const label = matchText.slice(1, splitIdx);
      const url = matchText.slice(splitIdx + 2, -1);
      // Safe URL check: only http, https, or relative paths allowed
      const isSafe = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
      tokens.push({
        type: 'link',
        text: label,
        href: isSafe ? url : '#',
      });
    } else {
      tokens.push({
        type: 'text',
        text: matchText,
      });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < rawText.length) {
    tokens.push({
      type: 'text',
      text: rawText.substring(lastIndex),
    });
  }

  return tokens;
}

/**
 * Renders inline tokens into React Elements.
 */
function renderInline(tokens: InlineToken[], keyPrefix: string): React.ReactNode {
  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (token.type) {
      case 'bold':
        return (
          <strong key={key} className="font-semibold text-foreground tracking-tight">
            {token.text}
          </strong>
        );
      case 'italic':
        return (
          <em key={key} className="italic text-foreground/90">
            {token.text}
          </em>
        );
      case 'code':
        return (
          <code
            key={key}
            className="px-1.5 py-0.5 mx-0.5 rounded-md bg-muted/80 text-primary font-mono text-[11px] sm:text-xs font-semibold border border-border/60"
          >
            {token.text}
          </code>
        );
      case 'link':
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium underline underline-offset-2 hover:text-primary/80 transition-colors"
          >
            {token.text}
          </a>
        );
      case 'text':
      default:
        return <React.Fragment key={key}>{token.text}</React.Fragment>;
    }
  });
}

type BlockItem =
  | { type: 'heading'; level: number; text: string }
  | { type: 'quote'; text: string }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'unordered-list'; items: { text: string; indent: number }[] }
  | { type: 'code-block'; code: string; language?: string }
  | { type: 'paragraph'; text: string };

/**
 * Parses multi-line markdown content into structured block elements.
 */
function parseBlocks(markdownText: string): BlockItem[] {
  if (!markdownText) return [];

  const lines = markdownText.split('\n');
  const blocks: BlockItem[] = [];

  let currentList: { type: 'ordered' | 'unordered'; items: Array<{ text: string; indent: number }> } | null = null;
  let currentParagraphLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeLanguage = '';

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const text = currentParagraphLines.join(' ').trim();
      if (text) {
        blocks.push({ type: 'paragraph', text });
      }
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ordered') {
        blocks.push({
          type: 'ordered-list',
          items: currentList.items.map((i) => i.text),
        });
      } else {
        blocks.push({
          type: 'unordered-list',
          items: currentList.items,
        });
      }
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Fenced code blocks ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          type: 'code-block',
          code: codeBlockLines.join('\n'),
          language: codeLanguage,
        });
        inCodeBlock = false;
        codeBlockLines = [];
        codeLanguage = '';
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Blank line indicates paragraph or list separation
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Headings #, ##, ###, ####
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      continue;
    }

    // Blockquote >
    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'quote',
        text: trimmed.replace(/^>\s*/, ''),
      });
      continue;
    }

    // Ordered list: 1. , 2. , etc.
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ordered') {
        flushList();
        currentList = { type: 'ordered', items: [] };
      }
      currentList.items.push({ text: orderedMatch[2], indent: 0 });
      continue;
    }

    // Unordered list: - , * , •
    const bulletMatch = rawLine.match(/^(\s*)([-*•])\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      const leadingSpaces = bulletMatch[1].length;
      const indentLevel = leadingSpaces >= 4 ? 2 : leadingSpaces >= 2 ? 1 : 0;
      if (!currentList || currentList.type !== 'unordered') {
        flushList();
        currentList = { type: 'unordered', items: [] };
      }
      currentList.items.push({ text: bulletMatch[3], indent: indentLevel });
      continue;
    }

    // Normal paragraph continuation
    if (currentList) {
      // If we are inside a list and the line is indented, treat it as a continuation
      const isIndented = rawLine.startsWith('   ') || rawLine.startsWith('\t');
      if (isIndented && currentList.items.length > 0) {
        const last = currentList.items[currentList.items.length - 1];
        last.text += ' ' + trimmed;
        continue;
      } else {
        flushList();
      }
    }

    currentParagraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}

export function AiMarkdownRenderer({
  content,
  className,
  isUser = false,
  interactiveAction,
  onApplyAction,
  onUndoAction,
  appliedActionStatus,
  canUndo = false,
}: AiMarkdownRendererProps) {
  const blocks = React.useMemo(() => parseBlocks(content), [content]);

  if (isUser) {
    return (
      <div className={cn("text-sm leading-relaxed whitespace-pre-wrap font-normal", className)}>
        {content}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-foreground select-text", className)}>
      {blocks.map((block, idx) => {
        const blockKey = `b-${idx}`;

        switch (block.type) {
          case 'heading': {
            const tokens = parseInlineTokens(block.text);
            const renderedText = renderInline(tokens, blockKey);

            if (block.level === 1) {
              return (
                <h2
                  key={blockKey}
                  className="text-base sm:text-lg font-bold tracking-tight text-foreground pb-1 border-b border-border/40 mt-3 first:mt-0 flex items-center gap-1.5"
                >
                  {renderedText}
                </h2>
              );
            }
            if (block.level === 2) {
              return (
                <h3
                  key={blockKey}
                  className="text-sm sm:text-base font-bold tracking-tight text-foreground mt-2.5 first:mt-0 flex items-center gap-1.5"
                >
                  {renderedText}
                </h3>
              );
            }
            return (
              <h4
                key={blockKey}
                className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground mt-2 first:mt-0 flex items-center gap-1"
              >
                {renderedText}
              </h4>
            );
          }

          case 'quote': {
            const tokens = parseInlineTokens(block.text);
            return (
              <div
                key={blockKey}
                className="border-l-2 border-primary/70 bg-primary/[0.04] pl-3 py-1.5 rounded-r-lg italic text-muted-foreground my-2"
              >
                {renderInline(tokens, blockKey)}
              </div>
            );
          }

          case 'ordered-list': {
            return (
              <ol key={blockKey} className="space-y-1.5 my-2 pl-1">
                {block.items.map((itemText, i) => {
                  const tokens = parseInlineTokens(itemText);
                  return (
                    <li key={`${blockKey}-${i}`} className="flex items-start gap-2.5">
                      <span className="h-5 w-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-foreground/95">
                        {renderInline(tokens, `${blockKey}-${i}`)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            );
          }

          case 'unordered-list': {
            return (
              <ul key={blockKey} className="space-y-1.5 my-2 pl-1">
                {block.items.map((item, i) => {
                  const tokens = parseInlineTokens(item.text);
                  const isNested = item.indent > 0;
                  return (
                    <li
                      key={`${blockKey}-${i}`}
                      className={cn(
                        "flex items-start gap-2.5",
                        isNested && "pl-5 border-l border-border/50 text-xs sm:text-sm text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "rounded-full bg-primary/70 shrink-0 mt-2",
                          isNested ? "h-1 w-1 bg-muted-foreground" : "h-1.5 w-1.5"
                        )}
                        aria-hidden="true"
                      />
                      <span className="flex-1 text-sm text-foreground/95">
                        {renderInline(tokens, `${blockKey}-${i}`)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            );
          }

          case 'code-block': {
            return (
              <pre
                key={blockKey}
                className="p-3 rounded-xl bg-muted/60 border border-border/70 overflow-x-auto font-mono text-xs text-foreground/90 my-2"
              >
                <code>{block.code}</code>
              </pre>
            );
          }

          case 'paragraph':
          default: {
            const tokens = parseInlineTokens(block.text);
            return (
              <p key={blockKey} className="text-sm leading-relaxed text-foreground/95">
                {renderInline(tokens, blockKey)}
              </p>
            );
          }
        }
      })}

      {/* Interactive Canvas Action Panel (Requirement: Interactive Canvas Management) */}
      {interactiveAction && interactiveAction.type === 'replace_or_append_canvas' && (
        <div className="mt-3.5 pt-3 border-t border-border/60 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Layers className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold tracking-tight text-foreground">
                  {interactiveAction.title || 'Canvas Action Required'}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                {interactiveAction.targetArea === 'result_page_blocks' ? 'Result Page' : 'Studio Canvas'}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-normal">
              {interactiveAction.message ||
                'Would you like to replace the existing canvas content or append these newly generated items below?'}
            </p>

            {appliedActionStatus ? (
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                  <span>
                    {appliedActionStatus === 'replaced'
                      ? 'Canvas Replaced'
                      : appliedActionStatus === 'appended'
                      ? 'Appended Below Existing'
                      : 'Dismissed'}
                  </span>
                </div>
                {canUndo && onUndoAction && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onUndoAction}
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Undo
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => onApplyAction?.('replace')}
                  className="min-h-[44px] sm:min-h-[36px] px-3.5 rounded-lg text-xs font-semibold shadow-xs active:scale-[0.97] transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Replace Canvas</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onApplyAction?.('append')}
                  className="min-h-[44px] sm:min-h-[36px] px-3.5 rounded-lg text-xs font-semibold hover:bg-accent/10 active:scale-[0.97] transition-all flex items-center gap-1.5"
                >
                  <PlusCircle className="h-3.5 w-3.5 text-primary" />
                  <span>Append Below</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onApplyAction?.('dismiss')}
                  className="min-h-[44px] sm:min-h-[36px] px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
                >
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AiMarkdownRenderer;
