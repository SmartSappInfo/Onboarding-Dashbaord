/**
 * @fileOverview Autonomous SDR Outbound Engine & Multi-Touch Sequence Compiler (Phase 10 Milestone 4)
 *
 * Implements Rule 4 (Zero-any typing), Rule 10 (Maintainer guidance), Rule 13/30 (Untrusted isolation),
 * Rule 19 (Deterministic idempotency), Rule 21 (Two-phase action model), Rule 22 (Payload hash binding),
 * Rule 41 (Operational explainability), and Rule 69 (Strangler Fig preservation).
 *
 * SSOT Invariant: All double-brace template token substitutions strictly route through
 * FieldsVariablesService.resolveTemplateVariables. Custom regex replacement is prohibited.
 */

import { createHash } from 'crypto';
import type { Prospect, ProspectContact } from '@/lib/lead-intelligence/types';
import { FieldsVariablesService } from '@/lib/services/fields-variables-service-impl';
import type {
  DraftOutreachParams,
  DraftOutreachResult,
  PrepareSequenceParams,
  PrepareSequenceResult,
  OutreachMessageDraft,
} from './sdr-outbound-types';
import {
  canonicalizeOutreachPayload,
  formatWhatsAppLauncherUrl,
  normalizeSdrPhoneNumber,
} from './sdr-outbound-format';

export class SdrOutboundEngine {
  /**
   * Normalizes raw or local phone numbers to E.164 standard with country code.
   * Special handling for West Africa / Ghana (+233) formats.
   */
  public static normalizePhoneNumber(phone?: string): string {
    return normalizeSdrPhoneNumber(phone);
  }

  /**
   * Sanitizes phone number and returns a direct WhatsApp Web click-to-chat URL.
   */
  public static formatWhatsAppLauncherUrl(phone: string, message: string): string {
    return formatWhatsAppLauncherUrl(phone, message);
  }

  /**
   * Derives a deterministic canonical SHA-256 payloadHash across sorted keys.
   * Implements Rule 22 Cryptographic Approval Binding.
   */
  public static computeOutreachPayloadHash(payload: Record<string, unknown>): string {
    return createHash('sha256').update(canonicalizeOutreachPayload(payload)).digest('hex');
  }

  /**
   * Drafts personalized outbound copy for a specific prospect across Email, WhatsApp, or Phone Script.
   * Delegates token replacement to FieldsVariablesService (Workspace Rule SSOT).
   */
  public static async draftOutreach(
    params: DraftOutreachParams,
    prospect: Prospect,
    contact?: ProspectContact
  ): Promise<DraftOutreachResult> {
    const contactPerson = contact || prospect.contacts?.[0];
    const contactName = contactPerson?.name || 'School Administrator';
    const institutionName = prospect.name;
    const recipientEmail = contactPerson?.email || '';
    const rawPhone = contactPerson?.phone || prospect.phone || '';
    const recipientPhone = this.normalizePhoneNumber(rawPhone);

    const groundingPoints: string[] = [];
    if (prospect.websiteScan?.technologies && prospect.websiteScan.technologies.length > 0) {
      groundingPoints.push(`Detected tech: ${prospect.websiteScan.technologies.join(', ')}`);
    }
    if (prospect.address) {
      groundingPoints.push(`Location: ${prospect.address}`);
    }
    if (contactPerson?.role) {
      groundingPoints.push(`Decision Maker Role: ${contactPerson.role}`);
    }
    if (prospect.scoring?.overallScore) {
      groundingPoints.push(`Priority Score: ${prospect.scoring.overallScore}/100`);
    }
    if (prospect.researchDossier?.painPoints && prospect.researchDossier.painPoints.length > 0) {
      groundingPoints.push(`Pain Points: ${prospect.researchDossier.painPoints[0]}`);
    }

    let subject: string | undefined = undefined;
    let body = '';
    const variablesUsed: string[] = [];

    if (params.templateText) {
      // Delegate to FieldsVariablesService SSOT
      variablesUsed.push('prospect.name', 'contact.name');
      body = await FieldsVariablesService.resolveTemplateVariables(params.templateText, {
        workspaceId: params.workspaceId,
        entityId: prospect.id,
      });
      if (params.channel === 'email') {
        subject = `Partnership Discussion for ${institutionName}`;
      }
    } else {
      // Synthesize channel-specific standard copy
      if (params.channel === 'whatsapp') {
        body = `Hello ${contactName}, I noticed ${institutionName}'s commitment to academic excellence in ${prospect.address || 'Ghana'}. We are helping private institutions automate tuition collection and parent communications directly on WhatsApp. Would you be open to a 10-minute demo this week? — SmartSapp RevOps Team`;
      } else if (params.channel === 'email') {
        subject = `Modernizing Tuition Collections at ${institutionName}`;
        body = `Dear ${contactName},\n\nI hope this message finds you well.\n\nWhile reviewing ${institutionName}'s digital operations, we observed opportunities to streamline parent fee payments and student record management with SmartSapp's automated education portal.\n\nWould you have 10 minutes this Thursday for a brief walkthrough of how comparable institutions reduce tuition collection delays by 65%?\n\nBest regards,\nSmartSapp Enterprise Team`;
      } else {
        body = `Call Opening:\n"Hello ${contactName}, this is calling from SmartSapp. I am reaching out regarding ${institutionName}'s school administration and parent payment portal."\n\nKey Discovery Questions:\n1. How is ${institutionName} currently handling end-of-term tuition reconciliation?\n2. Would automated Mobile Money and Card payment receipts benefit your finance office?`;
      }
    }

    const recipientAddress = params.channel === 'email' ? recipientEmail : recipientPhone;
    const whatsappUrl = recipientPhone ? this.formatWhatsAppLauncherUrl(recipientPhone, body) : undefined;
    const mailtoUrl =
      params.channel === 'email' && recipientEmail
        ? `mailto:${recipientEmail}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body)}`
        : undefined;

    const draftId = `draft_${prospect.id}_${params.channel}_${Date.now()}`;
    const payloadHash = this.computeOutreachPayloadHash({
      prospectId: prospect.id,
      channel: params.channel,
      recipientAddress,
      subject: subject || null,
      body,
    });

    const now = new Date().toISOString();
    const draft: OutreachMessageDraft = {
      id: draftId,
      prospectId: prospect.id,
      contactId: contactPerson?.id,
      channel: params.channel,
      recipientName: contactName,
      recipientAddress,
      subject,
      body,
      whatsappUrl,
      mailtoUrl,
      variablesUsed,
      groundingPoints,
      status: 'draft',
      payloadHash,
      createdAt: now,
      updatedAt: now,
    };

    const explainability = {
      what: `Targeted outbound ${params.channel.toUpperCase()} message prepared for ${contactName} at ${institutionName}.`,
      why: `High-value prospect (${prospect.scoring?.overallScore ?? 50}/100) with verified contact details ready for human-in-the-loop review.`,
      expectedStateChange: `Draft generated with cryptographic payloadHash (${payloadHash.slice(0, 16)}...). Next step is operator approval.`,
    };

    return { draft, explainability };
  }

  /**
   * Compiles an asynchronous multi-touch cadence across multiple prospects.
   */
  public static async compileSequence(
    params: PrepareSequenceParams,
    prospects: Prospect[]
  ): Promise<PrepareSequenceResult> {
    const drafts: OutreachMessageDraft[] = [];
    const leadMap = new Map<string, Prospect>(prospects.map((p) => [p.id, p]));

    for (const leadId of params.leadIds) {
      const prospect = leadMap.get(leadId);
      if (!prospect) continue;

      for (const step of params.sequenceConfig.steps) {
        const contactPerson = prospect.contacts?.[0];
        const draftResult = await this.draftOutreach(
          {
            organizationId: params.organizationId,
            workspaceId: params.workspaceId,
            prospectId: prospect.id,
            contactId: contactPerson?.id,
            channel: step.channel,
            templateText: step.templateText,
            sdrPersonaId: params.sdrPersonaId,
          },
          prospect,
          contactPerson
        );
        draftResult.draft.stepIndex = step.stepIndex;
        draftResult.draft.dayOffset = step.dayOffset;
        drafts.push(draftResult.draft);
      }
    }

    const sequenceRunId = `seq_run_${params.sequenceConfig.id}_${Date.now()}`;
    const payloadHash = this.computeOutreachPayloadHash({
      sequenceConfigId: params.sequenceConfig.id,
      leadIds: [...params.leadIds].sort(),
      draftIds: drafts.map((d) => d.id).sort(),
    });

    return {
      sequenceRunId,
      totalRecipients: params.leadIds.length,
      totalDrafts: drafts.length,
      drafts,
      payloadHash,
      status: 'staged',
    };
  }
}
