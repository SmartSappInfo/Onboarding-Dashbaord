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
    return payload[cleanKey] !== undefined ? String(payload[cleanKey]) : match;
  });
  return JSON.parse(resolved);
}
