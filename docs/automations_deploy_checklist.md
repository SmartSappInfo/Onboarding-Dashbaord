# Automations — Production Deploy Checklist

Complete these steps before marking automations as **production-ready**.

## 1. Firestore indexes

```bash
firebase deploy --only firestore:indexes
```

Required composite indexes (also in `firestore.indexes.json`):

- `automations`: `trigger` + `isActive`
- `automation_jobs`: `status` + `executeAt`

## 2. Environment variables (Firebase App Hosting)

`apphosting.yaml` maps runtime env to Secret Manager:

```yaml
env:
  - variable: CRON_SECRET
    secret: cron-secret
```

### One-time setup (production)

From repo root, with `gcloud` authenticated and project set:

```bash
chmod +x scripts/setup-automation-heartbeat-scheduler.sh
./scripts/setup-automation-heartbeat-scheduler.sh
```

This script:

1. Creates or updates Secret Manager secret `cron-secret`
2. Grants App Hosting backend access to the secret
3. Creates/updates Cloud Scheduler job `automation-heartbeat` (every minute) → `/api/cron/automation-heartbeat`

**Redeploy App Hosting** after the secret is created so the backend loads `CRON_SECRET`.

> `vercel.json` cron is only used on Vercel. Firebase App Hosting uses **Google Cloud Scheduler**, not Vercel Cron.

## 3. Verify cron

Manual smoke test (replace domain and secret):

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR_APP_HOSTED_URL/api/cron/automation-heartbeat"
```

Expected: `{ "success": true, "processed": N }`

Force a scheduler run:

```bash
gcloud scheduler jobs run automation-heartbeat --location=us-central1
```

## 4. Data migration (legacy blueprints)

**Staging first**, then production:

```bash
# Preview changes (no writes)
npx tsx scripts/migrate-automation-triggers.ts --dry-run

# Apply
npx tsx scripts/migrate-automation-triggers.ts
```

Migrates: `SCHOOL_*` triggers → `ENTITY_*`, `UPDATE_SCHOOL` → `UPDATE_ENTITY`, legacy `contactType` → `entityType`.

Post-migration audit in Firestore console:

- Query `automations` where `trigger` in `SCHOOL_CREATED`, `SCHOOL_STAGE_CHANGED` → should be **0**.

## 5. Functional smoke test

1. Create automation: **Entity Created** → **Add Note** (or tag action).
2. Create entity in scoped workspace → confirm run in **Automation Hub** ledger.
3. Add **Delay** node (1 minute) → confirm job in `automation_jobs` → wait for cron or click **Pulse Engine**.
4. Campaign with hook → confirm hook automation + any matching `CAMPAIGN_*` blueprint runs (Model A).

## 6. Rollback

- Pause Cloud Scheduler job `automation-heartbeat` if heartbeat causes issues.
- Set affected automations `isActive: false` in Firestore.
- Re-run migration is idempotent; no automatic rollback of renamed triggers.
