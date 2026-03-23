# Testing Strategy & Guidelines

## 1. Unit & Integration (Vitest)
We use **Vitest** for its speed and compatibility with the Next.js/Vite ecosystem.

### What to Test
- **Pure Functions**: Any logic in `src/lib` that performs calculations or data transformations.
- **Hooks**: Custom hooks like `useUndoRedo` and `useDebounce`.
- **Atomic Components**: Standard ShadCN components to ensure theme consistency.

### Best Practices
- **Isolation**: Mock external dependencies (Firebase, Genkit) using Vitest mocks.
- **Coverage**: Aim for 80%+ coverage on `src/lib` files.
- **Naming**: Tests should be co-located or in `__tests__` folders using `.test.ts(x)` extension.

## 2. End-to-End (Playwright)
We use **Playwright** to verify cross-module workflows.

### Core Test Cases
1. **The "Full Loop"**:
   - Admin creates a Survey with scoring logic.
   - Admin generates a public link.
   - Public user completes the survey.
   - Admin verifies the response and AI summary in the results dashboard.
2. **The "Agreement"**:
   - Admin uploads a PDF.
   - Admin maps signature fields.
   - Public user signs the document.
   - Admin downloads the final high-fidelity PDF.

## 3. Accessibility (A11y)
- Use `eslint-plugin-jsx-a11y` to catch issues during development.
- Use Playwright's `axe-core` integration to run automated accessibility audits on public pages.
