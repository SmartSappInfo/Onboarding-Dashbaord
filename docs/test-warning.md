# Test & Lint Warnings Documentation

This document logs all warning categories encountered during verification and test suite execution (`pnpm verify` / `pnpm test:run`).

---

## 1. Firebase Emulator / Ambient Credential Warnings
During test files bootstrap (such as `templates.test.ts` and `blocks.test.tsx`), the following warning is emitted:
```text
>>> [BOOTSTRAP] No valid service account credentials found. Using ambient credentials (may fail in development).
```
- **Cause**: Firebase Admin SDK initializes during test execution without local service account environment variables, defaulting to ambient credentials.
- **Resolution**: Safe to ignore in local vitest runs where emulators are mocked or run locally, but can be resolved by setting `GOOGLE_APPLICATION_CREDENTIALS` key pointing to a mock credential JSON.

---

## 2. ESLint Unused Variable Warnings
A total of **2,481 warning problems** exist in the codebase. Below is a breakdown of recurring patterns and examples:

### A. Unused Arguments in Mapping and Callbacks
Many callback parameters are defined but never referenced:
- `warning 'f' is defined but never used. Allowed unused args must match /^_/u` (multiple occurrences in test mocks).
- `warning 'userId' is defined but never used.` in `workspace-actions.ts`.
- **Resolution**: Prefix unused callback arguments with an underscore (e.g. `_f`, `_userId`) to conform to the ESLint rules.

### B. Unused Imports and Type Declarations
Many imports are kept in files after refactoring:
- `warning 'DuplicateStrategy' is defined but never used.` in `IngestionDeduplicator.test.ts`.
- `warning 'DEFAULT_ORG_FOOTER_HTML' is defined but never used.` in `org-footer-service.test.ts`.
- `warning 'resolveRecipientContacts' is defined but never used.` in `call-centre-service.ts`.
- `warning 'ResendTrigger' is defined but never used.` in `resend-job-service.ts`.
- `warning 'SurveyResultRule' is defined but never used.` in `survey-actions.ts`.
- `warning 'WorkspaceEntity', 'TaskStatus', 'TaskPriority', 'TaskCategory' are defined but never used.` in `task-actions.ts` / `task-server-actions.ts`.
- `warning 'Layout' is defined but never used.` in `types/dashboard.ts`.
- **Resolution**: Run automated cleanups or strip unused imports.

### C. Assigned Values / Variables Never Read
- `warning 'timestamp' and 'entityId' are assigned a value but never used.` in `signup-actions.ts`.
- `warning 'total' is assigned a value but never used.` in `tag-actions.ts`.
- `warning 'currentStageName' is assigned a value but never used.` in `workspace-entity-actions.ts`.
- `warning 'appSecret' and 'webhookVerifyToken' are assigned a value but never used.` in WhatsApp connections.
- **Resolution**: Strip assignment if side effects are absent, or prefix with `_` if temporarily retained.

### D. Caught Error Handlers Without Reference
- `warning 'readErr' is defined but never used` in `tag-actions.ts`.
- `warning 'error' / 'e' is defined but never used` in catches across `task-actions.ts` and `utils.ts`.
- **Resolution**: Replace catch block signature with `catch` instead of `catch (error)` or prefix with `_error`.

---

## 3. Router Integration Warnings (Vitest React DOM)
During component testing (such as `template-gallery.whatsapp.test.tsx`), the test outputs:
```text
Error: invariant expected app router to be mounted
```
- **Cause**: Client component `TemplateCard` invokes `useRouter()` from `next/navigation`. When rendered in Vitest JSDOM without a mocked App Router provider, Next.js throws an invariant error.
- **Resolution**: Wrap the component inside a mock App Router Context Provider in the test helper.
