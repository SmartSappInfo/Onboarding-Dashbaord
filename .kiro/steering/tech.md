# Tech Stack

## Framework & Runtime

- **Next.js 16.2.1** (App Router) with React 19.2.1
- **TypeScript 5** with strict mode enabled
- **Node.js** with ES2017 target
- **pnpm** package manager (v10.32.1)

## Backend & Database

- **Firebase** (v11.9.1) - Authentication, Firestore, Storage
- **Firebase Admin SDK** (v12.7.0) - Server-side operations
- **Firestore** - Primary database with multi-tenant data isolation

## AI & Automation

- **Genkit** (v1.20.0) - AI flow orchestration
- **Google Gemini** (@genkit-ai/google-genai) - LLM integration

## UI & Styling

- **Tailwind CSS** (v3.4.1) with custom configuration
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - Component library built on Radix
- **Framer Motion** (v12.34.0) - Animations
- **Lucide React** - Icon system
- **next-themes** - Dark mode support

## Forms & Validation

- **React Hook Form** (v7.54.2) with Zod resolvers
- **Zod** (v3.24.2) - Schema validation

## Testing

- **Vitest** (v2.1.8) - Unit testing
- **@testing-library/react** - Component testing
- **Playwright** - E2E testing
- **fast-check** - Property-based testing
- **@firebase/rules-unit-testing** - Firestore rules testing

## Code Quality

- **ESLint** with Next.js, TypeScript, and jsx-a11y plugins
- **Prettier** (v3.5.3) - Code formatting
- **TypeScript** strict mode with path aliases (@/*)

## Monitoring

- **Sentry** (@sentry/nextjs v10.45.0) - Error tracking and performance monitoring

## Common Commands

```bash
# Development
pnpm dev                    # Start dev server on port 9002
pnpm genkit:dev            # Start Genkit AI dev server
pnpm genkit:watch          # Start Genkit with hot reload

# Building
pnpm build                 # Production build (4GB memory allocation)
pnpm typecheck             # Type checking without emit

# Code Quality
pnpm lint                  # Run ESLint
pnpm format                # Format with Prettier
pnpm verify                # Run lint + typecheck + tests

# Testing
pnpm test                  # Run Vitest in watch mode
pnpm test:run              # Run tests once
pnpm test:emulator         # Run tests with Firebase emulator
pnpm test:e2e              # Run Playwright E2E tests
pnpm test:e2e:ui           # Run E2E tests with UI

# Migrations
pnpm migrate:tags          # Migrate tag data
pnpm migrate:entity-tags   # Migrate entity tag associations
pnpm migrate:schools       # Migrate schools to entities model
```

## Build Configuration

- Memory allocation: 4GB for Next.js builds
- Module resolution: bundler strategy
- Path aliases: `@/*` maps to `src/*`
- Image optimization: Multiple remote patterns configured
- Webpack optimizations: Deterministic module IDs, server-only fallbacks

## Development Notes

- Dev server runs on port 9002 (not default 3000)
- HMR allowed from network IP 10.155.120.120
- Firebase emulators used for local testing
- Sentry integration for production monitoring
- Never Use cat for writing files
