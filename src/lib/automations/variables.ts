/**
 * Resolves `{{variable}}` placeholders in action config from trigger payload.
 * Supports:
 * - Direct core variable names (e.g. {{arrearsBalance}}, {{phone}}, {{email}})
 * - Step-prefixed variables (e.g. {{1.body.phone}} -> {{body.phone}} -> {{phone}})
 * - Body-prefixed variables (e.g. {{body.arrearsBalance}} -> {{arrearsBalance}})
 * - Headers/query prefixed variables (e.g. {{headers.content-type}}, {{1.headers.content-type}})
 * - Nested objects in payload.body
 * - Entity context variables (e.g. {{entity.displayName}} -> {{displayName}} / {{entityName}})
 */
export function resolveConfigVariables(
  config: Record<string, unknown>,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const json = JSON.stringify(config);
  const resolved = json.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const cleanKey = key.trim();
    
    // 1. Direct match (e.g. "arrearsBalance", "body.name", "1.body.name" if pre-flattened)
    if (payload[cleanKey] !== undefined) {
      return String(payload[cleanKey]);
    }
    
    // 2. Step prefix fallback (e.g. "1.body.name" -> "body.name" -> "name")
    if (/^\d+\./.test(cleanKey)) {
      const strippedKey = cleanKey.replace(/^\d+\./, '');
      if (payload[strippedKey] !== undefined) {
        return String(payload[strippedKey]);
      }
      if (strippedKey.startsWith('body.')) {
        const directProp = strippedKey.replace(/^body\./, '');
        if (payload[directProp] !== undefined) {
          return String(payload[directProp]);
        }
      }
    }
    
    // 3. body. prefix fallback (e.g. "body.arrearsBalance" -> "arrearsBalance")
    if (cleanKey.startsWith('body.')) {
      const directProp = cleanKey.replace(/^body\./, '');
      if (payload[directProp] !== undefined) {
        return String(payload[directProp]);
      }
    }

    // 4. Core variable lookup fallback in body/1.body
    if (payload[`body.${cleanKey}`] !== undefined) {
      return String(payload[`body.${cleanKey}`]);
    }
    if (payload[`1.body.${cleanKey}`] !== undefined) {
      return String(payload[`1.body.${cleanKey}`]);
    }

    // 5. Look inside nested payload.body object if present
    if (payload.body && typeof payload.body === 'object') {
      const bodyObj = payload.body as Record<string, unknown>;
      if (bodyObj[cleanKey] !== undefined) {
        return String(bodyObj[cleanKey]);
      }
    }
    
    // 6. Entity prefix fallback (e.g. "entity.displayName" -> "displayName" or "entityName")
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
