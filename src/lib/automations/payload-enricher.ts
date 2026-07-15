import { adminDb } from '../firebase-admin';
import { fetchLiveEntityTags } from './tag-enrichment';
import type { ConditionItem, ConditionGroup } from '../automation-condition';
import type { GoalConditionNode } from './jump-engine';

interface ActivityMetadata {
  templateId?: string;
  emailTemplateId?: string;
  linkUrl?: string;
  url?: string;
  event?: string;
  pageId?: string;
  qrId?: string;
  shortPath?: string;
}

interface ActivityDoc {
  type?: string;
  metadata?: ActivityMetadata;
  entityId?: string;
  workspaceId?: string;
}

interface SurveyResponseDoc {
  responses?: Record<string, unknown>;
  answers?: Record<string, unknown>;
}

interface PdfSubmissionDoc {
  formData?: Record<string, unknown>;
  fields?: Record<string, unknown>;
}

/**
 * Dynamically gathers live engagement activity logs, survey responses,
 * PDF submissions, and deal statuses from Firestore on-demand to enrich the
 * goal condition evaluation payload.
 *
 * Avoids any use of 'any' or 'any[]' to satisfy type-safety rules.
 */
export async function enrichPayloadWithLiveBehavioralData(
  entityId: string,
  workspaceId: string,
  node: GoalConditionNode,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  let enriched = { ...payload };
  const config = node.data?.config;
  if (!config) return enriched;

  const groups = config.groups || [];
  const conditions: ConditionItem[] = [];

  if (groups.length > 0) {
    groups.forEach((g: ConditionGroup) => {
      if (g.conditions) {
        conditions.push(...g.conditions);
      }
    });
  } else if (config.field) {
    conditions.push({
      id: 'legacy_node',
      field: config.field,
      operator: config.operator || '',
      value: config.value,
      emailTemplateId: config.emailTemplateId,
      linkUrl: config.linkUrl,
    });
  }

  // 1. Fetch tags if tag fields are checked
  const hasTagCheck = conditions.some((c) => c.field === 'tags' || c.field === 'tag');
  if (hasTagCheck) {
    const liveTags = await fetchLiveEntityTags(entityId, workspaceId);
    enriched.__liveTags = liveTags;
  }

  // 2. Fetch activities if campaign_action, landing_page_action, scanned_qr, short_link, or message actions are checked
  const checksActivity = conditions.some((c) =>
    ['campaign_action', 'landing_page_action', 'scanned_qr', 'short_link', 'email_action', 'sms_action', 'whatsapp_action'].includes(c.field)
  );

  if (checksActivity) {
    const activitiesSnap = await adminDb.collection('activities')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .get();

    const openedEmails: string[] = [];
    const openedTemplates: string[] = [];
    const clickedLinks: Record<string, string[]> = {};
    const repliedEmails: string[] = [];
    const repliedTemplates: string[] = [];
    const watchedVideos: string[] = [];
    const watchedFullVideos: string[] = [];
    const visitedPages: string[] = [];
    const submittedPageForms: string[] = [];
    const scannedQrs: string[] = [];
    const visitedShortlinks: string[] = [];

    activitiesSnap.forEach((doc) => {
      const act = doc.data() as ActivityDoc;
      const type = act.type || '';
      const meta = act.metadata || {};

      // Campaign actions
      if (type === 'email_opened' || (type === 'campaign_event' && meta.event === 'opened')) {
        const tId = String(meta.templateId || meta.emailTemplateId || '');
        if (tId) {
          openedEmails.push(tId);
          openedTemplates.push(tId);
        }
      }
      if (type === 'email_clicked' || (type === 'campaign_event' && meta.event === 'clicked')) {
        const tId = String(meta.templateId || meta.emailTemplateId || '');
        const url = String(meta.linkUrl || meta.url || '');
        if (tId) {
          if (!clickedLinks[tId]) {
            clickedLinks[tId] = [];
          }
          if (url && !clickedLinks[tId].includes(url)) {
            clickedLinks[tId].push(url);
          }
        }
      }
      if (type === 'email_replied' || (type === 'campaign_event' && meta.event === 'replied')) {
        const tId = String(meta.templateId || meta.emailTemplateId || '');
        if (tId) {
          repliedEmails.push(tId);
          repliedTemplates.push(tId);
        }
      }
      if (type === 'video_watched' || (type === 'campaign_event' && meta.event === 'watched_video')) {
        const tId = String(meta.templateId || meta.emailTemplateId || '');
        if (tId) {
          watchedVideos.push(tId);
        }
      }
      if (type === 'video_fully_watched' || (type === 'campaign_event' && meta.event === 'watched_full_video')) {
        const tId = String(meta.templateId || meta.emailTemplateId || '');
        if (tId) {
          watchedFullVideos.push(tId);
        }
      }

      // Page actions
      if (type === 'page_visited' || type === 'webpage_visited') {
        const pId = String(meta.pageId || '');
        if (pId) {
          visitedPages.push(pId);
        }
      }
      if (type === 'page_submitted') {
        const pId = String(meta.pageId || '');
        if (pId) {
          submittedPageForms.push(pId);
        }
      }

      // QR actions
      if (type === 'qr_scanned' || type === 'scanned_qr') {
        const qId = String(meta.qrId || '');
        if (qId) {
          scannedQrs.push(qId);
        }
      }

      // Shortlink actions
      if (type === 'short_link_visited' || type === 'visited_shortlink') {
        const sPath = String(meta.shortPath || '');
        if (sPath) {
          visitedShortlinks.push(sPath);
        }
      }
    });

    enriched = {
      ...enriched,
      openedEmails,
      openedTemplates,
      clickedLinks,
      repliedEmails,
      repliedTemplates,
      watchedVideos,
      watchedFullVideos,
      visitedPages,
      submittedPageForms,
      scannedQrs,
      visitedShortlinks,
    };
  }

  // 3. Fetch survey responses if survey_field is checked
  const surveyFieldConds = conditions.filter((c) => c.field === 'survey_field');
  if (surveyFieldConds.length > 0) {
    const surveyResponses: Record<string, Record<string, unknown>> = {};
    for (const cond of surveyFieldConds) {
      const sId = cond.surveyId;
      if (!sId || surveyResponses[sId]) continue;

      const resSnap = await adminDb.collection('surveys').doc(sId)
        .collection('responses')
        .where('entityId', '==', entityId)
        .get();

      const answers: Record<string, unknown> = {};
      resSnap.forEach((doc) => {
        const resData = doc.data() as SurveyResponseDoc;
        const responsesMap = resData.responses || resData.answers || {};
        Object.entries(responsesMap).forEach(([qId, val]) => {
          answers[qId] = val;
        });
      });
      surveyResponses[sId] = answers;
    }
    enriched.surveyResponses = surveyResponses;
  }

  // 4. Fetch PDF Form Submissions if form_field is checked
  const formFieldConds = conditions.filter((c) => c.field === 'form_field');
  if (formFieldConds.length > 0) {
    const pdfSubmissions: Record<string, Record<string, unknown>> = {};
    for (const cond of formFieldConds) {
      const pId = cond.pdfId;
      if (!pId || pdfSubmissions[pId]) continue;

      const subSnap = await adminDb.collection('pdfs').doc(pId)
        .collection('submissions')
        .where('entityId', '==', entityId)
        .get();

      const answers: Record<string, unknown> = {};
      subSnap.forEach((doc) => {
        const subData = doc.data() as PdfSubmissionDoc;
        const formData = subData.formData || subData.fields || {};
        Object.entries(formData).forEach(([fId, val]) => {
          answers[fId] = val;
        });
      });
      pdfSubmissions[pId] = answers;
    }
    enriched.pdfSubmissions = pdfSubmissions;
  }

  // 5. Fetch Deals if deal fields are checked
  const checksDeals = conditions.some((c) =>
    ['deal_status', 'deal_stage', 'deal_owner', 'deal_value'].includes(c.field)
  );
  if (checksDeals) {
    const dealsSnap = await adminDb.collection('deals')
      .where('entityId', '==', entityId)
      .get();

    const deals: Array<Record<string, unknown>> = [];
    dealsSnap.forEach((doc) => {
      deals.push({ id: doc.id, ...doc.data() });
    });
    enriched.deals = deals;
  }

  // 6. Fetch custom field values if app_field is checked
  const checksAppField = conditions.some((c) => c.field === 'app_field');
  if (checksAppField) {
    const { resolveContact } = await import('../contact-adapter');
    const contact = await resolveContact(entityId, workspaceId);
    if (contact) {
      enriched = {
        ...enriched,
        ...contact,
        customFields: contact.customData || {},
      };
    }
  }

  // 7. Fetch message logs if message action fields are checked
  const checksMessageAction = conditions.some((c) =>
    ['email_action', 'sms_action', 'whatsapp_action'].includes(c.field)
  );
  if (checksMessageAction) {
    const logsSnap = await adminDb.collection('message_logs')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .get();

    const messageLogs: Array<Record<string, unknown>> = [];
    logsSnap.forEach((doc) => {
      messageLogs.push({ id: doc.id, ...doc.data() });
    });
    enriched.messageLogs = messageLogs;
  }

  return enriched;
}

export function nodeChecksMessageActions(
  node: { data?: { config?: Record<string, unknown> } }
): boolean {
  const config = node.data?.config;
  if (!config) return false;

  const targetFields = ['email_action', 'sms_action', 'whatsapp_action'];
  if (targetFields.includes(String(config.field))) return true;

  const groups = config.groups as Array<{ conditions?: Array<{ field?: string }> }> | undefined;
  if (groups && Array.isArray(groups)) {
    return groups.some((g) =>
      (g.conditions || []).some((c) => targetFields.includes(String(c.field)))
    );
  }

  return false;
}