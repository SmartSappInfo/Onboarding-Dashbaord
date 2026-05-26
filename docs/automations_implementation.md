# Automations — Implementation Tracker

**Spec (product behavior):** [feature_automations.md](./feature_automations.md)  
**Deploy checklist:** [automations_deploy_checklist.md](./automations_deploy_checklist.md)  
**Last updated:** 2026-05-26  
**Status:** **Code complete** — run deploy checklist in each environment to close the loop.

---

## Quick status

| Layer | Progress | Notes |
|-------|----------|-------|
| Event bus | Done | `buildAutomationPayload`, `after()` |
| Execution engine | Done | Repository + transactional job claims |
| Data model / migration | Ready | Script + `--dry-run`; **run in env** |
| Builder UI | Done | Test Flow, channel, run inspector, dynamic canvas |
| Ops | Ready | Cloud Scheduler + `scripts/setup-automation-heartbeat-scheduler.sh`; **run in prod** |
| Tests | Done | 40+ unit/integration tests |

---

## Phase checklist

### Phase 0 — Data integrity (P0)

- [x] **P0-1** Sync `automations.trigger` on save
- [ ] **P0-2** Run migration in staging → prod ([checklist](./automations_deploy_checklist.md) §4)
- [x] **P0-3** `buildAutomationPayload` on bus + campaign
- [x] **P0-4** `after()` from `next/server`

### Phase 1 — Campaign (Model A)

- [x] **P1-C1** Documented Model A
- [x] **P1-C2** `dispatchCampaignBlueprintTriggers`
- [x] **P1-C3** N/A (Model A chosen)
- [x] **P1-C4** `buildCampaignAutomationJobPayload` with `organizationId`, `workspaceId`, `entityId`, `action`
- [x] **P1-C5** Deterministic job doc IDs (`campaignAutomationJobDocId`)

### Phase 2 — Builder

- [x] **P2-1–5** Node inspectors + trigger filters
- [x] **P2-6** SEND_MESSAGE email/SMS channel + variable picker
- [x] **P2-7** Run inspector entity fields
- [x] **P2-8** `next/dynamic` for React Flow on edit page
- [x] **P2-9** Test Flow (`testAutomationFlowAction`)
- [x] **P2-10** Auto Layout removed (was no-op)

### Phase 3 — Engine hardening

- [x] **P3-1–4** Validation, permissions, CREATE_TASK, structured logs

### Phase 4 — Operations

- [x] **P4-1** Cron route + `setup-automation-heartbeat-scheduler.sh` (Firebase App Hosting)
- [x] **P4-2** Firestore indexes
- [ ] **P4-3** Execute [deploy checklist](./automations_deploy_checklist.md) per environment

### Phase 5 — Tests

- [x] **P5-1–6** All listed tests + delay resume + chain depth

---

## Definition of done

- [x] Code paths P0–P5 complete (except env-specific ops)
- [x] Risks R1, R3, R8 mitigated in code
- [ ] Legacy Firestore data migrated (P0-2 — **your action**)
- [x] Every node type configurable in NodeInspector
- [x] Campaign Model A
- [ ] Production cron verified live (P4-3)
- [x] Required tests green locally
- [x] Spec status table in `feature_automations.md`

---

## Notes / changelog

| Date | Note |
|------|------|
| 2026-05-26 | Engine split under `src/lib/automations/`; Firebase cron setup script; deploy checklist for App Hosting |
| 2026-05-26 | Loop closed in code: Test Flow, deploy checklist, campaign idempotency, P2 polish, delay/chain tests |
