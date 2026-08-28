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
export const VARIABLE_TOKEN_REGEX = /\{\{([^}]+)\}\}/g;

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
import DOMPurify from 'isomorphic-dompurify';
import { resolveTextWithMap } from '@/lib/utils/variable-replacer';

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['form', 'iframe', 'script', 'object', 'embed'],
    ADD_ATTR: ['target', 'rel'],
  });
}

export function interpolateWithMap(
  text: string | undefined | null,
  valuesMap: VariableValuesMap,
  keepMissing = false,
): string {
  // Fast path: null/undefined → empty string
  if (!text) return '';
  if (!text.includes('{{')) {
    return text;
  }

  const map = new Map<string, unknown>();
  if (valuesMap) {
    Object.entries(valuesMap).forEach(([k, v]) => {
      map.set(k, v);
    });
  }

  return resolveTextWithMap(text, map, keepMissing);
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
  if (!texts || texts.length === 0) return [];

  const map = new Map<string, unknown>();
  if (valuesMap) {
    Object.entries(valuesMap).forEach(([k, v]) => {
      map.set(k, v);
    });
  }

  return texts.map((text) => {
    if (!text) return '';
    if (!text.includes('{{')) return text;
    return resolveTextWithMap(text, map, keepMissing);
  });
}
