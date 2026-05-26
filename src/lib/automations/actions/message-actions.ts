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
      recipient: resolvedRecipient || '',
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
      recipient: resolvedRecipient || '',
      variables: sendMessageVars,
      entityId: context.entityId,
      workspaceId: context.workspaceId,
    });
  }
}
