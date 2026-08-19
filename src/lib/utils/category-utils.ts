/**
 * @fileoverview Central Media Category & Firestore Payload Utilities
 * 
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 1. Scope & Single Source of Truth:
 *    Media categories are tenant-scoped per workspace. Baseline categories ('General', 'Marketing', 'Messaging')
 *    coexist with user-created categories.
 * 2. Deterministic Identity:
 *    Category document IDs in Firestore `media_categories` are formatted as `${workspaceId}_${slug}`.
 *    This guarantees idempotence and prevents race-condition duplicate creation across concurrent client mounts.
 * 3. Deduplication:
 *    Always route category lists through `deduplicateCategories` before rendering in Select, Dropdown, or Combobox
 *    UI controls to prevent Radix UI duplicate key concatenation issues (e.g. "GeneralGeneral").
 * 4. Payload Sanitization:
 *    `sanitizeFirestorePayload` recursively removes `undefined` properties, preventing Firebase JS SDK client crashes
 *    when saving objects with nullish optional metadata fields (e.g. duration, preview images).
 * 
 * Caution Areas:
 * - Do not remove case-insensitive trimming when matching categories.
 * - Preserve original casing of the first encountered instance when deduplicating.
 */

import type { MediaCategory } from '@/lib/types';

/**
 * Generates a URL-safe, normalized slug from a category name.
 */
export function slugifyCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general';
}

/**
 * Computes a deterministic Firestore document ID for a workspace category.
 * Example: workspace "onboarding" + category "School Visibility" -> "onboarding_school-visibility"
 */
export function getDeterministicCategoryId(workspaceId: string, categoryName: string): string {
  const safeWorkspace = (workspaceId || 'global').trim();
  const slug = slugifyCategoryName(categoryName);
  return `${safeWorkspace}_${slug}`;
}

/**
 * Deduplicates a list of `MediaCategory` objects by normalized name (case-insensitive and trimmed).
 * Preserves display casing of the first occurrence and sorts standard categories to the front.
 */
export function deduplicateCategories(categories: readonly MediaCategory[]): MediaCategory[] {
  if (!categories || categories.length === 0) return [];

  const seen = new Set<string>();
  const deduplicated: MediaCategory[] = [];

  for (const cat of categories) {
    if (!cat || !cat.name) continue;
    const normalized = cat.name.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    deduplicated.push({
      ...cat,
      name: cat.name.trim(),
    });
  }

  return deduplicated;
}

/**
 * Deduplicates and normalizes an arbitrary list of category strings or MediaCategory objects.
 */
export function getUniqueCategoryNames(items: readonly (MediaCategory | string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    if (!item) continue;
    const rawName = typeof item === 'string' ? item : item.name;
    if (!rawName) continue;

    const trimmed = rawName.trim();
    const normalized = trimmed.toLowerCase();

    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(trimmed);
    }
  }

  return result;
}

/**
 * Recursively cleans an object payload for Firestore writes by removing `undefined` keys.
 * Firebase client SDK throws `Unsupported field value: undefined` if any property is `undefined`.
 */
export function sanitizeFirestorePayload<T extends object>(data: T): Partial<T> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue; // Strip undefined values completely
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // Check if it's a plain object (not a special Firestore FieldValue or Date)
      const proto = Object.getPrototypeOf(value);
      if (proto === Object.prototype || proto === null) {
        sanitized[key] = sanitizeFirestorePayload(value as object);
        continue;
      }
    }

    sanitized[key] = value;
  }

  return sanitized as Partial<T>;
}
