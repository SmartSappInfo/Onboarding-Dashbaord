## What and why

<!-- One or two sentences. Link the plan item, e.g. docs/agents_mcp/phases/agents_mcp_phase_1_build_plan.md PR-4. -->

## Affected features (build plan A18)

| Touched | Also affected | Verified by | Backoffice gains |
| :--- | :--- | :--- | :--- |
|  |  |  |  |

## Verification

- [ ] `pnpm typecheck`
- [ ] `pnpm lint` (no new errors)
- [ ] `pnpm test:run` (includes the server-action guard sweep)
- [ ] `pnpm test:agentic:baseline`
- [ ] `pnpm test:rules:ci` if `firestore.rules` / indexes changed
- [ ] Browser check of changed screens (desktop + mobile width)

## Deployment

- [ ] No rules / indexes / migrations in this PR, **or** the deploy order is written below and approved
- [ ] Nothing ships to production without explicit approval (Rule 5)

## Agent Implementation Gate (`agents_mcp_rules.md` §67)

Answer each line. "N/A" needs a reason.

- **Architecture:** canonical capability used · duplicates an existing service? · source of truth · events emitted
- **Authority:** who may use it · what agents may / may never do · can a sub-agent inherit it?
- **Data:** what enters / leaves · trusted vs untrusted · sensitive data
- **Execution:** idempotent? retry? cancel? duplicate? record changed underneath? response lost?
- **MCP:** protocol + SDK version · annotations · schema version · what if the definition changes?
- **Failure:** timeout · 429 · 500 · partial execution · provider down · stale approval · concurrent edit
- **Security:** prompt injection · tool poisoning · confused deputy · SSRF · exfiltration · escalation · cross-tenant
- **Operations:** can Backoffice disable / inspect / replay / roll back / change policy without code?
- **Testing:** unit · integration · contract · E2E · security · tenant isolation · adversarial · load · chaos
- **Migration:** behaviour, routes and data preserved? backfill? restore and rollback documented?
