# Bulk Entity Workspace Management (Multi-Workspace Assign & Remove) Implementation Plan

> **Goal:** Enable users to manage workspace assignments for bulk contacts directly from the Entities directory. When multiple entities are selected, "Manage Workspaces" in the More Actions dropdown opens an interactive, accessible modal allowing users to assign all selected entities to one or more workspaces (skipping already assigned entities idempotently) or remove them from selected workspaces.

---

### Governance & Compliance Review against `agent_mcp_rules.md`

#### A. Applicable Rules & Specific Adherence

| Rule # | Rule Name | How This Plan Conforms |
| :--- | :--- | :--- |
| **Rule 1** | **Framework & Best Practices** | Conforms to Next.js 16 (App Router), `vercel-react-best-practices`, `frontend-design`, and `backend-design`. Domain core execution logic is placed in `src/lib/crm/workspace-entity-core.ts`, while Server Actions in `src/lib/workspace-entity-actions.ts` handle session authentication and parameter validation. The UI component `<BulkManageWorkspacesModal>` is modular, accessible, and clean. |
| **Rule 2** | **What Could Go Wrong & Edge Cases** | Identified all failure modes upfront: (1) Cross-tenant organization mismatch; (2) Incompatible contact scope (e.g. assigning person to institution-only workspace); (3) Exceeding Firestore 500-op batch write limit; (4) Duplicate assignments (handled via deterministic ID and skipping); (5) Unlinking from active workspace without warning; (6) Contact projection desynchronization. |
| **Rule 3** | **Downstream & Backoffice Impact** | Backoffice and directory views rely on `workspace_entities` scoped by `workspaceId` and projections in `workspace_contacts`. Linking automatically calls `syncContactProjectionForWE`. Unlinking uses `EntitySyncGateway.unlinkEntityFromWorkspace` to ensure all search indexes, contact projections, and audit logs remain 100% in sync without breaking any other module. |
| **Rule 4** | **Strict Typing Protocol** | Strict Zero-Any Invariant. Zero `any`, `any[]`, or unchecked casts. Every input, output, state variable, and callback is strictly typed (`BulkLinkEntitiesInput`, `BulkUnlinkEntitiesInput`, `BulkWorkspaceOperationResult`, `BulkManageWorkspacesModalProps`). |
| **Rule 5** | **Deployment Protocol** | Staging and local verification before any deployment. No code will be committed or pushed to remote branches (`origin/main`, `origin/deployment`) without explicit user instruction. Verification via `pnpm typecheck` and ESLint. |
| **Rule 7** | **Mobile & Accessibility First** | Touch targets $\ge 44$px (`min-h-[44px]`). Tactile active feedback (`active:scale-[0.97]`). Adheres to Standardized Modal Architecture in `theme.md` (Section 8) with `<DialogHeader demarcated>`, `<CardInfoTooltip text="..." />`, `<DialogDescription className="sr-only">`, and demarcated footer. Uses simple, everyday English (e.g. "Assign to Workspaces", "Remove from Workspaces"). |
| **Rule 8** | **Security & Multi-Tenancy** | Strict tenant boundary enforcement: validates `entity.organizationId === workspace.organizationId`. Verifies caller session via `requireAuth()` and checks permissions via `checkEntityPermission(actor, workspaceId, 'edit')`. Never trusts client-supplied tenant or user IDs. |
| **Rule 9** | **Load & Batch Scalability** | Prevents batch processing overload and write limit exhaustion. Firestore batches are hard-limited to 500 operations. Bulk linking $N$ entities to $M$ workspaces produces up to $N \times M \times 2$ operations. The core divides operations into chunks of $\le 100$ entities (max 200 operations per batch) and commits each sequentially. |
| **Rule 10** | **Inline Architectural Guides** | Leaves explanatory commentary and JSDoc in every file detailing what changed, why, caution areas (e.g. deterministic key formatting, projection sync, scope locking), and testability pointers. |
| **Rule 19** | **Idempotency for Mutating Actions** | Defines deterministic key `workspaceEntityId = `${workspaceId}_${entityId}``. If an entity already belongs to a target workspace, the link operation skips it without error and increments `skippedExistingCount`. Retrying the operation is 100% idempotent. |
| **Rule 21** | **Two-Phase Action Model for High-Risk Operations** | Selection -> Modal Configuration & Impact Preview -> User Confirmation -> Batch Execution -> Detailed Summary Toast. Prevents accidental mass reassignments. |
| **Rule 26** | **Cancellation & Execution Feedback** | Clean dismissal when cancelled. Action buttons disabled during execution with loading spinners to prevent double-submissions. Returns exact statistics on completion (assigned count, skipped count, removed count, error count). |

#### B. Non-Applicable Rules & Rationale

| Rule # | Rule Name | Rationale for Non-Application |
| :--- | :--- | :--- |
| **Rule 11** | MCP Protocol Compliance | This feature is an internal CRM administrative action and UI workflow; it does not author or host an external Model Context Protocol server. |
| **Rule 14** | MCP Tool Poisoning / Rug-Pull Defense | No external or third-party MCP tool servers are being consumed or evaluated in this workflow. |
| **Rule 15** | MCP Server Allowlisting | No external MCP server endpoints are being connected. |
| **Rule 24** | Circuit Breakers for LLM Providers | This feature performs direct Firestore relational transactions and does not invoke external generative AI or LLM completion APIs. |
| **Rule 28 & 29** | LLM Context Budgeting & Memory Governance | Pertains to LLM semantic memory retrieval and context windows, not relational bulk entity management in Firestore. |

---

### Technical Specification & Architecture

```mermaid
flowchart TD
    A["Entities Page (EntitiesClient.tsx)"] -->|User selects 2+ entities| B["Floating BulkActionDock"]
    B -->|More Actions -> Manage Workspaces| C["<BulkManageWorkspacesModal />"]
    C -->|Tab 1: Assign to Workspaces| D["bulkLinkEntitiesToWorkspacesAction"]
    C -->|Tab 2: Remove from Workspaces| E["bulkUnlinkEntitiesFromWorkspacesAction"]
    
    subgraph Backend Execution (src/lib/crm/workspace-entity-core.ts)
        D --> D1["Validate Actor Session & Tenant Orgs"]
        D1 --> D2["Filter Scope Compatibility (areScopesCompatible)"]
        D2 --> D3["For Each Entity & Workspace: Check existing `${wsId}_${entId}`"]
        D3 -->|Already Exists| D4["Skip & Increment skippedExistingCount"]
        D3 -->|New Link| D5["Batch Write (<= 100 docs): workspace_entities doc + entities.workspaceIds arrayUnion"]
        D5 --> D6["Sync Contact Projection (syncContactProjectionForWE)"]
        
        E --> E1["Validate Actor Session & Tenant Orgs"]
        E1 --> E2["Batch Write (<= 100 docs): Delete workspace_entities doc + entities.workspaceIds arrayRemove"]
        E2 --> E3["Delete Contact Projection (deleteContactProjectionForEntity)"]
    end
    
    D6 --> F["Return Summary (assigned, skipped, errors) + Revalidate Paths"]
    E3 --> F
    F --> G["Display Actionable Toast & Clear Selection"]
```

---

### Failure Modes & Defensive Guardrails

1. **Idempotent Skip of Existing Assignments**:
   - For an entity $E$ and workspace $W$, the canonical document key in `workspace_entities` is `${W}_${E}`.
   - If that document exists or $W$ is already in `entity.workspaceIds`, the backend **skips** it without throwing an error and increments `skippedExistingCount`.
2. **Scope Compatibility Guard**:
   - Workspaces have a `contactScope` (`institution`, `person`, `family`). Entities have an `entityType`.
   - The UI disables incompatible workspaces using `areScopesCompatible(entityType, workspace.contactScope)`.
   - The server core validates scope compatibility and skips incompatible pairs if present, recording `skippedIncompatibleCount`.
3. **Firestore 500-Write Batch Limit**:
   - If 100 entities are assigned to 3 workspaces, up to 300 link operations may execute (each touching 2 docs: `workspace_entities` and `entities` = 600 operations).
   - The core chunks writes into groups of 50-100 entities (max 200 operations per batch) and commits each sequentially.
4. **Current Workspace Removal Warning**:
   - If the user selects the active workspace in the "Remove from Workspaces" tab, the modal displays a clear warning banner: *"Removing selected contacts from your current workspace will remove them from this view."*
5. **Orphan Safety**:
   - Removing an entity from a workspace does NOT delete its master identity document in the `entities` collection. It only removes the workspace-specific projection (`workspace_entities`) and unlinks the ID from `entity.workspaceIds`.

---

### Step-by-Step Implementation Tasks

- [ ] **Task 1: Core Backend Functions (`src/lib/crm/workspace-entity-core.ts`)**
  - Implement `bulkLinkEntitiesToWorkspacesCore(actor, input)`:
    - Verifies permissions for each workspace via `keepPermitted(actor, ..., 'edit')`.
    - Validates multi-tenant boundaries (`entity.organizationId === workspace.organizationId`).
    - Validates scope compatibility via `areScopesCompatible(entity.entityType, workspace.contactScope)`.
    - Queries existing `workspace_entities` documents to identify already-assigned entities and skips them.
    - Batches creations in chunks of $\le 100$ entities ($\le 200$ Firestore operations per batch write).
    - Syncs contact projections via `syncContactProjectionForWE`.
    - Logs audit trail via `logWorkspaceEntityCreated`.
  - Implement `bulkUnlinkEntitiesFromWorkspacesCore(actor, input)`:
    - Verifies permissions for each workspace via `keepPermitted(actor, ..., 'delete')`.
    - Chunks batch deletions of `workspace_entities` and updates `entities.workspaceIds` using `FieldValue.arrayRemove`.
    - Cleans contact projections.
    - Logs audit trail via `logWorkspaceEntityDeleted`.

- [ ] **Task 2: Server Actions Wrapper (`src/lib/workspace-entity-actions.ts`)**
  - Define strictly typed inputs and outputs:
    ```typescript
    export interface BulkLinkEntitiesActionInput {
      entityIds: string[];
      workspaceIds: string[];
    }
    export interface BulkUnlinkEntitiesActionInput {
      entityIds: string[];
      workspaceIds: string[];
    }
    export interface BulkWorkspaceOperationResult {
      success: boolean;
      totalProcessed: number;
      assignedCount?: number;
      removedCount?: number;
      skippedExistingCount?: number;
      skippedIncompatibleCount?: number;
      error?: string;
    }
    ```
  - Export `bulkLinkEntitiesToWorkspacesAction` and `bulkUnlinkEntitiesFromWorkspacesAction` authenticated via `sessionCaller`.

- [ ] **Task 3: Unit Tests (`src/lib/crm/__tests__/workspace-entity-bulk.test.ts`)**
  - Write test suite verifying:
    - Idempotent skipping when entity is already linked to workspace.
    - Correctly linking unlinked entities.
    - Respecting scope compatibility.
    - Correctly unlinking entities from workspaces.
    - Batch chunking under high item counts.

- [ ] **Task 4: Bulk Action Dock Integration (`src/app/admin/entities/components/BulkActionDock.tsx`)**
  - Add `onManageWorkspaces?: () => void;` to `BulkActionDockProps`.
  - Add menu item to "More Actions" dropdown under "Data Management":
    ```tsx
    <DropdownMenuItem 
      onClick={onManageWorkspaces}
      className="rounded-xl p-2.5 gap-3 hover:bg-slate-800 cursor-pointer focus:bg-primary/25 focus:text-white"
    >
      <div className="p-1.5 bg-sky-500/10 rounded-lg text-sky-400">
        <Share2 className="h-3.5 w-3.5" />
      </div>
      <span className="font-bold text-sm">Manage Workspaces</span>
    </DropdownMenuItem>
    ```

- [ ] **Task 5: UI Modal: `<BulkManageWorkspacesModal>` (`src/app/admin/entities/components/BulkManageWorkspacesModal.tsx`)**
  - Implement standardized modal adhering to `theme.md` (Section 8):
    - Dialog surface: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
    - Demarcated header: `<DialogHeader demarcated>` with `<CardInfoTooltip text="..." />` and `<DialogDescription className="sr-only">`.
    - Demarcated footer: tactile buttons `active:scale-[0.97]` and `min-h-[44px]`.
  - Tabs:
    - **Tab 1: Assign to Workspaces**:
      - Multi-select list of accessible workspaces.
      - Displays scope compatibility badges and active member indicators.
      - Dynamic action button: `"Assign to X Workspaces"`.
    - **Tab 2: Remove from Workspaces**:
      - Multi-select list of workspaces where selected contacts currently exist.
      - Warning notice if active workspace is selected.
      - Dynamic action button: `"Remove from X Workspaces"`.

- [ ] **Task 6: Wire Modal in `src/app/admin/entities/EntitiesClient.tsx`**
  - State: `const [isBulkManageWorkspacesOpen, setIsBulkManageWorkspacesOpen] = useState(false);`
  - Pass `onManageWorkspaces={() => setIsBulkManageWorkspacesOpen(true)}` to `<BulkActionDock>`.
  - Render `<BulkManageWorkspacesModal>` passing:
    - `entities={selectedEntities}`
    - `currentWorkspaceId={activeWorkspace?.id}`
    - `onComplete={() => { clearSelection(); router.refresh(); }}`

- [ ] **Task 7: Comprehensive Verification & Typecheck**
  - Run Vitest tests for the new bulk workspace actions.
  - Run ESLint on all touched files.
  - Run `pnpm typecheck` to confirm 0 TypeScript compiler errors.
