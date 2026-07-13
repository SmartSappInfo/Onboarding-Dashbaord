import { adminDb } from '../../firebase-admin';
import { sendMessage } from '../../messaging-engine';
import { resolveContact } from '../../contact-adapter';
import type { ExecutionContext } from '../execution-types';

export interface ResendSendOverride {
  /** Subject (email) / leading line (SMS) override for this resend attempt. */
  subject?: string;
  /** Preview text override for this resend attempt. */
  previewText?: string;
  isResend: boolean;
  resendNumber: number;
}

export async function handleSendMessage(
  config: Record<string, unknown>,
  context: ExecutionContext,
  nodeId?: string,
  resendOverride?: ResendSendOverride
): Promise<void> {
  if (!config.templateId && (!config.templateCategory || !config.templateType)) {
    throw new Error(
      'Message action missing template configuration (templateId or category/type).'
    );
  }

  const channel = (config.channel as 'email' | 'sms' | 'whatsapp') || 'email';
  // SMS and WhatsApp both deliver to the phone field; only email uses email.
  const usePhone = channel !== 'email';
  const targets = (config.recipientTargets || []) as string[];
  const roles = (config.recipientRoles || []) as string[];

  const recipients = new Set<string>();

  if (targets.length > 0) {
    if (context.entityId) {
      const contact = await resolveContact(context.entityId, context.workspaceId);
      const entityContacts = contact?.entityContacts || [];

      // 1. Triggering Contact
      if (targets.includes('triggering')) {
        const triggerContactVal = usePhone
          ? (context.payload.phone || context.payload.contactPhone)
          : (context.payload.email || context.payload.contactEmail);
        if (triggerContactVal) {
          recipients.add(String(triggerContactVal));
        } else {
          const primary = entityContacts.find(ec => ec.isPrimary);
          const primaryVal = usePhone ? primary?.phone : primary?.email;
          if (primaryVal) {
            recipients.add(primaryVal);
          } else {
            const fallbackVal = usePhone
              ? (contact?.primaryContactPhone || contact?.contacts?.[0]?.phone)
              : (contact?.primaryContactEmail || contact?.contacts?.[0]?.email);
            if (fallbackVal) {
              recipients.add(String(fallbackVal));
            }
          }
        }
      }

      // 2. Primary Contact
      if (targets.includes('primary')) {
        const primary = entityContacts.find(ec => ec.isPrimary);
        const primaryVal = usePhone ? primary?.phone : primary?.email;
        if (primaryVal) {
          recipients.add(primaryVal);
        } else {
          const fallbackVal = usePhone
            ? (contact?.primaryContactPhone || contact?.contacts?.[0]?.phone)
            : (contact?.primaryContactEmail || contact?.contacts?.[0]?.email);
          if (fallbackVal) {
            recipients.add(String(fallbackVal));
          }
        }
      }

      // 3. Signatories
      if (targets.includes('signatories')) {
        entityContacts.filter(ec => ec.isSignatory).forEach(ec => {
          const val = usePhone ?ec.phone : ec.email;
          if (val) recipients.add(val);
        });
      }

      // 4. Specific Role(s)
      if (targets.includes('roles') && roles.length > 0) {
        entityContacts.filter(ec => 
          ec.typeLabel && roles.some(r => r.toLowerCase() === ec.typeLabel?.toLowerCase() || r.toLowerCase() === ec.typeKey?.toLowerCase())
        ).forEach(ec => {
          const val = usePhone ?ec.phone : ec.email;
          if (val) recipients.add(val);
        });
      }

      // 5. All Contacts
      if (targets.includes('all')) {
        entityContacts.forEach(ec => {
          const val = usePhone ?ec.phone : ec.email;
          if (val) recipients.add(val);
        });
      }
    }

    // 6. Manual Identity Entry
    if (targets.includes('fixed') && config.recipient) {
      recipients.add(String(config.recipient));
    }
  } else {
    // Legacy fallback
    let resolvedRecipient = config.recipient as string | undefined;
    if (context.entityId && !resolvedRecipient) {
      const contact = await resolveContact(context.entityId, context.workspaceId);
      const primaryEmail = contact?.entityContacts?.find((ec) => ec.isPrimary)?.email;
      if (primaryEmail) {
        resolvedRecipient = primaryEmail;
      } else if (contact?.contacts?.[0]?.email) {
        resolvedRecipient = contact.contacts[0].email;
      }
    }
    if (resolvedRecipient) {
      recipients.add(resolvedRecipient);
    }
  }

  // Filter final recipients based on contact emailStatus and score
  const finalRecipientsList = new Set<string>();
  if (context.entityId) {
    const contact = await resolveContact(context.entityId, context.workspaceId);
    const entityContacts = contact?.entityContacts || [];
    
    for (const r of recipients) {
      const matchedContact = entityContacts.find(ec => 
        (usePhone ? ec.phone : ec.email)?.toLowerCase().trim() === r.toLowerCase().trim()
      );
      if (matchedContact) {
        if (usePhone) {
          const isBounced = matchedContact.phoneStatus === 'failed';
          const isLowScore = typeof matchedContact.phoneVerificationScore === 'number' && matchedContact.phoneVerificationScore < 40;
          if (isBounced || isLowScore) {
            console.log(`[MessageActionGuard] Skipped sending message to ${r} due to bounced/low verification phone status.`);
            continue;
          }
        } else {
          const isBounced = matchedContact.emailStatus === 'bounced';
          const isLowScore = typeof matchedContact.emailVerificationScore === 'number' && matchedContact.emailVerificationScore < 40;
          if (isBounced || isLowScore) {
            console.log(`[MessageActionGuard] Skipped sending message to ${r} due to bounced/low verification email status.`);
            continue;
          }
        }
      }
      finalRecipientsList.add(r);
    }
  } else {
    for (const r of recipients) {
      finalRecipientsList.add(r);
    }
  }

  const recipientList = Array.from(finalRecipientsList);
  if (recipientList.length === 0) {
    throw new Error('Message action could not resolve any recipients to send to.');
  }

  const p = context.payload;
  const meetingId = p.meetingId || p.meeting_id || p.id;
  const formId = p.formId || p.form_id || p.pdfId;
  const surveyId = p.surveyId || p.survey_id;
  const agreementId = p.agreementId || p.agreement_id || p.contractId;
  const responseId = p.responseId || p.response_id;
  const submissionId = p.submissionId || p.submission_id;
  const userId = p.userId || p.user_id;

  const resolutionCtx: Record<string, unknown> = {
    entityId: context.entityId,
    workspaceId: context.workspaceId,
    extraVars: { ...p },
  };
  if (meetingId) resolutionCtx.meetingId = meetingId;
  if (formId) resolutionCtx.formId = formId;
  if (surveyId) resolutionCtx.surveyId = surveyId;
  if (agreementId) resolutionCtx.agreementId = agreementId;
  if (responseId) resolutionCtx.responseId = responseId;
  if (submissionId) resolutionCtx.submissionId = submissionId;
  if (userId) resolutionCtx.userId = userId;

  const sendMessageVars: Record<string, unknown> = { ...p };
  if (meetingId) sendMessageVars._meetingId = meetingId;
  if (formId) sendMessageVars._formId = formId;
  if (surveyId) sendMessageVars._surveyId = surveyId;
  if (agreementId) sendMessageVars._agreementId = agreementId;
  if (responseId) sendMessageVars._responseId = responseId;
  if (submissionId) sendMessageVars._submissionId = submissionId;
  if (userId) sendMessageVars._userId = userId;

  for (const recipient of recipientList) {
    if (config.templateCategory && config.templateType) {
      const workspaceSnap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
      if (!workspaceSnap.exists) {
        throw new Error(`Workspace ${context.workspaceId} not found`);
      }
      const organizationId = workspaceSnap.data()!.organizationId;

      const { resolveAndRender } = await import('../../template-resolver');
      const rendered = await resolveAndRender(
        config.templateCategory as Parameters<typeof resolveAndRender>[0],
        config.templateType as Parameters<typeof resolveAndRender>[1],
        organizationId,
        resolutionCtx
      );

      const result = await sendMessage({
        templateId: (config.templateId as string) || 'automation-generated',
        senderProfileId: (config.senderProfileId as string) || 'default',
        organizationId: organizationId || context.organizationId,
        recipient: recipient,
        variables: sendMessageVars,
        entityId: context.entityId,
        workspaceId: context.workspaceId,
        ...(resendOverride?.subject
          ? { subject: resendOverride.subject }
          : (rendered.subject ? { subject: rendered.subject } : {})),
        body: rendered.body,
        automationId: context.automationId,
        runId: context.runId,
        ...(nodeId ? { nodeId } : {}),
        ...(resendOverride?.previewText ? { previewText: resendOverride.previewText } : {}),
        ...(resendOverride ? { isResend: resendOverride.isResend, resendNumber: resendOverride.resendNumber } : {}),
      });
      if (!result.success) {
        throw new Error(result.error || 'Template message sending failed.');
      }
    } else {
      const result = await sendMessage({
        templateId: config.templateId as string,
        senderProfileId: (config.senderProfileId as string) || 'default',
        organizationId: context.organizationId,
        recipient: recipient,
        variables: sendMessageVars,
        entityId: context.entityId,
        workspaceId: context.workspaceId,
        automationId: context.automationId,
        runId: context.runId,
        ...(nodeId ? { nodeId } : {}),
        ...(resendOverride?.subject ? { subject: resendOverride.subject } : {}),
        ...(resendOverride?.previewText ? { previewText: resendOverride.previewText } : {}),
        ...(resendOverride ? { isResend: resendOverride.isResend, resendNumber: resendOverride.resendNumber } : {}),
      });
      if (!result.success) {
        throw new Error(result.error || 'Template message sending failed.');
      }
    }
  }
}

export async function handleDirectMessage(
  actionType: 'DIRECT_EMAIL' | 'DIRECT_SMS' | string,
  config: Record<string, unknown>,
  context: ExecutionContext,
  nodeId?: string
): Promise<void> {
  const channel = actionType === 'DIRECT_EMAIL' ? 'email' : 'sms';
  const usePhone = channel === 'sms';
  const targets = (config.recipientTargets || []) as string[];
  const roles = (config.recipientRoles || []) as string[];

  const recipients = new Set<string>();

  if (targets.length > 0) {
    if (context.entityId) {
      const contact = await resolveContact(context.entityId, context.workspaceId);
      const entityContacts = contact?.entityContacts || [];

      // 1. Triggering Contact
      if (targets.includes('triggering')) {
        const triggerContactVal = usePhone
          ? (context.payload.phone || context.payload.contactPhone)
          : (context.payload.email || context.payload.contactEmail);
        if (triggerContactVal) {
          recipients.add(String(triggerContactVal));
        } else {
          const primary = entityContacts.find(ec => ec.isPrimary);
          const primaryVal = usePhone ? primary?.phone : primary?.email;
          if (primaryVal) {
            recipients.add(primaryVal);
          } else {
            const fallbackVal = usePhone
              ? (contact?.primaryContactPhone || contact?.contacts?.[0]?.phone)
              : (contact?.primaryContactEmail || contact?.contacts?.[0]?.email);
            if (fallbackVal) {
              recipients.add(String(fallbackVal));
            }
          }
        }
      }

      // 2. Primary Contact
      if (targets.includes('primary')) {
        const primary = entityContacts.find(ec => ec.isPrimary);
        const primaryVal = usePhone ? primary?.phone : primary?.email;
        if (primaryVal) {
          recipients.add(primaryVal);
        } else {
          const fallbackVal = usePhone
            ? (contact?.primaryContactPhone || contact?.contacts?.[0]?.phone)
            : (contact?.primaryContactEmail || contact?.contacts?.[0]?.email);
          if (fallbackVal) {
            recipients.add(String(fallbackVal));
          }
        }
      }

      // 3. Campus Signatories
      if (targets.includes('signatories')) {
        entityContacts.filter(ec => ec.isSignatory).forEach(ec => {
          const val = usePhone ? ec.phone : ec.email;
          if (val) recipients.add(val);
        });
      }

      // 4. Specific Role(s)
      if (targets.includes('roles') && roles.length > 0) {
        entityContacts.filter(ec => 
          ec.typeLabel && roles.some(r => r.toLowerCase() === ec.typeLabel?.toLowerCase() || r.toLowerCase() === ec.typeKey?.toLowerCase())
        ).forEach(ec => {
          const val = usePhone ? ec.phone : ec.email;
          if (val) recipients.add(val);
        });
      }

      // 5. All Contacts
      if (targets.includes('all')) {
        entityContacts.forEach(ec => {
          const val = usePhone ? ec.phone : ec.email;
          if (val) recipients.add(val);
        });
      }
    }

    // 6. Manual Identity Entry
    if (targets.includes('fixed') && config.recipient) {
      recipients.add(String(config.recipient));
    }
  }

  const recipientList = Array.from(recipients);
  if (recipientList.length === 0) {
    throw new Error(`Direct ${channel.toUpperCase()} action could not resolve any recipients.`);
  }

  const { sendRawMessage } = await import('../../messaging-engine');
  const { buildVariableMap } = await import('../../template-resolver');
  const { renderTemplate } = await import('../../template-utils');

  const senderProfileId = (config.senderProfileId as string) || 'default';

  // Build the variable map for compilation once to avoid repeating queries per-recipient
  const vars = await buildVariableMap('common', {
    entityId: context.entityId,
    workspaceId: context.workspaceId,
    extraVars: { ...context.payload },
  });

  // Parallel Execution of dispatches to eliminate waterfalls
  await Promise.all(
    recipientList.map(async (recipient) => {
      try {
        const rawSubject = channel === 'email' ? String(config.directSubject || 'Notification') : undefined;
        const rawBody = String(config.directBody || '');

        const resolvedSubject = rawSubject ? renderTemplate(rawSubject, vars) : undefined;
        const resolvedBodyContent = renderTemplate(rawBody, vars);

        const { generateSecureUnsubscribeLink } = await import('../../services/unsubscribe-service');
        const recipientUnsubLink = channel === 'email'
          ? await generateSecureUnsubscribeLink(recipient, context.entityId || null, context.workspaceId || null)
          : '';

        let finalBody = resolvedBodyContent;

        // If brand layout wrapper is enabled, wrap in dynamic HTML layout in memory
        if (channel === 'email' && config.useBrandLayout !== false) {
          const primaryColor = String(vars.brand_primary_color || '#3B5FFF');
          const orgName = String(vars.organization_name || vars.workspace_name || 'SmartSapp');
          const logoUrl = vars.org_logo_url ? String(vars.org_logo_url) : null;
          const logoHtml = logoUrl
            ? `<img src="${logoUrl}" alt="${orgName} Logo" style="max-height: 48px; margin-bottom: 24px; display: block;" />`
            : `<h2 style="color: ${primaryColor}; margin: 0 0 24px 0; font-family: Figtree, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">${orgName}</h2>`;

          const processedBodyContent = resolvedBodyContent
            .replace(/\{\{unsubscribe_link\}\}/g, recipientUnsubLink)
            .replace(/\{\{unsubscribe_url\}\}/g, recipientUnsubLink);

          // Resolve the org-configured footer (replaces hardcoded inline footer)
          const { resolveOrgFooter, buildOrgFooterVars } = await import('../../services/org-footer-service');
          const footerEnabled = String(vars.org_footer_enabled) !== 'false';
          const renderedFooter = resolveOrgFooter(
            vars.org_footer_html ? String(vars.org_footer_html) : undefined,
            footerEnabled,
            {
              ...buildOrgFooterVars(vars as Record<string, string>),
              unsubscribe_link: recipientUnsubLink,
            },
          );

          finalBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${resolvedSubject || 'Notification'}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; padding: 48px 16px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              ${logoHtml}
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px 40px; font-size: 15px; line-height: 1.625; color: #334155; font-family: Figtree, sans-serif;">
              ${processedBodyContent.replace(/\n/g, '<br />')}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${renderedFooter}
</body>
</html>
          `;
        } else if (channel === 'email') {
          finalBody = resolvedBodyContent
            .replace(/\{\{unsubscribe_link\}\}/g, recipientUnsubLink)
            .replace(/\{\{unsubscribe_url\}\}/g, recipientUnsubLink);
        }


        const result = await sendRawMessage({
          channel,
          recipient,
          body: finalBody,
          ...(resolvedSubject && { subject: resolvedSubject }),
          senderProfileId,
          organizationId: context.organizationId,
          variables: { 
            ...context.payload, 
            unsubscribe_link: recipientUnsubLink,
            unsubscribe_url: recipientUnsubLink 
          },
          workspaceIds: [context.workspaceId],
          messageType: 'transactional',
          entityId: context.entityId,
          entityType: context.entityType,
          isAutomation: true,
          automationId: context.automationId,
          runId: context.runId,
          ...(nodeId ? { nodeId } : {}),
        });

        if (!result.success) {
          console.warn(`>>> [AUTOMATION] Suppressed/Hygiene Blocked recipient ${recipient}: ${result.error}`);
          const { logAutomationEvent } = await import('../../automation-log');
          await logAutomationEvent('warn', 'recipient_delivery_failed', {
            automationId: context.automationId,
            runId: context.runId,
            workspaceId: context.workspaceId,
            entityId: context.entityId,
            recipient,
            error: result.error || 'Failed raw send'
          });
          throw new Error(result.error || 'Direct message sending failed.');
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`>>> [AUTOMATION] Failed direct message dispatch to ${recipient}:`, errorMsg);
        const { logAutomationEvent } = await import('../../automation-log');
        await logAutomationEvent('error', 'recipient_dispatch_error', {
          automationId: context.automationId,
          runId: context.runId,
          workspaceId: context.workspaceId,
          entityId: context.entityId,
          recipient,
          error: errorMsg
        });
        throw err;
      }
    })
  );
}
