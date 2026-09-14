'use server';

/**
 * @fileOverview Server actions for outbound webhook delivery for new school signups.
 * 
 * ARCHITECTURAL DESIGN & RATIONALE:
 * External webhook dispatches (such as Pabbly workflows and SmartSapp Automations ingress)
 * are executed from the server side. This resolves CORS limitations that arise from browser-origin
 * network requests, avoids exposing sensitive client keys, and ensures consistent payload formatting.
 * 
 * Target Webhooks:
 * 1. Pabbly Workflow: External automation routing to SMS/email notification sequences.
 * 2. SmartSapp Automations: Internal universal ingress endpoint (/api/automations/webhook/TSRkUBIo6neV20iL526t)
 *    triggering workspace-configured event flows (WEBHOOK_RECEIVED).
 * 
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Endpoints run in parallel via Promise.allSettled so that a temporary timeout or error on one target
 *   never disrupts delivery to the other targets.
 * - Strict typing (Rule 5) is maintained: zero `any` or `any[]`.
 */

import { getErrorMessage } from '@/lib/errors/report-error';
import {
  SIGNUP_WEBHOOK_TARGETS,
  type WebhookTargetOption,
  type WebhookDispatchResult,
  type DispatchSignupWebhookResponse,
} from './webhook-constants';

export type { WebhookTargetOption, DispatchSignupWebhookResponse, WebhookDispatchResult };

/**
 * Dispatches signup payload to selected webhook targets in parallel.
 * Returns detailed statuses for auditability without throwing on partial failures.
 */
export async function dispatchSignupWebhook(
  webhookData: Record<string, unknown>,
  targetOption: WebhookTargetOption = 'both'
): Promise<DispatchSignupWebhookResponse> {
  const dispatchedAt = new Date().toISOString();

  if (targetOption === 'none') {
    console.log(`>>> [WEBHOOK] Webhook delivery disabled (targetOption: none) at ${dispatchedAt}. Skipping.`);
    return {
      success: true,
      dispatchedAt,
      results: [],
    };
  }

  const activeTargets = targetOption === 'both'
    ? SIGNUP_WEBHOOK_TARGETS
    : SIGNUP_WEBHOOK_TARGETS.filter((t) => t.id === targetOption);

  console.log(`>>> [WEBHOOK] Dispatching signup data to ${activeTargets.length} webhook target(s) (${targetOption}) at ${dispatchedAt}...`);

  const settledResults = await Promise.allSettled(
    activeTargets.map(async (target): Promise<WebhookDispatchResult> => {
      console.log(`>>> [WEBHOOK] Initiating POST to ${target.name}: ${target.url}`);
      try {
        const response = await fetch(target.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookData),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error(`>>> [WEBHOOK] ${target.name} returned status ${response.status}: ${response.statusText}`);
          if (errorText) console.error(`>>> [WEBHOOK] ${target.name} error body:`, errorText);

          return {
            id: target.id,
            name: target.name,
            url: target.url,
            success: false,
            statusCode: response.status,
            error: `Target returned HTTP ${response.status}: ${response.statusText}`,
          };
        }

        console.log(`>>> [WEBHOOK] Successfully dispatched to ${target.name} (HTTP ${response.status})`);
        return {
          id: target.id,
          name: target.name,
          url: target.url,
          success: true,
          statusCode: response.status,
        };
      } catch (error: unknown) {
        const errMsg = getErrorMessage(error);
        console.error(`>>> [WEBHOOK] Network/transport failure for ${target.name}:`, errMsg);
        return {
          id: target.id,
          name: target.name,
          url: target.url,
          success: false,
          error: errMsg,
        };
      }
    })
  );

  const results: WebhookDispatchResult[] = settledResults.map((settled, index) => {
    if (settled.status === 'fulfilled') {
      return settled.value;
    }
    const target = SIGNUP_WEBHOOK_TARGETS[index];
    return {
      id: target.id,
      name: target.name,
      url: target.url,
      success: false,
      error: getErrorMessage(settled.reason),
    };
  });

  const anySuccess = results.some((r) => r.success);
  return {
    success: anySuccess,
    dispatchedAt,
    results,
    error: anySuccess ? undefined : 'All configured webhook destinations failed to receive payload',
  };
}

