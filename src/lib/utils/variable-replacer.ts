/**
 * PURE, client-safe utility to substitute double-brace variables in template strings.
 * Extracted to avoid client/server dependency leakage during UI builds.
 */
export function resolveTextWithMap(
  templateText: string,
  valuesMap: Map<string, unknown>,
  keepMissing = true
): string {
  if (!templateText) return '';
  return templateText.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const parts = key.split(/\|\||\|/);
    const cleanKey = parts[0].trim();
    const userFallback = parts.length > 1 ? parts.slice(1).join('|').trim() : undefined;

    // 1. Try to resolve variable
    const val = valuesMap.get(cleanKey);
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val);
    }

    // 2. Pre-defined fallback
    const preFallback = valuesMap.get(`__fallback__${cleanKey}`);
    if (preFallback !== undefined && preFallback !== null && String(preFallback).trim() !== '') {
      return String(preFallback);
    }

    // 3. User-defined fallback (last option)
    if (userFallback !== undefined && userFallback !== null && userFallback.trim() !== '') {
      return userFallback;
    }

    return keepMissing ? match : '';
  });
}
