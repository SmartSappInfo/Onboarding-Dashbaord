# Building in CI and deploying to Cloud Run

## Why this exists

The identical `pnpm build` behaves completely differently on two machines:

| Builder | Spec | Result |
| --- | --- | --- |
| GitHub Actions `ubuntu-latest` | 4 vCPU / 16 GB | **4m27s**, passing on every push |
| App Hosting Cloud Build | 2 vCPU / 8 GB | **57m50s**, `INTERNAL_ERROR` |

Three production builds and the staging build all died at **57m49s ±1 second**. Their logs
end at line 562 of 563 — `Creating an optimized production build ...` — followed by 56
minutes of silence. The build never reaches TypeScript or page generation.

A 13× gap on 2× hardware is memory thrashing, not workload size. **The app is not too large
to build; that builder is too small for it.** The builder is not configurable: the build
runs with `options.pool: {}`, so it gets Cloud Build's default `e2-standard-2`, and
App Hosting exposes no way to change the machine or the 3600s timeout.

Every previous attempt — capping CPU workers, uncapping them, tuning the Rayon thread pool,
forcing routes dynamic — was tuning around a machine that could not do the job.

## What changed

Nothing about how the app is built. `pnpm build` is the same command. What changed is
**where** it runs, and that the result is shipped as a container instead of source.

- `next.config.ts` emits `output: 'standalone'` **only** when `BUILD_STANDALONE=true`.
  App Hosting rewrites `next.config` at build time, and the CI `build-verification` job
  expects ordinary output, so gating it means no existing build is affected.
- `Dockerfile` builds the standalone server in a multi-stage image and runs it as a
  non-root user.
- `.github/workflows/deploy-cloudrun.yml` builds the image, pushes it to Artifact Registry
  and deploys to Cloud Run.

## The trap in standalone output

`output: 'standalone'` ships **only files Next traced as module imports**. Anything read
from disk at runtime must be copied into the image explicitly, or it fails in production
while building and passing every test.

Two such reads exist today, and both are handled in the Dockerfile:

| Path | Read by | If missing |
| --- | --- | --- |
| `public/extension` | `api/lead-intelligence/extension/download/route.ts` | Extension download 500s |
| `data/disposable_email_blocklist.conf` | `lib/email-verifier.ts` | **Silently** degrades to a much smaller built-in list |

The second is the dangerous one — it does not error. If you add another runtime file read,
add it to the Dockerfile in the same commit.

## Infrastructure created

All in project `studio-9220106300-f74cb` (number `767767851953`).

| Resource | Name | Notes |
| --- | --- | --- |
| Workload Identity pool | `github-actions` | Keyless auth for CI |
| OIDC provider | `github` | **Restricted** to `assertion.repository_owner == 'SmartSappInfo'` |
| Deploy service account | `gh-deploy@…` | `roles/run.admin`, `roles/artifactregistry.writer` |
| Impersonation binding | — | Only `SmartSappInfo/Onboarding-Dashbaord` may impersonate the deployer |
| Runtime service account | `firebase-app-hosting-compute@…` | Reused; already holds `secretAccessor` on all eight secrets |
| Artifact Registry | `app-images` (us-central1) | Docker format |
| Cloud Run service | `smartsapp-app` | Created by the first deploy |

**No service-account JSON key exists anywhere.** This repository is public and has leaked
credentials before (see `docs/audit/app_audit.md`), so the pipeline authenticates through
Workload Identity Federation and the token is minted per-run and scoped to this one repo.

GitHub repo secrets hold only identifiers, not credentials: `GCP_WIF_PROVIDER`,
`GCP_DEPLOY_SA`, `GCP_RUNTIME_SA`.

## Runtime parity with App Hosting

The Cloud Run deploy mirrors the existing `studio` service exactly — 1 CPU, 1 Gi, min 0 /
max 10 instances, concurrency 80, same runtime service account, and the same eight Secret
Manager secrets mounted by reference:

```
cron-secret, whatsapp-encryption-key, resend-webhook-secret, resend-api-key,
mnotify-api-key, onesignal-app-id, onesignal-rest-api-key, CLOUD_TASKS_SECRET
```

Secrets are read at runtime and never baked into the image or passed as build args —
build args persist in image history, which is a common way credentials leak from containers.

`NEXT_PUBLIC_*` values are the exception: Next inlines them at build time, so
`NEXT_PUBLIC_APP_URL` is passed as a build arg. It is a public URL, not a secret.

## Deliberately not done yet

- **The service starts closed** (`--no-allow-unauthenticated`) and has no custom domain.
- **`go.smartsapp.com` still points at App Hosting.** Nothing in this pipeline touches
  production traffic. The cutover is a separate, reversible decision, taken only once this
  service has been shown to serve correctly on its own URL.
- **App Hosting is left in place** as the rollback path.

## Running it

Automatic on a push to `staging`. Manual via **Actions → Deploy to Cloud Run →
Run workflow**, typing `deploy` to confirm — the confirmation exists so an accidental
dispatch cannot deploy.

The workflow ends with a smoke test: it fetches `/login` from the new revision and fails
the job on anything that is not a 2xx or a redirect. A deploy that returns green without
serving a page is not a deploy worth reporting.
