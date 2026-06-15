import { adminDb } from '../../firebase-admin';
import { sendMessage } from '../../messaging-engine';
import { resolveContact } from '../../contact-adapter';
import type { ExecutionContext } from '../execution-types';

export async function handleSendMessage(
  config: Record<string, unknown>,
  context: ExecutionContext
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
          const primaryVal = usePhone ?primary?.phone : primary?.email;
          if (primaryVal) {
            recipients.add(primaryVal);
          } else if (channel === 'email' && contact?.contacts?.[0]?.email) {
            recipients.add(contact.contacts[0].email);
          }
        }
      }

      // 2. Primary Contact
      if (targets.includes('primary')) {
        const primary = entityContacts.find(ec => ec.isPrimary);
        const primaryVal = usePhone ?primary?.phone : primary?.email;
        if (primaryVal) {
          recipients.add(primaryVal);
        } else if (channel === 'email' && contact?.contacts?.[0]?.email) {
          recipients.add(contact.contacts[0].email);
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

  const recipientList = Array.from(recipients);
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

      await sendMessage({
        templateId: (config.templateId as string) || 'automation-generated',
        senderProfileId: (config.senderProfileId as string) || 'default',
        recipient: recipient,
        variables: sendMessageVars,
        entityId: context.entityId,
        workspaceId: context.workspaceId,
        ...(rendered.subject && { subject: rendered.subject }),
        body: rendered.body,
      });
    } else {
      await sendMessage({
        templateId: config.templateId as string,
        senderProfileId: (config.senderProfileId as string) || 'default',
        recipient: recipient,
        variables: sendMessageVars,
        entityId: context.entityId,
        workspaceId: context.workspaceId,
      });
    }
  }
}
