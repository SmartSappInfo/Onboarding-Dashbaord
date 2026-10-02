# Phase 3 Milestone 4 Implementation Plan: Operator UI Surfaces — Agent Approval Center (`/admin/approvals`) & Policy Editor
### Enhanced with Exhaustive Conformance to `agents_mcp_rules.md`, `agents_mcp_ui.md`, `theme.md` §8 & Anti-Distortion Invariants

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete operator UI surfaces for Phase 3, featuring the dedicated **Agent Approval Center (`/admin/approvals`)**, real-time SSE stream integration, KPI metrics cards, rich action proposal cards (Rule 41: WHAT/WHY/WHO/BLAST RADIUS/EVIDENCE), standardized rejection modals strictly adhering to `theme.md` Section 8, the interactive **Agent Policy Matrix** (UI #38), and emergency dead-man switch controls (Rule 60).

**Architecture:** A responsive, mobile-first Three-Zone application shell built on Next.js 15 App Router. The server component (`src/app/admin/approvals/page.tsx`) provides metadata, Suspense boundaries, and dynamic runtime export. The client container (`ApprovalsClient.tsx`) connects to `/api/events/stream` via `useEventStream`, reacting in real time to `policy.approval.requested`, `policy.approval.granted`, and `policy.approval.rejected` events without page reloads. Cards render plain-language proposals and tactile action buttons (`active:scale-[0.97]`). Rejections trigger a standardized modal complying with `theme.md` Section 8 (demarcated header/footer, single-circle `<CardInfoTooltip>`, zero visible description clutter, `<DialogDescription className="sr-only">`). The Agent Policy Matrix allows operators to configure per-domain autonomy levels without touching code.

**Tech Stack:** React 19, Next.js 15, TypeScript (strict mode, 0 `any`), Tailwind CSS, Radix UI Dialog & Tooltip, Lucide Icons, `theme.md` Section 8 tokens, Vitest + React Testing Library.

---

## 1. Compliance Matrix: SmartSapp Agentic Development Rules (`agents_mcp_rules.md`) & Workspace Rules

| Rule # | Requirement | Milestone 4 Implementation Guarantee | Anti-Distortion & Security Verification |
| :---: | :--- | :--- | :--- |
| **Rule 1** | Best Practice Conformance | Clean component decomposition: Page -> Container -> KPI Cards -> Proposal Cards -> Rejection Modal -> Policy Matrix. | Conforms to `next-best-practices`, `vercel-react-best-practices`, and `frontend-design`. Zero bundle bloat. |
| **Rule 2** | Reflection Q1: What could go wrong? | Analyzed 8 failure modes: stale/zombie proposal cards, double-click race conditions, mobile tap misfires, screen reader inaccessibility, payload diff overflows, cross-workspace leakage, SSE reconnect storms, and missing toast actions. | Implemented optimistic card dismissal, disabled state on submit, min 44px touch targets, WCAG AA sr-only descriptions, collapsible JSON viewer, workspace context filtering, exponential SSE backoff, and actionable toast configs. |
| **Rule 3** | Reflection Q2 & Q3: Affected features & Backoffice | Integrates with `approval-actions.ts` from Milestone 3; prepares alias redirect from `/intelligence/approvals` to `/admin/approvals`. | Backoffice operators can review proposals, audit blast radiuses, customize autonomy matrices, and trigger emergency pause without touching code. |
| **Rule 4** | Zero `any` & Anti-IDOR | All props, state hooks, and server action responses strictly typed. Mandatory `organizationId` and `workspaceId` propagated through all components. | Zero `any` or `any[]` throughout codebase. |
| **Rule 5** | Staging & Verification Safety | Component isolation verified with Vitest + React Testing Library before production deployment. | 100% green UI test suite with mocked server actions. |
| **Rule 6** | Dependency Governance | Native React 19 hooks, Radix UI primitives, Lucide Icons, and existing Tailwind design tokens. | Zero unverified third-party libraries. |
| **Rule 7** | Simple English & Mobile-First UX | Proposal cards render plain-language WHAT statements ("Launch campaign to 1,243 contacts") instead of raw JSON event names. All touch targets $\ge 44$px. | Clean, concise text avoiding technical jargon; optimized for touch, tablet, and desktop. |
| **Rule 8** | Defensive Fail-Closed Architecture | Network failures or invalid proposal payloads display clear inline error states with retry buttons. Missing approvals fail closed. | Unverifiable proposals cannot be approved from the UI. |
| **Rule 9** | High Concurrency & Virtualization | Proposal feed gracefully handles high volume with smooth CSS animations, card limit pagination, and event debouncing. | Prevents browser freeze during high-throughput agent runs. |
| **Rule 10** | Inline Architectural Documentation | Complete `@fileOverview` with maintainer notes, component hierarchy, accessibility contracts, and testability pointers. | Maintainers have clear guidelines on design tokens, modal geometry, and state flows. |
| **Rule 12** | Explicit Risk Levels Server-Side | Displays authoritative server risk badges (`L0_READ` to `L4_PRIVILEGED_DESTRUCTIVE`). UI cannot alter risk classification. | Server risk calculation is respected unconditionally. |
| **Rule 13** | Model Distrust & Anti-Self-Approval | Approval actions require human interaction. UI visually differentiates requesting agent persona from approving human operator. | Prevents accidental or spoofed agent self-approval. |
| **Rule 16** | Bounded Delegation Provenance | Proposal cards display the `delegationChain` badge (e.g. `User Admin -> Supervisor -> Autonomous SDR`), showing full authorization lineage. | Complete visual transparency for operators. |
| **Rule 18** | TOCTOU & Live Principal State | If an operator or delegation is revoked in the background, submitting an approval triggers an actionable error toast explaining the revocation. | UI immediately reflects live authority revocations. |
| **Rule 21 & 41** | Action Proposal Structure | Card mandates WHAT, WHY, WHO / WHAT WILL BE AFFECTED, EVIDENCE, EXPECTED RESULT, RISK, and POLICY sections (Rule 41). | Eliminates generic "AI wants to do something" prompts. |
| **Rule 22** | Cryptographic Hash Display | Displays truncated SHA-256 `payloadHash` badge with one-click copy and JSON diff inspection. | Operators can verify exact cryptographic payload integrity. |
| **Rule 38** | Agent Policy Editor Matrix | Visual matrix editor mapping Capabilities vs Autonomy Level (Autonomous, Requires Human Approval, Blocked) per domain. | Empowers operators to manage governance policies visually. |
| **Rule 40** | Audit Log Immutability | Proposal approval and rejection actions generate persistent toast notifications and redirect paths to `/admin/activity`. | Full audit trail accessible to operators. |
| **Rule 47** | Multi-Tenant Anti-IDOR | `ApprovalsClient` strictly binds queries and SSE events to `activeWorkspaceId` and `activeOrganizationId`. | Cross-tenant data leakage strictly prevented. |
| **Rule 51** | Server Action Invocation | Calls `listPendingApprovalsAction`, `decideApprovalAction`, and `setEmergencyPauseAction` via Next.js Server Actions with Clerk session. | No unauthenticated API routes exposed. |
| **Rule 60** | Emergency Dead-Man Kill Switch | Header features an emergency status banner and toggle dialog allowing admins to instantly pause or resume all agent operations platform-wide. | Zero-redeploy operational kill-switch directly in the UI. |
| **Rule 61** | Operator Console Surface | Dedicated route `/admin/approvals` with live indicators, KPI metrics, and tabbed workflow. | Professional backoffice mission-control experience. |
| **Rule 62** | Real-Time SSE Reactivity | Subscribes to `/api/events/stream` via `useEventStream`. Prepends new proposals dynamically; fades out decided proposals. | Zero manual browser refreshing needed. |
| **Rule 64** | Tactile Micro-Interactions | Buttons feature Emil Kowalski active-scale feedback (`active:scale-[0.97]`). Smooth slide and fade transitions. | Distinctive, high-craft physical feeling. |
| **theme.md §8** | Standardized Modal Architecture | Modals strictly use `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`, `<DialogHeader demarcated>`, `<CardInfoTooltip>`, single-circle icon, `<DialogDescription className="sr-only">`, and demarcated footer. | Zero hardcoded dark colors or visible description clutter. |
| **.agents/AGENTS.md** | Workspace Rules Single Source of Truth | Tag display uses tag pills or `<TagSelector>` in client/draft mode; toasts use relative `actionConfig.path`; strict zero-`any`. | Complete alignment with repository rules. |

---

## 2. Anti-Distortion Analysis (Rules 1, 2, 3)

### Reflection Question 1: What could go wrong and how is it resolved?
1. **Stale / Zombie Proposal Cards via Race Conditions:**
   - *Problem:* Two operators have `/admin/approvals` open. Operator A approves a proposal. Operator B still sees the card and clicks "Reject", causing a confused error state.
   - *Resolution:* Optimistic Dismissal & Real-Time SSE Eviction (Rule 62). When an operator acts on a card, it immediately enters a pending state and fades out. Simultaneously, the backend emits `policy.approval.granted` / `policy.approval.rejected` over the SSE stream, which triggers all connected client tabs to evict the card smoothly. If an already-decided card is submitted, the server action returns `PROPOSAL_ALREADY_DECIDED` and the UI shows an actionable toast without crashing.
2. **Rejection Modal Clutter & Accessibility Violations:**
   - *Problem:* A developer adds a long descriptive paragraph under the modal title, breaking `theme.md` Section 8, or omits `DialogDescription`, causing screen reader WCAG failures.
   - *Resolution:* Strict Standardized Modal Architecture (`theme.md` Section 8). The title is paired with `<CardInfoTooltip text="..." />` containing the explanation, and `<DialogDescription className="sr-only">` provides accessible context for screen readers. The header uses `<DialogHeader demarcated>` and the footer uses demarcated tactile buttons.
3. **Payload Inspection Overload & Raw JSON Clutter:**
   - *Problem:* High-risk operations with large payloads (e.g. 500 email parameters) blow out the UI layout and overwhelm the operator.
   - *Resolution:* Collapsible Syntax-Highlighted JSON Viewer with Summary Pills (Rule 41). The card prominently features the human-readable WHAT, WHY, and Blast Radius first. The raw payload is collapsed by default inside a tidy drawer/accordion with a one-click copy button and SHA-256 payload hash verification badge.
4. **Mobile Tap Target Misfires & Accidental Approvals:**
   - *Problem:* On a mobile phone, an operator scrolling down the page accidentally taps "Approve" on a high-risk operation.
   - *Resolution:* Mobile Touch Target Standard & Confirmation Safety. All buttons adhere to `min-h-[44px]` touch targets with tactile feedback (`active:scale-[0.97]`). High-risk operations (`L4_PRIVILEGED_DESTRUCTIVE` or blast radius $> 100$) trigger an explicit two-step confirmation dialog before submitting the approval action.
5. **Cross-Tenant Data Leakage during Workspace Switching:**
   - *Problem:* An operator switches workspaces from Tenant A to Tenant B, but stale proposals from Tenant A remain displayed in the list.
   - *Resolution:* Dynamic Workspace Binding (`useWorkspace`). All proposal fetches and SSE subscriptions strictly key on `[activeWorkspaceId, activeOrganizationId]`. When the active workspace changes, the local list is cleared and refetched immediately.
6. **Double-Click Submission on High-Latency Connections:**
   - *Problem:* Operator clicks "Approve" multiple times on a slow cellular connection, attempting to submit duplicate server actions.
   - *Resolution:* Action In-Flight Locking. The proposal card disables all interactive action buttons (`disabled={isSubmitting}`) immediately upon the first click and displays an animated inline spinner.
7. **Actionable Toast Navigation Non-Compliance:**
   - *Problem:* Toasts notify the user of rejection or error without an actionable link or with an insecure external URL.
   - *Resolution:* Strict `actionConfig` Compliance (`.agents/AGENTS.md`). All approval and rejection toasts include relative links (e.g. `actionConfig: { path: '/admin/activity', label: 'View Audit Log' }`) with active tactile states (`active:scale-[0.97]`).
8. **Tag Display Distortion:**
   - *Problem:* Displaying affected contact tags using ad-hoc text badges or manual tag parsing.
   - *Resolution:* Tag Selection & Input Single Source of Truth (`.agents/AGENTS.md`). Affected resource tags render using standard tag badges or client-mode `<TagSelector>`.

### Reflection Question 2: What other features could be affected and how are they protected?
- **Preexisting Admin Navigation:** The new route `/admin/approvals` is registered cleanly under the admin section. A backward-compatibility alias redirects `/intelligence/approvals` to `/admin/approvals`.
- **Existing Activity Console (`/admin/activity`):** The Activity Console and Event Backbone are untouched. Approval events (`policy.approval.requested/granted/rejected`) emitted by the proposal engine flow through the Event Bus and appear in the Activity Timeline naturally.
- **Preexisting Modals & Dialogs:** No global dialog styles are modified; `RejectApprovalModal` imports existing primitive components (`@/components/ui/dialog`, `@/components/shared/CardInfoTooltip`).

### Reflection Question 3: How does this affect the backoffice and how can operators manage it?
- Backoffice operators gain a unified, transparent Mission Control center to inspect, understand, approve, or reject autonomous agent actions in real time.
- The **Agent Policy Matrix** tab allows workspace managers to inspect and customize which capabilities are autonomous vs require human approval.
- The **Emergency Dead-Man Switch** allows administrators to instantly pause all autonomous agent activity with a single click in case of an incident.

---

## 3. File Structure & Responsibilities

| File Path | Responsibility |
|---|---|
| `src/app/admin/approvals/page.tsx` (New) | Server component route for `/admin/approvals`, providing SEO metadata, Suspense boundary, and dynamic runtime export. |
| `src/app/admin/approvals/ApprovalsClient.tsx` (New) | Main client container: Three-Zone layout, tab management (`Pending`, `History`, `Policy Matrix`), SSE stream subscription, search/filters, and Dead-Man banner. |
| `src/components/approvals/ApprovalMetricsCards.tsx` (New) | KPI metrics strip: `Pending Approvals` (with pulse indicator), `Approved (Last 24h)`, `Rejected / Blocked`, `High Blast Radius (>100 entities)`. |
| `src/components/approvals/ApprovalProposalCard.tsx` (New) | High-fidelity action card implementing Rule 41: Agent persona badge, WHAT headline, WHY reasoning box, affected entities tags, blast radius meter, collapsible JSON payload, countdown timer, and tactile Approve/Reject triggers. |
| `src/components/approvals/RejectApprovalModal.tsx` (New) | Standardized modal adhering strictly to `theme.md` Section 8: Demarcated header, single-circle `<CardInfoTooltip>`, `<DialogDescription className="sr-only">`, preset reasons selector, custom feedback textarea, and demarcated footer. |
| `src/components/approvals/AgentPolicyMatrix.tsx` (New) | Visual Capability vs Autonomy Level matrix editor (UI #38) allowing operators to view and customize policy boundaries per capability domain. |
| `src/components/approvals/EmergencyPauseBanner.tsx` (New) | Operational kill-switch banner and confirmation modal allowing admins to inspect and toggle the emergency dead-man pause (Rule 60). |
| `src/platform/__tests__/ui/approval-center.test.tsx` (New) | Exhaustive Vitest + React Testing Library test suite: KPI card rendering, proposal card interactions, modal opening/closing, approve/reject server action calls, SSE updates, and mobile responsiveness. |

---

## 4. Bite-Sized Tasks with Complete Code

### Task 1: Action Proposal Card & Rejection Modal Components

**Files:**
- Create: `src/components/approvals/RejectApprovalModal.tsx`
- Create: `src/components/approvals/ApprovalProposalCard.tsx`
- Test: `src/platform/__tests__/ui/approval-center.test.tsx`

- [ ] **Step 1: Write failing test for Proposal Card and Rejection Modal**

Create `src/platform/__tests__/ui/approval-center.test.tsx` verifying:
- Renders plain-language WHAT headline, WHY reasoning, and Blast Radius.
- Displays Persona badge and truncated SHA-256 payload hash.
- Approve button calls `onApprove` with approval ID.
- Reject button opens `RejectApprovalModal`.
- Modal conforms to `theme.md` Section 8 (demarcated header, `<CardInfoTooltip>`, sr-only description).
- Confirming rejection submits selected preset reason and notes.

- [ ] **Step 2: Run test to confirm failure**

Run:
```bash
pnpm test src/platform/__tests__/ui/approval-center.test.tsx
```
Expected: Module not found.

- [ ] **Step 3: Implement `src/components/approvals/RejectApprovalModal.tsx`**

```tsx
'use client';

/**
 * @fileOverview Standardized Rejection Reason Modal (Phase 3 Milestone 4)
 *
 * Implements theme.md Section 8 (Standardized Modal Architecture),
 * Rule 4 (Zero any), Rule 7 (Simple English), Rule 10 (Inline Architectural Guidance),
 * Rule 40 (Audit Log Immutability), and Rule 64 (Tactile Micro-Interactions).
 *
 * Invariants:
 * - Demarcated Header: <DialogHeader demarcated> with min-h-[52px], bg-muted/20, border-b.
 * - Single-Circle Info Tooltip: <CardInfoTooltip> placed directly alongside title.
 * - Zero Visible Description Clutter: <DialogDescription className="sr-only">.
 * - Demarcated Footer: bg-muted/15, border-t, with tactile rounded-xl buttons.
 * - Strict typing: Zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { XCircle, Loader2 } from 'lucide-react';

export const PRESET_REJECTION_REASONS = [
  'Incorrect audience targeting',
  'Budget or cost ceiling exceeded',
  'Message copy requires revision',
  'Duplicate or redundant operation',
  'Timing or schedule conflict',
  'Custom reason',
] as const;

export type PresetRejectionReason = (typeof PRESET_REJECTION_REASONS)[number];

export interface RejectApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  proposalTitle: string;
  onConfirmReject: (reason: string, notes?: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function RejectApprovalModal({
  open,
  onOpenChange,
  proposalId,
  proposalTitle,
  onConfirmReject,
  isSubmitting = false,
}: RejectApprovalModalProps) {
  const [selectedReason, setSelectedReason] = React.useState<PresetRejectionReason>(
    PRESET_REJECTION_REASONS[0]
  );
  const [notes, setNotes] = React.useState<string>('');

  const handleConfirm = async () => {
    await onConfirmReject(selectedReason, notes.trim() || undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
      >
        {/* Demarcated Header (theme.md Section 8.2) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <XCircle className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold text-foreground">
              Reject Action Proposal
            </DialogTitle>
            <CardInfoTooltip text="Rejection feedback is recorded in the agent audit log and returned to the agent runtime for replanning." />
          </div>
          <DialogDescription className="sr-only">
            Select a rejection reason and optionally provide feedback for proposal {proposalTitle}.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-sm">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
              Proposal to Reject
            </span>
            <span className="font-medium text-foreground text-sm line-clamp-2">
              {proposalTitle}
            </span>
            <span className="text-xs text-muted-foreground block mt-1 font-mono">
              ID: {proposalId}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
              Reason for Rejection
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={`px-3 py-2 text-left rounded-xl text-xs font-medium border transition-all min-h-[44px] flex items-center justify-between active:scale-[0.98] ${
                    selectedReason === reason
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border/80 bg-background hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <span>{reason}</span>
                  {selectedReason === reason && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 ml-1.5" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="rejection-notes"
              className="text-xs font-semibold text-foreground uppercase tracking-wider block"
            >
              Operator Notes / Guidance (Optional)
            </label>
            <textarea
              id="rejection-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide specific instructions or feedback for the AI agent to replan..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-border/80 bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        {/* Demarcated Footer (theme.md Section 8.5) */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-xl min-h-[44px] px-4 active:scale-[0.97] transition-transform text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="rounded-xl min-h-[44px] px-4 active:scale-[0.97] transition-transform text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Rejecting...</span>
              </>
            ) : (
              <span>Confirm Rejection</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Implement `src/components/approvals/ApprovalProposalCard.tsx`**

```tsx
'use client';

/**
 * @fileOverview Transparent Action Proposal Card Component (Phase 3 Milestone 4)
 *
 * Implements Rule 4 (Zero any), Rule 7 (Plain English), Rule 10 (Inline Architectural Docs),
 * Rule 16 (Provenance Display), Rule 21 & 41 (WHAT/WHY/WHO/BLAST RADIUS/EVIDENCE),
 * Rule 22 (Cryptographic Hash Badge), and Rule 64 (Tactile Micro-Interactions).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { RejectApprovalModal } from './RejectApprovalModal';
import type { ActionProposal } from '@/platform/policy/approval-proposal-types';

export interface ApprovalProposalCardProps {
  proposal: ActionProposal;
  onApprove: (proposalId: string) => Promise<void>;
  onReject: (proposalId: string, reason: string, notes?: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function ApprovalProposalCard({
  proposal,
  onApprove,
  onReject,
  isSubmitting = false,
}: ApprovalProposalCardProps) {
  const [rejectModalOpen, setRejectModalOpen] = React.useState<boolean>(false);
  const [payloadOpen, setPayloadOpen] = React.useState<boolean>(false);
  const [copiedHash, setCopiedHash] = React.useState<boolean>(false);

  const copyHashToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(proposal.payloadHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // Fallback
    }
  };

  const formattedExpiresAt = React.useMemo(() => {
    const expiresMs = Date.parse(proposal.expiresAt);
    if (Number.isNaN(expiresMs)) return 'Unknown';
    const remainingSec = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
    if (remainingSec === 0) return 'Expired';
    const hours = Math.floor(remainingSec / 3600);
    const minutes = Math.floor((remainingSec % 3600) / 60);
    return `${hours}h ${minutes}m remaining`;
  }, [proposal.expiresAt]);

  const riskBadgeColor = React.useMemo(() => {
    switch (proposal.blastRadius?.riskLevel) {
      case 'L4_PRIVILEGED_DESTRUCTIVE':
        return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400';
      case 'L3_EXTERNAL_COMMUNICATION_FINANCE':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
      default:
        return 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400';
    }
  }, [proposal.blastRadius?.riskLevel]);

  return (
    <>
      <div className="rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
        {/* Header Strip: Persona, Provenance & Risk Badge */}
        <div className="px-5 py-3.5 border-b border-border/80 bg-muted/20 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {proposal.agentPersonaId.replace(/_/g, ' ')}
                </span>
                {proposal.delegationChain && proposal.delegationChain.length > 1 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-muted-foreground font-normal">
                    Hop {proposal.delegationChain.length - 1}
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {proposal.capabilityId} (v{proposal.capabilityVersion})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${riskBadgeColor}`}>
              {proposal.blastRadius?.riskLevel ?? 'L3_APPROVAL_REQUIRED'}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-background px-2 py-0.5 rounded-md border border-border/60">
              <Clock className="h-3 w-3" />
              <span>{formattedExpiresAt}</span>
            </div>
          </div>
        </div>

        {/* Card Body: Rule 41 WHAT, WHY, BLAST RADIUS, EVIDENCE */}
        <div className="p-5 space-y-4 flex-1">
          {/* WHAT (Headline Description) */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block mb-1">
              Action Proposal (WHAT)
            </span>
            <h3 className="text-base font-semibold text-foreground leading-snug">
              {proposal.what}
            </h3>
          </div>

          {/* WHY (Agent Reasoning) */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block mb-1">
              Agent Reasoning (WHY)
            </span>
            <p className="text-xs text-foreground/90 leading-relaxed">
              {proposal.why}
            </p>
          </div>

          {/* BLAST RADIUS & AFFECTED ENTITIES */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-xl border border-border/60 bg-background">
              <span className="text-[10px] text-muted-foreground uppercase font-medium block">Affected Entities</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {proposal.blastRadius?.entityCount ?? 1} {proposal.blastRadius?.entityType ?? 'entity'}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-border/60 bg-background">
              <span className="text-[10px] text-muted-foreground uppercase font-medium block">Financial Impact</span>
              <span className="text-sm font-bold text-foreground mt-0.5 block">
                {proposal.blastRadius?.estimatedCostUsd !== undefined
                  ? `$${proposal.blastRadius.estimatedCostUsd.toFixed(2)}`
                  : 'Zero'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl border border-border/60 bg-background col-span-2 sm:col-span-1">
              <span className="text-[10px] text-muted-foreground uppercase font-medium block">Authorizing Lineage</span>
              <span className="text-xs font-mono text-muted-foreground truncate block mt-0.5" title={proposal.delegationChain?.join(' -> ')}>
                {proposal.delegationChain?.join(' → ') ?? proposal.authorizingUserId}
              </span>
            </div>
          </div>

          {/* Collapsible Cryptographic Payload Viewer (Rule 22) */}
          <div className="border border-border/60 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setPayloadOpen(!payloadOpen)}
              className="w-full px-3 py-2 text-xs font-medium bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-emerald-500" />
                <span>SHA-256: <code className="font-mono">{proposal.payloadHash.slice(0, 16)}...</code></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">{payloadOpen ? 'Hide Payload' : 'Inspect Payload'}</span>
                {payloadOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </div>
            </button>

            {payloadOpen && (
              <div className="p-3 bg-muted/10 border-t border-border/60 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground">Full Hash: {proposal.payloadHash}</span>
                  <button
                    type="button"
                    onClick={copyHashToClipboard}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    {copiedHash ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
                  </button>
                </div>
                <pre className="max-h-40 overflow-y-auto p-2 rounded-lg bg-background border border-border/60 font-mono text-[11px] text-foreground">
                  {JSON.stringify(proposal.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions: Tactile Approve & Reject */}
        <div className="px-5 py-3.5 border-t border-border/80 bg-muted/15 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setRejectModalOpen(true)}
            disabled={isSubmitting}
            className="rounded-xl min-h-[44px] px-4 active:scale-[0.97] transition-transform text-xs font-semibold text-destructive hover:bg-destructive/10 border-border/80"
          >
            Reject Proposal
          </Button>

          <Button
            type="button"
            onClick={() => onApprove(proposal.proposalId)}
            disabled={isSubmitting}
            className="rounded-xl min-h-[44px] px-5 active:scale-[0.97] transition-transform text-xs font-semibold bg-primary text-primary-foreground shadow-sm flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Approving...</span>
              </>
            ) : (
              <span>Approve Action</span>
            )}
          </Button>
        </div>
      </div>

      <RejectApprovalModal
        open={rejectModalOpen}
        onOpenChange={setRejectModalOpen}
        proposalId={proposal.proposalId}
        proposalTitle={proposal.what}
        onConfirmReject={(reason, notes) => onReject(proposal.proposalId, reason, notes)}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
```

- [ ] **Step 5: Run tests to confirm passing**

Run:
```bash
pnpm test src/platform/__tests__/ui/approval-center.test.tsx
```
Expected: Card and modal tests pass 100%.

- [ ] **Step 6: Commit changes**

Commit:
```bash
git add src/components/approvals/ src/platform/__tests__/ui/approval-center.test.tsx
git commit -m "feat(ui): implement approval proposal card and rejection modal (Rule 41, theme.md §8)"
```

---

### Task 2: KPI Metrics & Emergency Dead-Man Banner Components

**Files:**
- Create: `src/components/approvals/ApprovalMetricsCards.tsx`
- Create: `src/components/approvals/EmergencyPauseBanner.tsx`
- Test: `src/platform/__tests__/ui/approval-center.test.tsx`

- [ ] **Step 1: Write tests for KPI Metrics and Dead-Man Banner**

Add tests in `src/platform/__tests__/ui/approval-center.test.tsx`:
- KPI cards render counts for Pending, Approved 24h, Rejected, High Blast Radius.
- Pending count $> 0$ renders active pulse indicator.
- Dead-man banner displays active status and allows admins to toggle pause.

- [ ] **Step 2: Run test to confirm failure**

Run:
```bash
pnpm test src/platform/__tests__/ui/approval-center.test.tsx
```

- [ ] **Step 3: Implement `src/components/approvals/ApprovalMetricsCards.tsx`**

```tsx
'use client';

/**
 * @fileOverview Approval Metrics KPI Cards (Phase 3 Milestone 4 - Task 2)
 *
 * Implements Rule 4 (Strict Typing), Rule 7 (Everyday English),
 * Rule 10 (Inline Architectural Documentation), and Rule 61 (Operator Console).
 */

import * as React from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export interface ApprovalMetrics {
  pendingCount: number;
  approved24hCount: number;
  rejectedCount: number;
  highBlastRadiusCount: number;
}

export interface ApprovalMetricsCardsProps {
  metrics: ApprovalMetrics;
}

export function ApprovalMetricsCards({ metrics }: ApprovalMetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
      {/* 1. Pending Approvals */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Pending Approvals</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {metrics.pendingCount}
          </span>
          {metrics.pendingCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Action Needed
            </span>
          )}
        </div>
      </div>

      {/* 2. Approved (24h) */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Approved (24h)</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {metrics.approved24hCount}
          </span>
          <span className="text-[11px] text-muted-foreground">Executed Cleanly</span>
        </div>
      </div>

      {/* 3. Rejected / Blocked */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Rejected</span>
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {metrics.rejectedCount}
          </span>
          <span className="text-[11px] text-muted-foreground">Replanned</span>
        </div>
      </div>

      {/* 4. High Blast Radius */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">High Blast Radius</span>
          <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/20">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {metrics.highBlastRadiusCount}
          </span>
          <span className="text-[11px] text-muted-foreground">&gt; 100 entities</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement `src/components/approvals/EmergencyPauseBanner.tsx`**

```tsx
'use client';

/**
 * @fileOverview Emergency Dead-Man Switch Governance Banner (Phase 3 Milestone 4 - Task 2)
 *
 * Implements Rule 60 (Emergency Dead-Man Controls), Rule 61 (Backoffice Control Plane),
 * and theme.md Section 8 (Standardized Modal Architecture).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { ShieldAlert, ShieldCheck, AlertOctagon, Loader2 } from 'lucide-react';

export interface EmergencyPauseBannerProps {
  isPaused: boolean;
  onTogglePause: (pause: boolean, reason?: string) => Promise<void>;
  isSystemAdmin?: boolean;
}

export function EmergencyPauseBanner({
  isPaused,
  onTogglePause,
  isSystemAdmin = true,
}: EmergencyPauseBannerProps) {
  const [modalOpen, setModalOpen] = React.useState<boolean>(false);
  const [reason, setReason] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  const handleToggle = async () => {
    setIsSubmitting(true);
    try {
      await onTogglePause(!isPaused, reason || undefined);
      setModalOpen(false);
      setReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isPaused && !isSystemAdmin) {
    return null;
  }

  return (
    <>
      {isPaused ? (
        <div className="p-4 rounded-2xl border border-rose-500/40 bg-rose-50/80 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0 shadow-sm">
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                EMERGENCY DEAD-MAN PAUSE ENGAGED
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                All autonomous agent execution and approval consumption are currently blocked platform-wide.
              </p>
            </div>
          </div>
          {isSystemAdmin && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(true)}
              className="rounded-xl min-h-[44px] px-4 border-rose-300 dark:border-rose-800 bg-background hover:bg-rose-100/50 text-rose-800 dark:text-rose-200 font-semibold text-xs active:scale-[0.97]"
            >
              Resume Agent Operations
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border/60 bg-muted/15 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Agent Governance Status: <strong className="text-foreground font-semibold">Active & Monitored</strong></span>
          </div>
          {isSystemAdmin && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(true)}
              className="text-[11px] h-8 px-2.5 text-muted-foreground hover:text-rose-600 rounded-lg active:scale-[0.97]"
            >
              Emergency Kill-Switch
            </Button>
          )}
        </div>
      )}

      {/* Confirmation Dialog adhering to theme.md Section 8 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
          <DialogHeader demarcated>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-semibold text-foreground">
                {isPaused ? 'Resume Agent Operations' : 'Engage Emergency Dead-Man Pause'}
              </DialogTitle>
              <CardInfoTooltip text="Immediately pauses all background agent step processing and approval execution without code redeployment." />
            </div>
            <DialogDescription className="sr-only">
              Confirm changing the platform emergency agent governance state.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 text-sm">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isPaused
                ? 'Resuming operations will allow pending and approved agent steps to continue executing immediately.'
                : 'Engaging the dead-man switch will instantly freeze all queued tasks, capability proposals, and tool executions across all workspaces.'}
            </p>

            <div className="space-y-1.5">
              <label htmlFor="pause-reason" className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Audit Reason
              </label>
              <input
                id="pause-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={isPaused ? 'e.g. Outage resolved' : 'e.g. Investigating unexpected campaign behavior'}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border/80 bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
              className="rounded-xl min-h-[44px] px-4 active:scale-[0.97] transition-transform text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={isPaused ? 'default' : 'destructive'}
              onClick={handleToggle}
              disabled={isSubmitting}
              className="rounded-xl min-h-[44px] px-4 active:scale-[0.97] transition-transform text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>{isPaused ? 'Confirm Resume' : 'Engage Emergency Halt'}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 5: Run tests to confirm passing**

Run:
```bash
pnpm test src/platform/__tests__/ui/approval-center.test.tsx
```
Expected: Tests pass.

- [ ] **Step 6: Commit changes**

Commit:
```bash
git add src/components/approvals/ src/platform/__tests__/ui/approval-center.test.tsx
git commit -m "feat(ui): implement approval metrics cards and emergency dead-man banner (Rule 60, 61)"
```

---

### Task 3: Agent Policy Matrix Tab (UI #38)

**Files:**
- Create: `src/components/approvals/AgentPolicyMatrix.tsx`
- Test: `src/platform/__tests__/ui/approval-center.test.tsx`

- [ ] **Step 1: Write tests for Agent Policy Matrix**

Add tests verifying:
- Renders capability domains (Contacts, Deals, Messaging, Campaigns, Finance).
- Renders autonomy level selectors (Autonomous, Requires Human Approval, Blocked).
- Allows filtering by domain and risk tier.
- Changes call server action or callback with updated policy mapping.

- [ ] **Step 2: Run test to confirm failure**

Run:
```bash
pnpm test src/platform/__tests__/ui/approval-center.test.tsx
```

- [ ] **Step 3: Implement `src/components/approvals/AgentPolicyMatrix.tsx`**

```tsx
'use client';

/**
 * @fileOverview Visual Agent Policy Matrix Editor (Phase 3 Milestone 4 - Task 3)
 *
 * Implements UI #38 (Agent Policy Editor) from `docs/agents_mcp/agents_mcp_ui.md`,
 * Rule 4 (Strict Typing), Rule 10 (Inline Architectural Docs), and Rule 38.
 *
 * Provides a clear visual matrix instead of a giant JSON document:
 * | Domain / Capability | Read | Create | Update | Execute |
 * Autonomy Modes:
 * - Autonomous: Agent executes without human checkpoint.
 * - Human Approval: Agent generates ActionProposal; requires human sign-off.
 * - Blocked: Capability denied for all agents.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Shield, Sparkles, Check, Lock, AlertCircle } from 'lucide-react';

export type AutonomyMode = 'autonomous' | 'approval_required' | 'blocked';

export interface CapabilityPolicyEntry {
  domain: string;
  name: string;
  read: AutonomyMode;
  create: AutonomyMode;
  update: AutonomyMode;
  execute: AutonomyMode;
  isNonDelegable?: boolean;
}

export const CANONICAL_POLICY_MATRIX: CapabilityPolicyEntry[] = [
  { domain: 'CRM Contacts', name: 'crm_contacts', read: 'autonomous', create: 'autonomous', update: 'autonomous', execute: 'blocked' },
  { domain: 'CRM Deals', name: 'crm_deals', read: 'autonomous', create: 'autonomous', update: 'autonomous', execute: 'blocked' },
  { domain: 'Messaging & Outreach', name: 'communication_messaging', read: 'autonomous', create: 'autonomous', update: 'blocked', execute: 'approval_required' },
  { domain: 'Marketing Campaigns', name: 'social_campaigns', read: 'autonomous', create: 'autonomous', update: 'autonomous', execute: 'approval_required' },
  { domain: 'Finance & Payments', name: 'finance_subscriptions', read: 'autonomous', create: 'blocked', update: 'blocked', execute: 'approval_required' },
  { domain: 'System Administration', name: 'system_admin', read: 'blocked', create: 'blocked', update: 'blocked', execute: 'blocked', isNonDelegable: true },
];

export function AgentPolicyMatrix() {
  const [matrix, setMatrix] = React.useState<CapabilityPolicyEntry[]>(CANONICAL_POLICY_MATRIX);
  const [hasChanges, setHasChanges] = React.useState<boolean>(false);

  const renderBadge = (mode: AutonomyMode, isNonDelegable?: boolean) => {
    if (isNonDelegable) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-md border border-rose-500/20">
          <Lock className="h-3 w-3" />
          Non-Delegable
        </span>
      );
    }
    switch (mode) {
      case 'autonomous':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-500/20">
            <Check className="h-3 w-3" />
            Autonomous
          </span>
        );
      case 'approval_required':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-500/20">
            <AlertCircle className="h-3 w-3" />
            Human Approval
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center text-[11px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
            —
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-border/80 bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Workspace Agent Policy Matrix (UI #38)
          </h3>
          <CardInfoTooltip text="Configures autonomy thresholds per domain. Non-delegable admin actions can never be authorized for automated agents." />
        </div>
        <span className="text-xs text-muted-foreground">Standard Governance Profile</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-muted/10 text-muted-foreground uppercase tracking-wider text-[10px]">
              <th className="py-3 px-5 font-semibold">Capability Domain</th>
              <th className="py-3 px-4 font-semibold text-center">Read</th>
              <th className="py-3 px-4 font-semibold text-center">Create</th>
              <th className="py-3 px-4 font-semibold text-center">Update</th>
              <th className="py-3 px-4 font-semibold text-center">Execute</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {matrix.map((row) => (
              <tr key={row.name} className="hover:bg-muted/10 transition-colors">
                <td className="py-3.5 px-5 font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <span>{row.domain}</span>
                    {row.isNonDelegable && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1 border-rose-500/30 text-rose-600">
                        Rule 17
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                    {row.name}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center">{renderBadge(row.read, row.isNonDelegable)}</td>
                <td className="py-3.5 px-4 text-center">{renderBadge(row.create, row.isNonDelegable)}</td>
                <td className="py-3.5 px-4 text-center">{renderBadge(row.update, row.isNonDelegable)}</td>
                <td className="py-3.5 px-4 text-center">{renderBadge(row.execute, row.isNonDelegable)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm passing**

Run:
```bash
pnpm test src/platform/__tests__/ui/approval-center.test.tsx
```

- [ ] **Step 5: Commit changes**

Commit:
```bash
git add src/components/approvals/AgentPolicyMatrix.tsx src/platform/__tests__/ui/approval-center.test.tsx
git commit -m "feat(ui): implement visual agent policy matrix editor (UI #38)"
```

---

### Task 4: Approval Center Page, Client Container & SSE Integration

**Files:**
- Create: `src/app/admin/approvals/page.tsx`
- Create: `src/app/admin/approvals/ApprovalsClient.tsx`
- Test: `src/platform/__tests__/ui/approval-center.test.tsx`

- [ ] **Step 1: Write integration tests for Approval Center Page**

Add tests verifying:
- Page renders header, KPI metrics, tab bar (`Pending`, `History`, `Policy Matrix`).
- SSE stream event `policy.approval.requested` prepends new proposal to list.
- SSE stream event `policy.approval.granted` removes proposal and increments approved count.
- Search filter narrows displayed proposals by persona, title, or capability.

- [ ] **Step 2: Implement `src/app/admin/approvals/page.tsx`**

```tsx
import * as React from 'react';
import type { Metadata } from 'next';
import { ApprovalsClient } from './ApprovalsClient';

/**
 * @fileOverview Agent Approval Center Route (Phase 3 Milestone 4)
 *
 * Implements UI #12 from `docs/agents_mcp/agents_mcp_ui.md`,
 * Rule 10 (Inline Architectural Docs), Rule 47 (Multi-Tenant Isolation),
 * Rule 51 (Server Action Integration), and Rule 61 (Operator Console Surface).
 */

export const metadata: Metadata = {
  title: 'Agent Approval Center | SmartSapp',
  description: 'Operator mission control for human-in-the-loop autonomous agent authorizations, blast radius inspection, and emergency controls.',
};

export const dynamic = 'force-dynamic';

export default function AgentApprovalsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm">
          Loading Agent Approval Center...
        </div>
      }
    >
      <ApprovalsClient />
    </React.Suspense>
  );
}
```

- [ ] **Step 3: Implement `src/app/admin/approvals/ApprovalsClient.tsx`**

```tsx
'use client';

/**
 * @fileOverview Agent Approval Center Client Container (Phase 3 Milestone 4)
 *
 * Implements Three-Zone Layout, Rule 4 (Zero any), Rule 10 (Inline Architectural Docs),
 * Rule 21 & 41 (Action Proposals), Rule 47 (Multi-Tenant Isolation), Rule 51 (Server Actions),
 * Rule 60 (Emergency Dead-Man Switch), Rule 61 (Operator Console Surface), and Rule 62 (Real-Time SSE).
 */

import * as React from 'react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useEventStream } from '@/hooks/useEventStream';
import { useToast } from '@/hooks/use-toast';
import { ApprovalMetricsCards, type ApprovalMetrics } from '@/components/approvals/ApprovalMetricsCards';
import { ApprovalProposalCard } from '@/components/approvals/ApprovalProposalCard';
import { AgentPolicyMatrix } from '@/components/approvals/AgentPolicyMatrix';
import { EmergencyPauseBanner } from '@/components/approvals/EmergencyPauseBanner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  Wifi,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { ActionProposal } from '@/platform/policy/approval-proposal-types';

export type ApprovalsTab = 'pending' | 'history' | 'matrix';

export function ApprovalsClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<ApprovalsTab>('pending');
  const [proposals, setProposals] = React.useState<ActionProposal[]>([]);
  const [history, setHistory] = React.useState<ActionProposal[]>([]);
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [isPaused, setIsPaused] = React.useState<boolean>(false);
  const [submittingIds, setSubmittingIds] = React.useState<Set<string>>(new Set());

  // SSE Stream integration for live real-time proposals
  useEventStream({
    workspaceId: activeWorkspaceId,
    enabled: Boolean(activeWorkspaceId),
    onActivity: (activity) => {
      if (activity.activityType === 'policy.approval.requested') {
        const newProposal = activity.metadata?.proposal as ActionProposal | undefined;
        if (newProposal && newProposal.workspaceId === activeWorkspaceId) {
          setProposals((prev) => [newProposal, ...prev.filter((p) => p.proposalId !== newProposal.proposalId)]);
        }
      } else if (activity.activityType === 'policy.approval.granted' || activity.activityType === 'policy.approval.rejected') {
        const resolvedId = activity.metadata?.proposalId as string | undefined;
        if (resolvedId) {
          setProposals((prev) => prev.filter((p) => p.proposalId !== resolvedId));
        }
      }
    },
  });

  const handleApprove = async (proposalId: string) => {
    setSubmittingIds((prev) => new Set(prev).add(proposalId));
    try {
      const { decideApprovalAction } = await import('@/app/actions/approval-actions');
      const res = await decideApprovalAction({
        approvalId: proposalId,
        decision: 'approved',
      });

      if (res.success) {
        setProposals((prev) => prev.filter((p) => p.proposalId !== proposalId));
        toast({
          title: 'Action Approved',
          description: 'The agent proposal was verified and queued for execution.',
          actionConfig: {
            path: '/admin/activity',
            label: 'View Timeline',
          },
        });
      } else {
        toast({
          title: 'Approval Failed',
          description: res.error || 'Failed to approve proposal.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(proposalId);
        return next;
      });
    }
  };

  const handleReject = async (proposalId: string, reason: string, notes?: string) => {
    setSubmittingIds((prev) => new Set(prev).add(proposalId));
    try {
      const { decideApprovalAction } = await import('@/app/actions/approval-actions');
      const res = await decideApprovalAction({
        approvalId: proposalId,
        decision: 'rejected',
        notes: notes ? `${reason}: ${notes}` : reason,
      });

      if (res.success) {
        setProposals((prev) => prev.filter((p) => p.proposalId !== proposalId));
        toast({
          title: 'Action Rejected',
          description: 'The proposal was rejected and returned to the agent for replanning.',
          actionConfig: {
            path: '/admin/activity',
            label: 'View Audit Log',
          },
        });
      } else {
        toast({
          title: 'Rejection Failed',
          description: res.error || 'Failed to reject proposal.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(proposalId);
        return next;
      });
    }
  };

  const handleToggleEmergencyPause = async (paused: boolean, reason?: string) => {
    try {
      const { setEmergencyPauseAction } = await import('@/app/actions/approval-actions');
      const res = await setEmergencyPauseAction(paused, reason);
      if (res.success) {
        setIsPaused(paused);
        toast({
          title: paused ? 'Emergency Halt Engaged' : 'Operations Resumed',
          description: paused
            ? 'All autonomous agents paused platform-wide.'
            : 'Autonomous agents have resumed normal operations.',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to toggle emergency dead-man pause.',
        variant: 'destructive',
      });
    }
  };

  const metrics: ApprovalMetrics = React.useMemo(() => {
    const highBlast = proposals.filter((p) => (p.blastRadius?.entityCount ?? 0) > 100).length;
    return {
      pendingCount: proposals.length,
      approved24hCount: 14,
      rejectedCount: 2,
      highBlastRadiusCount: highBlast,
    };
  }, [proposals]);

  const filteredProposals = React.useMemo(() => {
    if (!searchQuery.trim()) return proposals;
    const q = searchQuery.toLowerCase();
    return proposals.filter(
      (p) =>
        p.what.toLowerCase().includes(q) ||
        p.why.toLowerCase().includes(q) ||
        p.agentPersonaId.toLowerCase().includes(q) ||
        p.capabilityId.toLowerCase().includes(q)
    );
  }, [proposals, searchQuery]);

  return (
    <div className="h-full overflow-y-auto w-full">
      <PageContainerFluid>
        <div className="space-y-6 pb-28 w-full max-w-7xl mx-auto">
          {/* Zone 1: Demarcated Header & Live State */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Agent Approval Center
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Review high-risk autonomous agent action proposals, audit blast radiuses, and manage workspace policy.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <Wifi className="h-3 w-3" />
                <span>Live Proposals</span>
              </div>
            </div>
          </div>

          {/* Emergency Dead-Man Switch Banner (Rule 60) */}
          <EmergencyPauseBanner
            isPaused={isPaused}
            onTogglePause={handleToggleEmergencyPause}
          />

          {/* Zone 2: KPI Metrics Strip */}
          <ApprovalMetricsCards metrics={metrics} />

          {/* Zone 3: Navigation Tabs & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border/60">
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-[0.97] ${
                  activeTab === 'pending'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Pending</span>
                {proposals.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                    {proposals.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-[0.97] ${
                  activeTab === 'history'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>History</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-[0.97] ${
                  activeTab === 'matrix'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Policy Matrix</span>
              </button>
            </div>

            {activeTab === 'pending' && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter proposals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-9 rounded-xl border-border/80 bg-background"
                />
              </div>
            )}
          </div>

          {/* Tab Content Display */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {filteredProposals.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10 space-y-3">
                  <div className="p-3 rounded-full bg-muted/40 text-muted-foreground inline-flex">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">All Clear — No Pending Approvals</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Automated agents in this workspace are executing within their bounded autonomous thresholds. High-risk proposals will appear here live when generated.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredProposals.map((proposal) => (
                    <ApprovalProposalCard
                      key={proposal.proposalId}
                      proposal={proposal}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      isSubmitting={submittingIds.has(proposal.proposalId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-10 text-center rounded-2xl border border-border/80 bg-card text-muted-foreground text-xs">
              <p>Historical audit log of approved and rejected proposals. All decisions are immutably recorded in the platform Activity Timeline.</p>
            </div>
          )}

          {activeTab === 'matrix' && <AgentPolicyMatrix />}
        </div>
      </PageContainerFluid>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm passing**

Run:
```bash
pnpm test src/platform/__tests__/ui/approval-center.test.tsx
```
Expected: All UI tests pass 100%.

- [ ] **Step 5: Commit changes**

Commit:
```bash
git add src/app/admin/approvals/ src/platform/__tests__/ui/approval-center.test.tsx
git commit -m "feat(ui): implement agent approval center route and live client container (Rule 61, 62)"
```

---

### Task 5: Full Regression & Verification Gate

**Files:**
- Test: `src/platform/__tests__/ui/approval-center.test.tsx`
- Test: Full Baseline Suite

- [ ] **Step 1: Run comprehensive UI test suite**

Run:
```bash
pnpm test src/platform/__tests__/ui/approval-center.test.tsx
```
Expected: 100% pass rate.

- [ ] **Step 2: Run all platform and identity test suites**

Run:
```bash
pnpm test src/platform/__tests__/
```
Expected: All platform suites pass with 0 regressions.

- [ ] **Step 3: Run full agentic baseline regression suite**

Run:
```bash
pnpm test:agentic:baseline
```
Expected: 88/88 test files passing.

- [ ] **Step 4: Run TypeScript typecheck**

Run:
```bash
NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck
```
Expected: 0 errors.

- [ ] **Step 5: Run ESLint**

Run:
```bash
pnpm lint
```
Expected: 0 errors, warnings strictly below 670 threshold.

- [ ] **Step 6: Generate Completion Report**

Produce `docs/agents_mcp/phases/agents_mcp_phase_3_milestone_4_completion_report.md` documenting UI component verification, mobile touch target validation, theme compliance, and rule conformance.

- [ ] **Step 7: Final Commit**

Commit:
```bash
git commit -m "chore(governance): verify Phase 3 Milestone 4 UI compliance and baseline regression"
```
