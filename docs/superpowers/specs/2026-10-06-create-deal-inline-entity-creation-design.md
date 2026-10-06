# Design Document: Inline Entity & Primary Contact Creation in Deal Modal

**Author:** SmartSapp Engineering & Antigravity  
**Date:** October 6, 2026  
**Status:** Approved  
**Compliance:** `agents_mcp_rules.md`, `.agents/AGENTS.md`, `theme.md` (Section 8)

---

## 1. Context & User Story
When sales representatives or team members create a deal in `CreateDealModal.tsx`, they currently have to pick an entity from the workspace's entity list. If an entity does not already exist, they cannot create it inside the deal modal, causing friction.

**Goal:**
Allow users to create a new entity inline inside `CreateDealModal.tsx` when adding a deal, requiring:
- Entity Name
- Primary / Signatory Contact Details:
  - Full Name (required)
  - Phone and/or Email (at least one required)
  - Role / Title (defaults to "Signatory / Decision Maker", editable)
The app atomically saves the entity (with this contact as both primary and signatory), binds the contact as the deal's focal contact, and creates the deal in the targeted pipeline and stage in a single round-trip.

---

## 2. Architecture & Components

### 2.1 Backend Composite Server Action (`src/app/actions/deal-actions.ts`)
- **Action Name:** `createDealWithNewEntityAction`
- **Validation Schema:** `NewEntityDealInputSchema` (Zod validated at boundary)
- **Permissions:** Session verification via `requireWorkspace(workspaceId)`, RBAC check via `canUser` for `operations.campuses.create` and `sales.pipeline.create`.
- **Entity Creation:** Invokes `createEntityCore`. Enforces primary/signatory contact constraints, duplicate checking, and workspace entity linking.
- **Deal Creation:** Invokes `createDealCore` with `newEntityId` and the new contact as `DealFocalContact`.
- **Atomic Resilience:** If deal creation fails after entity creation, the operation defensively rolls back or reports the precise diagnostic, preventing orphaned or unassociated entities.
- **Activity & Domain Events:** Emits activity events for both entity creation and deal creation, revalidating `/admin/pipeline`, `/admin/entities`, and `/admin/deals`.

### 2.2 Frontend UI (`src/app/admin/entities/components/CreateDealModal.tsx`)
- Adds state: `isCreatingNewEntity`, `newEntityName`, `newContactName`, `newContactPhone`, `newContactEmail`, `newContactRole`.
- In `CommandList`:
  - When `entitySearch.trim()` has no match or is entered, renders an interactive item: `+ Create "[entitySearch]" as new {singular}`.
  - Clicking it switches to inline creation mode, setting `newEntityName = entitySearch.trim()`.
- Provides an inline button `+ New {singular}` next to the Target Contact label.
- Renders an inline card with high contrast, clear grouping, and touch targets ≥ 44px.
- Provides a "Choose existing instead" button to switch back without losing entered deal data.
- Submits to `createDealWithNewEntityAction` when `isCreatingNewEntity` is true, or `createDeal` when false.
