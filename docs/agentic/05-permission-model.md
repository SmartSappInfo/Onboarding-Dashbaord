# Unified Permission & Policy Model (Phase 0)
**Document 05 in the Agentic Architecture Suite**

---

## 1. The Effective Principal Formula (Rule 16)

In SmartSapp, an AI agent does not execute as an unrestricted super-user, nor does it inherit arbitrary user authority. Every agent execution evaluates an **Effective Principal** derived from the intersection of five authority boundaries:

$$\text{Effective Principal} = \text{User Authority} \cap \text{Agent Authority} \cap \text{Workspace Scope} \cap \text{Tool Scope} \cap \text{Active Policy}$$

```
                ┌─────────────────────────────────┐
                │         USER AUTHORITY          │ (Current user's RBAC role)
                └────────────────┬────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │         AGENT AUTHORITY         │ (Permitted domain tools)
                └────────────────┬────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │         WORKSPACE SCOPE         │ (Assigned workspace boundaries)
                └────────────────┬────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │           TOOL SCOPE            │ (Specific capability contract)
                └────────────────┬────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │          ACTIVE POLICY          │ (Time-of-day, budget, rate limits)
                └────────────────┬────────────────┘
                                 ▼
                     EFFECTIVE EXECUTION SCOPE
```

---

## 2. Risk Classification Levels (Rule 12 & Rule 21)

| Level | Classification | Examples | Autonomy & Human Gate |
| :--- | :--- | :--- | :--- |
| **`L0_READ`** | Read-Only | Contact search, view course curriculum, query metrics | Fully autonomous within workspace boundary |
| **`L1_INTERNAL_DRAFT`** | Proposal / Draft | Draft email follow-up, generate lesson outline, simulate scoring | Autonomous generation; no external side effects |
| **`L2_STATE_MUTATION`** | Internal Mutation | Update deal stage, add tag, enroll student, create task | Policy-controlled; requires TOCTOU version check |
| **`L3_EXTERNAL_COMMUNICATION_FINANCE`** | Outbound / Financial | Send email/WhatsApp, charge card, publish page | Explicit user approval or pre-approved bounded delegation |
| **`L4_PRIVILEGED_DESTRUCTIVE`** | Destructive / Admin | Delete workspace, rotate API key, purge records | Mandatory dual-control two-phase confirmation |

---

## 3. Non-Delegable Actions (Rule 17)

The following operations can **never** be delegated to an automated agent or sub-agent under any circumstances:
1. `admin.grant_permission` — Granting or elevating permissions of any user or agent.
2. `admin.rotate_credentials` — Regenerating API keys, OAuth secrets, or encryption vaults.
3. `admin.change_tenant_isolation` — Modifying multi-tenant isolation rules or database security rules.
4. `admin.disable_audit_logging` — Pausing or disabling security telemetry.
5. `billing.change_owner` — Transferring organization or workspace billing ownership.
6. `organization.delete` / `workspace.delete` — Deleting high-level tenant structures.

---

## 4. Approval Binding (Rule 22)

Human approvals for L3 and L4 operations are cryptographically bound to the exact payload hash and execution parameters:
```typescript
interface ApprovalBinding {
  approvalId: string;
  runId: string;
  capabilityId: string;
  payloadHash: string; // SHA-256 hash of the exact execution arguments
  policyVersion: string;
  expiresAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}
```
If execution arguments are altered after an approval is granted, the `payloadHash` mismatches and the execution engine rejects the call.

---

## Risk scale mapping (canonical: `RISK_LEVELS` in `src/platform/capabilities/contracts/risk-levels.ts`)

The source docs use four different scales. Code uses only the canonical names below.

| Canonical | Roadmap §4 | PRD §51 | Tools §4.2 | Agent execution rule |
| :--- | :--- | :--- | :--- | :--- |
| `L0_READ` | read | read | R0 | Autonomous within scope |
| `L1_INTERNAL_DRAFT` | — | low (drafts) | R1 | Autonomous within scope |
| `L2_STATE_MUTATION` | reversible | low / medium | R2 | Policy-controlled; version-checked |
| `L3_EXTERNAL_COMMUNICATION_FINANCE` | external, financial | high | R3 | Agents need a verified, payload-bound approval |
| `L4_PRIVILEGED_DESTRUCTIVE` | privileged | critical | R4 | Agents need a verified approval; often non-delegable |

`requiresHumanApproval: true` on a capability also requires a verified approval for agents, whatever its level.
