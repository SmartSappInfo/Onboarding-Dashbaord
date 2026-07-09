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
    const cleanKey = key.trim();
    const val = valuesMap.get(cleanKey);
    if (val !== undefined) return String(val);
    return keepMissing ? match : '';
  });
}
