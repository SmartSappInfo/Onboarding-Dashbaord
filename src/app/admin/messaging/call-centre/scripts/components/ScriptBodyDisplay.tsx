'use client';

import * as React from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { cn } from '@/lib/utils';
import { scriptTextToDisplayHtml, RICH_SCRIPT_DISPLAY_CLASS } from '@/lib/call-centre-graph';

/**
 * Allowlist for script-body markup. Mirrors what the rich-text editor can produce
 * (formatting + lists + alignment via inline `style`) and nothing else, so resolved
 * CRM values injected into a body can never introduce executable markup.
 */
const ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 's', 'span', 'div', 'p', 'br',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a',
];
const ALLOWED_ATTR = ['style', 'class', 'href', 'target', 'rel'];

export interface ScriptBodyDisplayProps {
  /** Raw script body. May contain editor HTML and/or `{{VARIABLE}}` tokens. */
  text?: string;
  /** Optional resolver that substitutes live values (e.g. CRM/caller) before rendering. */
  resolveText?: (raw: string) => string;
  /** When true (and no resolver), unresolved `{{VAR}}` tokens render as highlighted pills. */
  highlightVariables?: boolean;
  /** Visual zoom factor applied to the rendered body (1 = 100%). */
  zoom?: number;
  className?: string;
  /** Rendered when the (resolved) body is empty. */
  emptyFallback?: React.ReactNode;
}

/**
 * The single, safe render path for call-script bodies. Resolves variables, converts
 * to display HTML via {@link scriptTextToDisplayHtml}, then sanitizes with DOMPurify
 * before injecting. Memoized and defined at module scope to avoid remounts.
 */
export const ScriptBodyDisplay = React.memo(function ScriptBodyDisplay({
  text,
  resolveText,
  highlightVariables = false,
  zoom = 1,
  className,
  emptyFallback = null,
}: ScriptBodyDisplayProps) {
  const html = React.useMemo(() => {
    const raw = text ?? '';
    const resolved = resolveText ? resolveText(raw) : raw;
    if (!resolved.trim()) return '';
    const unsafe = scriptTextToDisplayHtml(resolved, { highlightVariables });
    return DOMPurify.sanitize(unsafe, { ALLOWED_TAGS, ALLOWED_ATTR });
  }, [text, resolveText, highlightVariables]);

  if (!html) return <>{emptyFallback}</>;

  // Width compensation keeps the scaled content filling its container without clipping.
  const zoomStyle: React.CSSProperties | undefined =
    zoom !== 1
      ? { zoom }
      : undefined;

  return (
    <div
      data-testid="script-body"
      className={cn(RICH_SCRIPT_DISPLAY_CLASS, className)}
      style={zoomStyle}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
