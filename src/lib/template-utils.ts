/**
 * @fileOverview Template utility functions (synchronous, no server actions)
 * 
 * This file contains pure utility functions for template processing that don't
 * require database access or async operations. Separated from template-resolver.ts
 * to avoid Next.js Server Action constraints.
 */

// ---------------------------------------------------------------------------
// renderTemplate
// ---------------------------------------------------------------------------

/**
 * Replaces all `{{variable_name}}` placeholders in `body` with values from
 * the provided map. Any placeholder whose key is not present in the map is
 * replaced with an empty string.
 * 
 * @param body - Template string containing {{variable}} placeholders
 * @param variables - Key-value map of variable names to their values
 * @returns Rendered string with all placeholders replaced
 * 
 * @example
 * ```typescript
 * const template = "Hello {{name}}, welcome to {{organization}}!";
 * const vars = { name: "John", organization: "SmartSapp" };
 * const result = renderTemplate(template, vars);
 * // Result: "Hello John, welcome to SmartSapp!"
 * ```
 */
export function renderTemplate(body: string, variables: Record<string, any>): string {
  return body.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const trimmed = key.trim();
    const value = variables[trimmed];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

/**
 * Extracts all variable names from a template string.
 * 
 * @param body - Template string containing {{variable}} placeholders
 * @returns Array of unique variable names found in the template
 * 
 * @example
 * ```typescript
 * const template = "Hello {{name}}, your email is {{email}}. Welcome {{name}}!";
 * const vars = extractVariables(template);
 * // Result: ["name", "email"]
 * ```
 */
export function extractVariables(body: string): string[] {
  const variables = new Set<string>();
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  
  while ((match = regex.exec(body)) !== null) {
    const varName = match[1].trim();
    variables.add(varName);
  }
  
  return Array.from(variables);
}

/**
 * Validates that all variables in a template have corresponding values.
 * 
 * @param body - Template string containing {{variable}} placeholders
 * @param variables - Key-value map of variable names to their values
 * @returns Object with validation result and list of missing variables
 * 
 * @example
 * ```typescript
 * const template = "Hello {{name}}, your email is {{email}}";
 * const vars = { name: "John" };
 * const result = validateTemplateVariables(template, vars);
 * // Result: { isValid: false, missingVariables: ["email"] }
 * ```
 */
export function validateTemplateVariables(
  body: string,
  variables: Record<string, any>
): { isValid: boolean; missingVariables: string[] } {
  const requiredVars = extractVariables(body);
  const missingVariables = requiredVars.filter(
    (varName) => variables[varName] === undefined || variables[varName] === null
  );
  
  return {
    isValid: missingVariables.length === 0,
    missingVariables,
  };
}

/**
 * Checks if a string contains any template variables.
 * 
 * @param body - String to check for template variables
 * @returns True if the string contains at least one {{variable}} placeholder
 */
export function hasTemplateVariables(body: string): boolean {
  return /\{\{[^}]+\}\}/.test(body);
}

/**
 * Escapes special characters in a string to prevent injection attacks.
 * Use this when rendering user-provided content in templates.
 * 
 * @param value - String to escape
 * @returns Escaped string safe for HTML rendering
 */
export function escapeHtml(value: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return value.replace(/[&<>"'/]/g, (char) => map[char] || char);
}

/**
 * Renders a template with HTML escaping for all variable values.
 * Use this for email templates to prevent XSS attacks.
 * 
 * @param body - Template string containing {{variable}} placeholders
 * @param variables - Key-value map of variable names to their values
 * @returns Rendered string with all placeholders replaced and values escaped
 */
export function renderTemplateWithEscaping(
  body: string,
  variables: Record<string, any>
): string {
  return body.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const trimmed = key.trim();
    const value = variables[trimmed];
    if (value === undefined || value === null) return '';
    return escapeHtml(String(value));
  });
}
