/**
 * @fileOverview Tenant AI data policy: which external AI providers may receive which data
 * (Phase 11 M1 · T4.0; Rules 32, 33, 57). Shared with M0 T6.0 (embeddings) so there is ONE gate.
 *
 * STORAGE
 *   organizations/{orgId}.aiDataPolicy            organization default
 *   ai_data_policies/{workspaceId}                workspace override (Backoffice-editable)
 *   platform_config/meeting_controls              global emergency switches (Rule 60)
 *
 * DEFAULT = TODAY'S BEHAVIOUR: with no policy stored, every configured provider is allowed, so
 * turning this gate on changes nothing until an operator restricts a tenant (no functionality loss).
 *
 * RESOLUTION: workspace override wins over the organization default, field by field. A provider is
 * allowed for a data class when it is in `allowedProviders` AND (for 'personal' data) not in
 * `blockedForPersonalData`. The global `blockAudioEgress` switch refuses all audio egress.
 *
 * CAUTION: fail CLOSED on read errors for audio egress (it is personal data leaving SmartSapp); the
 * caller turns that into a retryable "try again" rather than sending data under an unknown policy.
 *
 * Tests: src/platform/__tests__/policy/ai-data-policy.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import type { AiProviderId } from '@/lib/ai/model-registry';

export const AI_PROVIDERS: readonly AiProviderId[] = ['googleai', 'anthropic', 'openrouter'];
const ProviderSchema = z.enum(['googleai', 'anthropic', 'openrouter']);

export const AiDataPolicySchema = z.object({
  allowedProviders: z.array(ProviderSchema).optional(),
  blockedForPersonalData: z.array(ProviderSchema).optional(),
  region: z.string().max(40).optional(),
});
export type AiDataPolicy = z.infer<typeof AiDataPolicySchema>;

const MeetingControlsSchema = z.object({
  blockAudioEgress: z.boolean().optional(),
  transcriptionPaused: z.boolean().optional(),
  meetingAnalystPaused: z.boolean().optional(),
  pipelineQueuePaused: z.boolean().optional(),
  autoTriggerDisabled: z.boolean().optional(),
  proposalsPaused: z.boolean().optional(),
}).loose();
export type MeetingControls = z.infer<typeof MeetingControlsSchema>;

export type DataClass = 'public' | 'internal' | 'confidential' | 'personal';

export class DataPolicyDeniedError extends Error {
  readonly code = 'FORBIDDEN';
  constructor(message: string) {
    super(message);
    this.name = 'DataPolicyDeniedError';
  }
}

export interface EffectiveAiDataPolicy {
  allowedProviders: readonly AiProviderId[];
  blockedForPersonalData: readonly AiProviderId[];
  region?: string;
}

export async function resolveAiDataPolicy(
  db: Firestore,
  tenant: { organizationId?: string; workspaceId: string }
): Promise<EffectiveAiDataPolicy> {
  const [orgSnap, wsSnap] = await Promise.all([
    tenant.organizationId ? db.collection('organizations').doc(tenant.organizationId).get() : null,
    db.collection('ai_data_policies').doc(tenant.workspaceId).get(),
  ]);
  const org = AiDataPolicySchema.safeParse(orgSnap?.data()?.aiDataPolicy ?? {});
  const ws = AiDataPolicySchema.safeParse(wsSnap.exists ? wsSnap.data() : {});
  // A malformed stored policy is treated as "most restrictive" rather than "allow all".
  if (!org.success || !ws.success) return { allowedProviders: [], blockedForPersonalData: [...AI_PROVIDERS] };
  return {
    allowedProviders: ws.data.allowedProviders ?? org.data.allowedProviders ?? AI_PROVIDERS,
    blockedForPersonalData: ws.data.blockedForPersonalData ?? org.data.blockedForPersonalData ?? [],
    region: ws.data.region ?? org.data.region,
  };
}

/** Providers that may receive data of this class for this tenant. */
export function providersAllowedFor(policy: EffectiveAiDataPolicy, dataClass: DataClass): AiProviderId[] {
  return policy.allowedProviders.filter((p) => dataClass !== 'personal' || !policy.blockedForPersonalData.includes(p));
}

export async function readMeetingControls(db: Firestore): Promise<MeetingControls> {
  const snap = await db.collection('platform_config').doc('meeting_controls').get();
  const parsed = MeetingControlsSchema.safeParse(snap.exists ? snap.data() : {});
  return parsed.success ? parsed.data : {
    blockAudioEgress: true,
    transcriptionPaused: true,
    meetingAnalystPaused: true,
    pipelineQueuePaused: true,
    autoTriggerDisabled: true,
    proposalsPaused: true,
  };
}

/**
 * Throws `DataPolicyDeniedError` unless `provider` may receive `dataClass` data for this tenant
 * and (for audio) audio egress is not globally blocked.
 */
export async function assertProviderAllowed(
  db: Firestore,
  params: { organizationId?: string; workspaceId: string; provider: AiProviderId; dataClass: DataClass; audio?: boolean }
): Promise<void> {
  if (params.audio) {
    const controls = await readMeetingControls(db);
    if (controls.blockAudioEgress) throw new DataPolicyDeniedError('Sending recordings for transcription is paused by an administrator.');
  }
  const policy = await resolveAiDataPolicy(db, params);
  if (!providersAllowedFor(policy, params.dataClass).includes(params.provider)) {
    throw new DataPolicyDeniedError("Your workspace doesn't allow this recording to be sent for transcription.");
  }
}
