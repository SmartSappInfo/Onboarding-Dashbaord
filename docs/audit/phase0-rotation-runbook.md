# Phase 0 — Credential rotation runbook

**Status as of 2026-09-12: NOT STARTED. The leaked keys are the live production keys.**

This is console work in your provider dashboards. There is no code change, and nothing here
needs a deploy except step 4.

---

## What was verified today, and how

Not inferred — measured:

| Check | Method | Result |
| --- | --- | --- |
| Repo is publicly readable | `api.github.com/repos/SmartSappInfo/Onboarding-Dashbaord` with no credentials | **200 · `visibility: public`** · 0 forks |
| `.env` / `.env.local` are in history | `git log --all --diff-filter=A -- '.env*'` | Both present, across 6 commits — one titled *"Push Keys temporarily"* |
| Leaked values are still live | SHA-256 of the value in git history vs. SHA-256 of `gcloud secrets versions access latest` | **Identical for all three** |
| Secrets have never been rotated | `gcloud secrets versions list` | `resend-api-key`, `mnotify-api-key`, `onesignal-rest-api-key` each have **one version, created 2026-06-28** |

No secret value was printed at any point in that verification — only hash prefixes were
compared.

**What this means in practice.** Anyone who clones the public repo and runs one `git log`
command can send email from your domain, send SMS billed to your mNotify account, and push a
notification to every user of the app. No sign-in, no exploit, no skill required.

---

## Order of operations

For each key: **create the new one → update the store → verify → only then revoke the old
one.** Revoking first causes an outage; revoking last means a leaked key stays live slightly
longer, which is the lesser harm given it has already been live for months.

---

## Step 1 — The three provider keys wired through Secret Manager

Rotate in the console, then add a new secret version. `--data-file=-` with `printf` avoids
writing the key to a file or leaving it in shell history with a trailing newline.

| Key | Console | Why it matters |
| --- | --- | --- |
| `MNOTIFY_API_KEY` | mNotify dashboard | Direct financial spend — highest abuse value |
| `RESEND_API_KEY` | Resend → API Keys | Domain reputation; phishing sent as you |
| `ONESIGNAL_REST_API_KEY` | OneSignal → Settings → Keys | Can push to every user |

```bash
printf '%s' 'NEW_MNOTIFY_VALUE'   | gcloud secrets versions add mnotify-api-key --data-file=-
printf '%s' 'NEW_RESEND_VALUE'    | gcloud secrets versions add resend-api-key --data-file=-
printf '%s' 'NEW_ONESIGNAL_VALUE' | gcloud secrets versions add onesignal-rest-api-key --data-file=-
```

The Cloud Run deploy references these by name and resolves `latest` at deploy time, so a new
version is picked up on the next deploy — see step 4.

## Step 2 — The two AI keys, which do NOT come from environment variables

`src/ai/genkit.ts` resolves an AI key through a four-step precedence chain. The environment
variable is the *last* fallback, so rotating it alone changes nothing for a tenant that has
its own key stored.

Priority order: per-org Firestore field → sealed global default → env var → built-in.

**Five per-org overrides exist and each must be updated individually.** Until an org's own
value is replaced, that tenant keeps using the leaked key regardless of what you change
globally:

| Organization | Field | Stored as | Ends with |
| --- | --- | --- | --- |
| KIS (`kis`) | `geminiApiKey` | plaintext | `Lcgc` |
| KIS (`kis`) | `openRouterApiKey` | plaintext | `04a0` |
| SmartSapp (`smartsapp-hq`) | `geminiApiKey` | plaintext | `S2t0` |
| SmartSapp (`smartsapp-hq`) | `openRouterApiKey` | plaintext | `c50b` |
| Minex360 (`smartsapp_hq`) | `geminiApiKey` | plaintext | `123!` |

Update each at **Settings → Integrations** for that organization.

Two things worth noticing in that table:

- These are stored **in plaintext** in Firestore, unlike the global default which is sealed
  via `sealSecret`. That is audit finding F16 and is a separate problem from this rotation.
- The Minex360 value ending `123!` does not look like a real Gemini key. It is probably a
  placeholder someone typed. If so that tenant's AI calls are silently falling through to the
  next priority level — worth checking while you are in there.

Re-run the audit any time to regenerate this table:

```bash
npm run audit:ai-keys
```

The backoffice global fallback (`system_settings/ai_keys`) is currently **not set** for any
provider, so there is nothing to rotate there — but once the per-org values are cleaned up,
setting it at `/backoffice/settings/system-defaults` is the right home for a shared key,
because that path seals the value at rest.

## Step 3 — The remaining two

| Key | Console | Note |
| --- | --- | --- |
| `OPENAI_API_KEY` | platform.openai.com → API keys | Revoke old after verifying |
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens | Build-time only; used for sourcemap upload |

## Step 4 — Redeploy, then revoke

Push to `main`. The GitHub Actions workflow rebuilds both surfaces (~4m30s) and re-resolves
every Secret Manager reference to `latest`.

Verify before revoking anything:

- Send one test email and one test SMS from the app.
- Confirm the Cloud Run revision is the new one:
  `gcloud run services describe smartsapp-app --region=us-central1 --format='value(status.latestReadyRevisionName)'`

Then revoke the old keys in each provider console.

---

## If you see abuse before you finish rotating

You have a kill switch that needs no deploy — built in Stage A of the backoffice isolation
work. Go to **`/backoffice/operations/platform-controls`** and pause outbound messaging. It
stops email, SMS, push and WhatsApp at the provider boundary within 30 seconds (the cache
TTL), across every code path including bulk upload.

That stops *your app* sending. It does not stop someone using the stolen key directly against
the provider — only revoking the key does that.

---

## What this does not fix

Rotation makes the leaked keys worthless. It does not remove them from git history — anyone
can still read the old values, they will simply no longer work. Purging history is **Phase 2**
of the audit plan, and it is gated on this phase being finished. Do not start Phase 2 first:
a history rewrite invalidates every clone and fork, and doing it while the keys are still
live buys nothing.

Related: `docs/audit/app_audit_fix.md` (Phase 0, Phase 2), `docs/audit/app_audit.md` (F1, F16).
