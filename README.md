# SmartSapp

SmartSapp is a multi-tenant, multi-vertical CRM and onboarding platform. A single product adapts its terminology and workflows to the customer's industry — school enrollment, SaaS, law, real estate, marketing, or consultancy — so the same engine presents as a school admissions tracker, a SaaS account manager, or a law-firm client system depending on configuration.

## Tech Stack

- **Framework**: Next.js 16 (App Router) · React 19
- **Language**: TypeScript
- **Backend**: Firebase — Firestore, Admin SDK, Storage; Server Actions
- **AI**: Google Genkit (`@genkit-ai/*`) flows for survey generation, email templates, PDF field detection, data extraction/normalization
- **UI**: Radix UI / shadcn primitives · Tailwind CSS · Framer Motion · dnd-kit (drag & drop) · Recharts · React Flow (automation canvas)
- **Tooling**: pnpm · Vitest · Playwright · ESLint · Prettier · Sentry

## Architecture

A **dual-tier contact model** in Firestore lets the same real-world contact be shared across isolated workspaces without duplication:

- `entities` — global identity record (name, logo, contacts, location, social links)
- `workspace_entities` — per-workspace operational record (pipeline stage, tags, assignees, status), keyed `${workspaceId}_${entityId}`

A **terminology layer** (`useTerminology`) reads industry-specific labels instead of hardcoding "Schools" or "Clients", so the UI re-skins itself per vertical.

## Key Features

- **Pipeline & Deals** — kanban board with drag-and-drop stage progression, comprehensive filtering, a list view, and native focal-contact tracking
- **Forms & Fields** — drag-and-drop form builder, field-pack seeding per vertical, autosave, and PDF form mapping
- **Visual Automation Builder** — node-based trigger → condition → action flows with a background runner
- **Messaging & Campaigns** — bulk compose with variable placeholders, throttled campaign sends, outbound webhooks with retry/backoff
- **Meetings & Scheduler** — booking funnels, Zoom / Google Calendar integration, host routing
- **Activity timeline, drop-off analytics, QR studio, reports, finance/invoicing**
- **Generative AI** — survey generation/modification/summarization, email templates, natural-language querying of survey data

## Getting Started

```bash
pnpm install
pnpm dev            # Next.js dev server on http://localhost:9002
```

Genkit AI flows (separate dev server):

```bash
pnpm genkit:dev     # or genkit:watch for hot reload
```

## Testing

```bash
pnpm test:run                 # unit + property tests (Vitest)
pnpm test:emulator            # Firestore-rules tests against the emulator
pnpm test:e2e                 # Playwright end-to-end
pnpm verify                   # lint + typecheck + test:run
```

Feature-scoped suites are available, e.g. `pnpm test:automation`, `pnpm test:tags`, `pnpm test:messaging`.

## Documentation

Per-feature specs live in [`docs/`](./docs). Historical session/status notes are archived under [`docs/archive/`](./docs/archive).

## Troubleshooting

### PDF Viewer "Failed to fetch" / CORS Error

If a PDF feature (e.g. the Doc Signing editor) shows a "Failed to fetch" or "CORS policy" error in the console, your domain isn't authorized to request files from your Firebase Storage bucket. Apply a CORS policy to the bucket.

**1. Create the bucket (if it doesn't exist)**

If `gcloud` returns `404 Not Found` for your bucket, create it: Firebase Console → **Build > Storage** → **Get Started**.

**2. Apply the CORS configuration**

```bash
gcloud storage buckets update gs://[YOUR_PROJECT_ID].appspot.com --cors-file=cors.json
```

Replace `[YOUR_PROJECT_ID]` with your Firebase Project ID. After this succeeds the PDF viewer will load files correctly.
