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

    // Build alias key list (e.g. entity.name <-> entity_name <-> entityName)
    const possibleKeys: string[] = [
      cleanKey,
      cleanKey.replace(/\./g, '_'),
      cleanKey.replace(/_/g, '.'),
    ];
    if (cleanKey === 'entity.name' || cleanKey === 'entity_name') {
      possibleKeys.push('entityName', 'displayName', 'organization_name', 'company');
    }
    if (cleanKey === 'contact.name' || cleanKey === 'contact_name') {
      possibleKeys.push('contactName', 'name', 'recipient_name');
    }

    // 1. Try to resolve variable value from Map
    let foundVal: unknown = undefined;
    for (const k of possibleKeys) {
      const val = valuesMap.get(k);
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        foundVal = val;
        break;
      }
    }

    if (foundVal !== undefined && foundVal !== null && String(foundVal).trim() !== '') {
      return String(foundVal);
    }

    // 2. User-defined inline fallback (e.g. {{entity.name|SmartSapp}}) takes priority over static defaults
    if (userFallback !== undefined && userFallback !== null && userFallback.trim() !== '') {
      return userFallback;
    }

    // 3. Pre-defined system fallback (__fallback__key)
    for (const k of possibleKeys) {
      const preFallback = valuesMap.get(`__fallback__${k}`);
      if (preFallback !== undefined && preFallback !== null && String(preFallback).trim() !== '') {
        return String(preFallback);
      }
    }

    return keepMissing ? match : '';
  });
}
