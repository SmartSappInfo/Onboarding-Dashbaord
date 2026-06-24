/**
 * @fileOverview Pure, I/O-free sender-profile selection for the messaging engine.
 *
 * This module contains NO Firestore access so it stays fully unit-testable and
 * out of client bundles. The imperative shell (`sender-repository.ts`) loads the
 * candidate documents and feeds them here.
 *
 * Tenancy invariant: a message for organization X may only be sent from a sender
 * profile owned by organization X. Resolution walks a fixed hierarchy —
 * explicit → workspace default → org default — and STOPS at `no_sender` rather
 * than ever reaching for another organization's profile. There is no global
 * fallback.
 */

export type Channel = 'email' | 'sms' | 'whatsapp';

/** Minimal shape needed to decide ownership. Mapped from a SenderProfile by the I/O wrapper. */
export interface SenderCandidate {
  id: string;
  organizationId: string;
  isActive: boolean;
}

export type ResolutionSource = 'explicit' | 'workspace_default' | 'org_default' | 'none';

export type ResolutionOutcome =
  /** A usable, org-owned sender was selected. */
  | 'resolved'
  /** An explicit id was supplied but belongs to another org — a hard security reject. */
  | 'cross_org_explicit'
  /** No usable org-owned sender exists anywhere in the hierarchy. */
  | 'no_sender';

export interface SenderResolution {
  outcome: ResolutionOutcome;
  senderProfileId: string | null;
  source: ResolutionSource;
}

export interface PickInput {
  orgId: string;
  /** The explicitly requested profile (already loaded), or null if none/`'default'`/`'none'`. */
  explicit: SenderCandidate | null;
  /** The workspace-level default profile (already loaded), or null. */
  workspaceDefault: SenderCandidate | null;
  /** The org-level default profile (already loaded), or null. */
  orgDefault: SenderCandidate | null;
}

/** A candidate is usable only if it exists, is active, and is owned by the target org. */
function isUsable(candidate: SenderCandidate | null, orgId: string): boolean {
  return candidate !== null && candidate.isActive && candidate.organizationId === orgId;
}

/**
 * Select the sender profile id to use, or explain why none could be chosen.
 *
 * An explicit profile that exists but belongs to a different organization is a
 * hard reject (`cross_org_explicit`) — we never silently fall through to a
 * default, because doing so would mask a misconfigured or malicious request.
 */
export function pickSenderProfileId(input: PickInput): SenderResolution {
  const { orgId, explicit, workspaceDefault, orgDefault } = input;

  if (explicit !== null && explicit.organizationId !== orgId) {
    return { outcome: 'cross_org_explicit', senderProfileId: null, source: 'explicit' };
  }

  if (isUsable(explicit, orgId)) {
    return { outcome: 'resolved', senderProfileId: explicit!.id, source: 'explicit' };
  }

  if (isUsable(workspaceDefault, orgId)) {
    return { outcome: 'resolved', senderProfileId: workspaceDefault!.id, source: 'workspace_default' };
  }

  if (isUsable(orgDefault, orgId)) {
    return { outcome: 'resolved', senderProfileId: orgDefault!.id, source: 'org_default' };
  }

  return { outcome: 'no_sender', senderProfileId: null, source: 'none' };
}
