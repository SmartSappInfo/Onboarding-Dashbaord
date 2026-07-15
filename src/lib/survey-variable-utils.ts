/**
 * @fileOverview Shared client-side variable interpolation utility for the survey system.
 *
 * AGENTS.md compliance:
 * - This utility is the SINGLE source of truth for client-side {{token}} substitution.
 * - All survey client components MUST import this function instead of implementing local regex.
 * - Server-side resolution MUST use FieldsVariablesService.resolveTemplateVariables (not this utility).
 * - The `any` type is strictly prohibited.
 *
 * Performance notes (per vercel-react-best-practices `js-hoist-regexp`):
 * - The RegExp is hoisted to module scope — created once, reused on every call.
 * - Fast paths short-circuit for empty input, no-token text, and empty value maps.
 */

import type { VariableValuesMap } from '@/lib/types/survey-variable-types';

/**
 * Pre-compiled regex hoisted to module scope per js-hoist-regexp rule.
 * Matches {{variable_name}} and {{ variable_name }} (with optional whitespace).
 */
const VARIABLE_TOKEN_REGEX = /\{\{([^}]+)\}\}/g;

/**
 * Interpolates {{variable}} tokens in a string using a pre-resolved values map.
 *
 * Behaviour:
 * - Unresolved tokens become empty string when `keepMissing` is false (graceful degradation
 *   for anonymous visitors — raw `{{token}}` text is never shown to end users).
 * - Unresolved tokens are preserved as-is when `keepMissing` is true (preview / editor mode).
 * - HTML strings are supported — does not escape or encode output values.
 * - Input is never mutated.
 *
 * @param text        Raw template string containing {{token}} syntax. Null/undefined returns ''.
 * @param valuesMap   Pre-resolved flat map of variable key → string value.
 * @param keepMissing When true, unknown tokens are preserved as raw {{token}} text. Default: false.
 * @returns           Interpolated string with tokens replaced or removed.
 *
 * @example
 * interpolateWithMap('Hello {{contact_name}}!', { contact_name: 'Alice' }) // → 'Hello Alice!'
 * interpolateWithMap('Hello {{contact_name}}!', {})                        // → 'Hello !'
 * interpolateWithMap('Hello {{contact_name}}!', {}, true)                  // → 'Hello {{contact_name}}!'
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const sanitizeNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      
      if (['script', 'iframe', 'object', 'embed', 'link', 'style', 'form', 'input', 'button', 'textarea'].includes(tagName)) {
        el.parentNode?.removeChild(el);
        return;
      }
      
      const attrs = Array.from(el.attributes);
      attrs.forEach(attr => {
        if (attr.name.startsWith('on') || attr.value.toLowerCase().includes('javascript:')) {
          el.removeAttribute(attr.name);
        }
      });
    }
    
    const children = Array.from(node.childNodes);
    children.forEach(sanitizeNode);
  };
  
  sanitizeNode(doc.body);
  return doc.body.innerHTML.replace(/&amp;/g, '&');
}

export function interpolateWithMap(
  text: string | undefined | null,
  valuesMap: VariableValuesMap,
  keepMissing = false,
): string {
  // Fast path: null/undefined → empty string
  if (!text) return '';

  const hasHtml = text.includes('<');
  let result = text;

  if (text.includes('{{')) {
    // Fast path: empty map → strip all tokens (or keep if keepMissing)
    if (Object.keys(valuesMap).length === 0) {
      result = keepMissing ? text : text.replace(VARIABLE_TOKEN_REGEX, '');
    } else {
      // Reset lastIndex before each use (regex has global flag)
      VARIABLE_TOKEN_REGEX.lastIndex = 0;

      result = text.replace(VARIABLE_TOKEN_REGEX, (_match: string, key: string) => {
        const trimmed = key.trim();
        const value = valuesMap[trimmed];
        if (value !== undefined) return value;
        return keepMissing ? _match : '';
      });
    }
  }

  if (hasHtml || result.includes('<')) {
    return sanitizeHtml(result);
  }
  return result;
}

/**
 * Batch interpolates an array of strings using the same values map.
 * More efficient than calling interpolateWithMap individually when processing
 * multiple fields (e.g., all blocks in a result page) with the same map.
 *
 * @param texts     Array of template strings. Null/undefined entries become ''.
 * @param valuesMap Pre-resolved flat map of variable key → string value.
 * @param keepMissing When true, unknown tokens are preserved. Default: false.
 * @returns Array of interpolated strings, same length as input.
 */
export function interpolateManyWithMap(
  texts: ReadonlyArray<string | undefined | null>,
  valuesMap: VariableValuesMap,
  keepMissing = false,
): string[] {
  // Early exit: if no values to substitute, process the whole batch in one pass
  if (Object.keys(valuesMap).length === 0) {
    return texts.map((text) => {
      if (!text) return '';
      if (!text.includes('{{')) return text;
      return keepMissing ? text : text.replace(VARIABLE_TOKEN_REGEX, '');
    });
  }
  return texts.map((text) => interpolateWithMap(text, valuesMap, keepMissing));
}
