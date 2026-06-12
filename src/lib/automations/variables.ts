/**
 * Resolves `{{variable}}` placeholders in action config from trigger payload.
 */
export function resolveConfigVariables(
  config: Record<string, unknown>,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const json = JSON.stringify(config);
  const resolved = json.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const cleanKey = key.trim();
    
    // 1. Direct match (e.g. "body.name", "1.body.name" if pre-flattened)
    if (payload[cleanKey] !== undefined) {
      return String(payload[cleanKey]);
    }
    
    // 2. Step prefix fallback (e.g. "1.body.name" -> "body.name")
    if (/^\d+\./.test(cleanKey)) {
      const strippedKey = cleanKey.replace(/^\d+\./, '');
      if (payload[strippedKey] !== undefined) {
        return String(payload[strippedKey]);
      }
    }
    
    // 3. Entity prefix fallback (e.g. "entity.displayName" -> "displayName" or "entityName")
    if (cleanKey.startsWith('entity.')) {
      const strippedKey = cleanKey.substring(7);
      if (payload[strippedKey] !== undefined) {
        return String(payload[strippedKey]);
      }
      if (strippedKey === 'displayName' && payload['entityName'] !== undefined) {
        return String(payload['entityName']);
      }
    }
    
    return match;
  });
  return JSON.parse(resolved);
}
