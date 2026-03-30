# Project Structure

## Root Organization

```
├── src/                    # Application source code
├── .kiro/                  # Kiro AI configuration and specs
├── docs/                   # Project documentation
├── scripts/                # Migration and utility scripts
└── public/                 # Static assets
```

## Source Directory (`src/`)

### Core Application (`src/app/`)

Next.js App Router structure with route-based organization:

- **`actions/`** - Server actions for data mutations
- **`api/`** - API route handlers
- **`lib/`** - Server-side business logic and utilities
- **Route directories** - Feature-based routes (dashboard, admin, campaign, forms, etc.)
- **`layout.tsx`** - Root layout with Firebase provider, GTM, and global styles
- **`page.tsx`** - Landing/home page

### Components (`src/components/`)

- **`ui/`** - shadcn/ui base components (buttons, dialogs, forms, etc.)
- **`dashboard/`** - Dashboard-specific components
- **`tags/`** - Tag management components
- **`shadcn-studio/`** - Studio/builder components
- **Root level** - Shared components (header, footer, sidebars, forms)

### Firebase (`src/firebase/`)

- **`firestore/`** - Firestore query helpers and schemas
- **`config.ts`** - Firebase client configuration
- **`provider.tsx`** - Firebase context provider
- **`client-provider.tsx`** - Client-side Firebase initialization
- **`error-emitter.ts`** - Centralized error handling
- **`non-blocking-*.tsx`** - Async initialization patterns

### Business Logic (`src/lib/`)

Server-side action files following naming convention `*-actions.ts`:

- **Entity Management**: `entity-actions.ts`, `workspace-entity-actions.ts`
- **Contact Operations**: `contact-adapter.ts` (legacy/new model bridge)
- **Tagging System**: `tag-actions.ts`, `scoped-tag-actions.ts`, `tag-*.ts` utilities
- **Messaging**: `messaging-actions.ts`, `messaging-engine.ts`, `bulk-messaging.ts`
- **Automation**: `automation-actions.ts`, `automation-engine.ts`, `automation-processor.ts`
- **Billing**: `billing-actions.ts`, `invoice-actions.ts`
- **Forms**: `survey-actions.ts`, `pdf-actions.ts`, `contract-actions.ts`
- **Migrations**: `entity-migrations.ts`, `migration-engine.ts`, `tag-migration.ts`
- **Import/Export**: `import-service.ts`, `export-service.ts`, `import-export/` directory
- **Core Types**: `types.ts` (comprehensive type definitions)
- **Utilities**: `utils.ts`, `data.ts`, `colors.ts`

### Context Providers (`src/context/`)

React context for global state:

- `TenantContext.tsx` - Organization/tenant context
- `WorkspaceContext.tsx` - Active workspace state
- `PerspectiveContext.tsx` - User perspective switching
- `TagCacheContext.tsx` - Tag data caching
- `GlobalFilterProvider.tsx` - Filter state management
- `NavigationContext.tsx` - Navigation state

### AI Integration (`src/ai/`)

- **`flows/`** - Genkit AI flow definitions
- **`genkit.ts`** - Genkit configuration
- **`dev.ts`** - Development server entry point

### Testing (`src/test/`, `src/e2e/`)

- **`src/test/setup.ts`** - Vitest configuration
- **`src/e2e/*.spec.ts`** - Playwright E2E tests
- **`src/lib/__tests__/`** - Unit tests co-located with business logic

### Hooks (`src/hooks/`)

Custom React hooks:

- `use-toast.ts` - Toast notifications
- `use-debounce.ts` - Debounced values
- `use-mobile.tsx` - Responsive breakpoint detection
- `use-undo-redo.ts` - Undo/redo state management
- `use-set-breadcrumb.ts` - Breadcrumb navigation

## Configuration Files

- **`next.config.ts`** - Next.js configuration with Sentry integration
- **`tsconfig.json`** - TypeScript compiler options
- **`tailwind.config.ts`** - Tailwind CSS configuration
- **`components.json`** - shadcn/ui component configuration
- **`.eslintrc.json`** - ESLint rules (Next.js + TypeScript + a11y)
- **`.prettierrc`** - Code formatting rules
- **`vitest.config.ts`** - Vitest test configuration
- **`playwright.config.ts`** - E2E test configuration

## Naming Conventions

### Files

- **Server actions**: `*-actions.ts` (e.g., `tag-actions.ts`)
- **Utilities**: `*-utils.ts` or `*-helpers.ts`
- **Types**: `types.ts` or `*-types.ts`
- **Tests**: `*.test.ts` or `__tests__/*.ts`
- **Components**: PascalCase (e.g., `AppSidebar.tsx`)
- **Routes**: kebab-case directories (e.g., `register-new-signup/`)

### Code

- **React components**: PascalCase
- **Functions/variables**: camelCase
- **Types/Interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **CSS classes**: kebab-case (Tailwind utilities)

## Import Patterns

Use path alias for all internal imports:

```typescript
import { Tag } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
```

## Data Flow Architecture

1. **UI Components** → Call server actions from `src/app/actions/`
2. **Server Actions** → Use business logic from `src/lib/*-actions.ts`
3. **Business Logic** → Query Firestore via `src/firebase/firestore/`
4. **Context Providers** → Manage client-side state in `src/context/`
5. **Adapter Layer** → `contact-adapter.ts` bridges legacy and new data models

## Multi-Tenancy Pattern

All data operations are scoped by:

1. **organizationId** - Top-level tenant isolation
2. **workspaceId** - Operational partition within organization
3. **Firestore security rules** - Enforce access control at database level

## Migration Strategy

The codebase supports dual-read patterns:

- Check `migrationStatus` field on entities
- Use adapter layer (`contact-adapter.ts`) for unified access
- Legacy `schools` collection coexists with `entities` + `workspace_entities`
- Migration scripts in `scripts/` directory handle data transformation
