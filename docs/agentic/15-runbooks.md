# Operational Runbooks & Emergency Procedures (Phase 0)
**Document 15 in the Agentic Architecture Suite**

---

## Runbook 1: Global Agent Kill-Switch Activation (Rule 60)

### When to Execute:
* An autonomous agent enters an unintended execution loop.
* Multiple anomalous outbound communications are flagged.
* Cloud Run resource quotas or LLM token budgets are spiking abnormally.

### Procedure (Zero Code Deployment Required):
1. Navigate to **`https://goadmin.smartsapp.com/backoffice/ai/security`**.
2. Authenticate as Superadmin.
3. Toggle the **"Emergency Kill-Switch: Suspend Autonomous Agent Execution"** switch to `OFF`.
4. This writes `{ autonomousExecutionEnabled: false, suspendedAt: ISO, suspendedBy: userId }` to Firestore `system_settings/ai_governance`.
5. All in-flight agent workers evaluate this flag before every tool call and immediately pause.

---

## Runbook 2: Tool Poisoning / Rug-Pull Remediation (Rule 14)

### When to Execute:
* The Security Command Center flags a `TOOL_FINGERPRINT_MISMATCH`.
* An external MCP server alters tool schemas or risk metadata without review.

### Procedure:
1. Identify the flagged tool ID in `/backoffice/ai/capabilities`.
2. Inspect the diff between `approvedSchemaHash` and `currentSchemaHash`.
3. If unauthorized: Click **"Revoke Tool Authorization"** to immediately block agent invocation.
4. If authorized: Complete security audit and click **"Approve New Version Fingerprint"**.

---

## Runbook 3: Cloud Run Deployment Rollback

### When to Execute:
* Cloud Run smoke test fails or production error rates spike post-deploy.

### Procedure:
1. Open Google Cloud Console → **Cloud Run** → Select `smartsapp-app` or `smartsapp-backoffice`.
2. Navigate to **Revisions**.
3. Select the prior healthy revision and click **"Manage Traffic"** → Route 100% of traffic to prior revision.
4. Verify smoke tests pass on `go.smartsapp.com` and `goadmin.smartsapp.com`.
