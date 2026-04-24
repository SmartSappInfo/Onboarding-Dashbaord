# Messaging Components

This directory contains components for the messaging template customization system.

## Components

### VariablePicker

A dropdown/popover component that displays available template variables grouped by context. Users can search/filter variables and click to insert them into the template editor.

**Features:**
- Search/filter functionality
- Variables grouped by context (Common, Meeting, Form, Survey, Agreement, Entity, Campaign)
- Click to insert `{{variable_name}}` at cursor position
- Displays variable label and example value
- Shows badges for dynamic and computed variables

**Usage:**

```tsx
import { VariablePicker } from '@/components/messaging/VariablePicker';
import { getVariablesForContext } from '@/lib/template-variable-registry';

function MyComponent() {
  const variables = getVariablesForContext('meeting');
  
  const handleVariableSelect = (variableName: string) => {
    // Insert variable at cursor position
    console.log(`Insert {{${variableName}}}`);
  };

  return (
    <VariablePicker
      variables={variables}
      onVariableSelect={handleVariableSelect}
      triggerLabel="Insert Variable"
    />
  );
}
```

### TemplateTextarea

A textarea component with visual highlighting of `{{variable}}` tokens. Uses an overlay technique to show highlighted variables while maintaining native textarea editing behavior.

**Features:**
- Highlights all `{{variable}}` tokens with blue pill style
- Shows tooltip on hover with variable information
- Displays variable count indicator
- Syncs scroll position between textarea and highlight overlay

**Usage:**

```tsx
import { TemplateTextarea } from '@/components/messaging/TemplateTextarea';

function MyComponent() {
  const [value, setValue] = React.useState('Hello {{contact_name}}');

  return (
    <TemplateTextarea
      value={value}
      onChange={setValue}
      placeholder="Enter your template content..."
      rows={8}
    />
  );
}
```

### TemplateEditorExample

Example integration showing how to use VariablePicker with TemplateTextarea. Demonstrates the complete workflow for variable insertion and highlighting.

**Usage:**

```tsx
import { TemplateEditorExample } from '@/components/messaging/TemplateEditorExample';

function MyComponent() {
  const handleChange = (value: string) => {
    console.log('Template changed:', value);
  };

  return (
    <TemplateEditorExample
      context="meeting"
      initialValue="Hello {{contact_name}}"
      onChange={handleChange}
      label="Template Body"
    />
  );
}
```

## Hooks

### useTemplateEditor

Hook for managing template editor state and variable insertion.

**Features:**
- Insert variables at cursor position
- Track cursor position in textarea
- Extract all variables from template text

**Usage:**

```tsx
import { useTemplateEditor } from '@/hooks/use-template-editor';

function MyComponent() {
  const {
    value,
    setValue,
    textareaRef,
    insertVariable,
    handleSelectionChange,
    variables,
  } = useTemplateEditor('Hello {{name}}');

  return (
    <div>
      <button onClick={() => insertVariable('meeting_time')}>
        Insert Meeting Time
      </button>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onSelect={handleSelectionChange}
      />
      <div>Variables: {variables.join(', ')}</div>
    </div>
  );
}
```

## Utilities

### parseTemplateText

Utility function to parse template text and extract variable tokens for rendering.

**Usage:**

```tsx
import { parseTemplateText } from '@/hooks/use-template-editor';

const segments = parseTemplateText('Hello {{name}}, your meeting is at {{time}}');
// Returns:
// [
//   { text: 'Hello ', isVariable: false },
//   { text: '{{name}}', isVariable: true, variableName: 'name' },
//   { text: ', your meeting is at ', isVariable: false },
//   { text: '{{time}}', isVariable: true, variableName: 'time' },
// ]
```

## Testing

All components and hooks have comprehensive unit tests:

- `src/components/messaging/__tests__/VariablePicker.test.tsx`
- `src/hooks/__tests__/use-template-editor.test.ts`

Run tests with:

```bash
pnpm test src/components/messaging/__tests__/VariablePicker.test.tsx
pnpm test src/hooks/__tests__/use-template-editor.test.ts
```

## Implementation Notes

### Variable Highlighting

The TemplateTextarea uses an overlay technique to highlight variables:

1. A transparent overlay div is positioned absolutely over the textarea
2. The overlay contains the same text as the textarea with highlighted variables
3. The textarea has a transparent text color so the overlay shows through
4. Scroll positions are synced between textarea and overlay

This approach maintains native textarea behavior (cursor, selection, etc.) while providing visual highlighting.

### ResizeObserver Mock

The test setup includes a ResizeObserver mock for Radix UI's ScrollArea component:

```typescript
// src/test/setup.ts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
```

This is required for tests to run successfully.
