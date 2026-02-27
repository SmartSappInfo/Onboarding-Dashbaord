/**
 * Resolves variables in a text string using {{variable_name}} syntax.
 */
export function resolveVariables(text: string, variables: Record<string, any>): string {
  if (!text) return '';
  return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const cleanKey = key.trim();
    const value = variables[cleanKey];
    return value !== undefined ? String(value) : match;
  });
}
