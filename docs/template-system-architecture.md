# Template System Architecture

## Overview

The messaging template system is split into two main modules to comply with Next.js Server Actions requirements:

1. **`template-utils.ts`** - Pure utility functions (synchronous, no database access)
2. **`template-resolver.ts`** - Server actions (async, database operations)

## Module Separation

### Why the Split?

Next.js requires that files with the `'use server'` directive only export async functions (Server Actions). Since `renderTemplate` is a synchronous utility function that doesn't need database access, it was moved to a separate module.

### template-utils.ts (Pure Utilities)

**Purpose**: Synchronous template processing functions that work with strings and objects.

**Key Functions**:
- `renderTemplate(body, variables)` - Replaces `{{variable}}` placeholders with values
- `extractVariables(body)` - Extracts all variable names from a template
- `validateTemplateVariables(body, variables)` - Checks if all variables are provided
- `hasTemplateVariables(body)` - Checks if a string contains template variables
- `escapeHtml(value)` - Escapes HTML special characters
- `renderTemplateWithEscaping(body, variables)` - Renders with HTML escaping for security

**Characteristics**:
- ✅ No `'use server'` directive
- ✅ All functions are synchronous
- ✅ No database or external API calls
- ✅ Pure functions (same input → same output)
- ✅ Can be used in both client and server components

### template-resolver.ts (Server Actions)

**Purpose**: Async functions that resolve templates from the database and build variable contexts.

**Key Functions**:
- `resolveTemplateForOrg(category, type, orgId)` - Resolves org override or global template
- `buildVariableMap(context, resolutionCtx)` - Fetches variable values from Firestore
- `resolveAndRender(category, type, orgId, resolutionCtx)` - Full pipeline: resolve → build vars → render

**Characteristics**:
- ✅ Has `'use server'` directive
- ✅ All functions are async
- ✅ Performs Firestore queries
- ✅ Re-exports `renderTemplate` for backward compatibility
- ✅ Only usable in server components and server actions

## Usage Examples

### Client-Side Template Rendering

```typescript
import { renderTemplate, validateTemplateVariables } from '@/lib/template-utils';

// In a client component
function TemplatePreview({ template, variables }) {
  // Validate variables
  const validation = validateTemplateVariables(template, variables);
  
  if (!validation.isValid) {
    console.warn('Missing variables:', validation.missingVariables);
  }
  
  // Render template
  const rendered = renderTemplate(template, variables);
  
  return <div>{rendered}</div>;
}
```

### Server-Side Template Resolution

```typescript
'use server';

import { resolveAndRender } from '@/lib/template-resolver';

export async function sendMeetingInvitation(meetingId: string, orgId: string) {
  // Resolve template and render with meeting data
  const { subject, body } = await resolveAndRender(
    'meetings',
    'meeting_invitation',
    orgId,
    { meetingId }
  );
  
  // Send email with rendered content
  await sendEmail({ subject, body });
}
```

### Backward Compatibility

Existing code that imports `renderTemplate` from `template-resolver.ts` continues to work:

```typescript
// This still works (re-exported from template-utils)
import { renderTemplate } from '@/lib/template-resolver';

const result = renderTemplate('Hello {{name}}', { name: 'John' });
```

## Security Considerations

### XSS Prevention

When rendering user-provided content in HTML emails, use `renderTemplateWithEscaping`:

```typescript
import { renderTemplateWithEscaping } from '@/lib/template-utils';

// User input is escaped
const template = '<p>Hello {{name}}</p>';
const vars = { name: '<script>alert("XSS")</script>' };
const safe = renderTemplateWithEscaping(template, vars);
// Result: <p>Hello &lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;</p>
```

### Variable Validation

Always validate variables before rendering to prevent missing data:

```typescript
import { validateTemplateVariables, renderTemplate } from '@/lib/template-utils';

const template = 'Hello {{name}}, your email is {{email}}';
const vars = { name: 'John' };

const validation = validateTemplateVariables(template, vars);
if (!validation.isValid) {
  throw new Error(`Missing variables: ${validation.missingVariables.join(', ')}`);
}

const rendered = renderTemplate(template, vars);
```

## Testing

### Unit Tests

All utility functions have comprehensive unit tests in `src/lib/__tests__/template-utils.test.ts`:

```bash
# Run template utility tests
pnpm test:run src/lib/__tests__/template-utils.test.ts
```

### Test Coverage

- ✅ Variable replacement (single, multiple, duplicate)
- ✅ Whitespace handling
- ✅ Missing variables
- ✅ Null/undefined values
- ✅ Type conversion (numbers, booleans)
- ✅ Variable extraction
- ✅ Variable validation
- ✅ HTML escaping
- ✅ Edge cases (empty templates, no variables)

## Performance

### Rendering Performance

- Simple templates (< 10 variables): < 1ms
- Complex templates (> 10 variables): < 5ms
- Regex-based replacement is highly optimized

### Caching Strategy

For high-volume scenarios, cache rendered templates:

```typescript
import { renderTemplate } from '@/lib/template-utils';

const cache = new Map<string, string>();

function getCachedRender(template: string, variables: Record<string, any>): string {
  const cacheKey = `${template}:${JSON.stringify(variables)}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }
  
  const rendered = renderTemplate(template, variables);
  cache.set(cacheKey, rendered);
  
  return rendered;
}
```

## Migration Guide

### Before (Build Error)

```typescript
'use server';

// ❌ Error: Server Actions must be async functions
export function renderTemplate(body: string, variables: Record<string, any>): string {
  return body.replace(/\{\{([^}]+)\}\}/g, (_, key) => variables[key.trim()] ?? '');
}
```

### After (Fixed)

```typescript
// template-utils.ts (no 'use server')
export function renderTemplate(body: string, variables: Record<string, any>): string {
  return body.replace(/\{\{([^}]+)\}\}/g, (_, key) => variables[key.trim()] ?? '');
}

// template-resolver.ts (with 'use server')
'use server';
import { renderTemplate } from './template-utils';
export { renderTemplate }; // Re-export for backward compatibility
```

## Related Documentation

- [Template Management System](../specs/messaging-template-customization/design.md)
- [Variable Registry](./template-variable-registry.md)
- [Server Actions Best Practices](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
