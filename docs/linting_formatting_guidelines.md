# Code Quality: Linting & Formatting

## ESLint Standards
We follow the **Next.js Core Web Vitals** ruleset with additional strictness for:
- **No Unused Variables**: Prevents reference errors and clutter.
- **Effect Dependencies**: Ensures `useEffect` hooks have stable and correct dependency arrays.
- **Accessibility**: Enforces `aria-*` attributes and alt text on images.

## Prettier Configuration
To ensure the "Pro Max" UI code remains readable, we use:
- **Single Quotes**: `'example'`
- **Trailing Commas**: `es5`
- **Tab Width**: `2`
- **Semi-colons**: `true`

## Implementation Steps
1. **Modernization**: Update `package.json` to include `prettier` and `eslint-config-prettier`.
2. **Resolution**: Run `next lint --fix` to resolve existing minor violations.
3. **Validation**: Run `tsc --noEmit` to ensure type integrity across all routes.
