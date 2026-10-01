# Dependency governance records (Rule 53, amendment A10)

One record per dependency the agentic platform adds or promotes. Each records the version, licence, maintenance, known advisories, bundle impact and peer compatibility at the time of adoption. API usage is checked against current docs (Context7) before writing code.

## google-auth-library

| Field | Value |
| :--- | :--- |
| Added in | agents_mcp PR-2 (2026-10-01), as a **direct** dependency |
| Version | `10.9.1`, pinned exactly. It was already in the tree as a transitive dependency (via `@google-cloud/*` and `firebase-admin`); promoting it deduplicated one transitive `10.6.2` copy onto `10.9.1`. `9.15.1` and `10.5.0` remain transitive for other packages. |
| Licence | Apache-2.0 |
| Maintenance | Google (`googleapis/google-cloud-node`); official client for Google OAuth 2.0 and ID tokens. Actively released. |
| Advisories | `pnpm audit`: none on the package or its chain (`gaxios`, `gcp-metadata`, `jws`, `ecdsa-sig-formatter`) at adoption. |
| Bundle impact | **Server only.** Imported by `src/lib/security/cloud-tasks-auth.ts` and dynamically by `src/lib/gcp-tasks-client.ts`; the client-leak scan reports 0 client-reachable imports. |
| Peer compatibility | Requires Node ≥ 18; the app requires Node ≥ 22.13. No peer dependencies. |
| Why | Verify the Google-signed OIDC token Cloud Tasks attaches to worker requests (`OAuth2Client.verifyIdToken` with audience, then the payload's `email` / `email_verified`), and fetch an ID token for direct worker calls (`GoogleAuth.getIdTokenClient(audience).idTokenProvider.fetchIdToken`). |
| Docs checked | Context7 `/googleapis/google-auth-library-nodejs`: `verifyIdToken(options: { idToken, audience?: string \| string[], maxExpiry? })`; `getIdTokenClient(targetAudience)`. |
| Upgrade note | `11.x` exists. Upgrade deliberately (re-read the changelog for `verifyIdToken` / `getIdTokenClient`), not via a range. |

OpenTelemetry (`@opentelemetry/api`, the SDK and the Google Cloud Trace exporter) gets its record in PR-4, when it is added.
