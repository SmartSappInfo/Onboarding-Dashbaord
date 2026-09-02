/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Dual-Layer FER Hydration Adapter
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Zero-Downtime FER Protocol (Fetch-Enrich-Restore):
 *    - Ingests legacy monolithic survey documents and enriches them in-memory with 2.0 fields.
 *    - Guaranteed backward compatibility: Active public URLs (/surveys/[slug]), embeds, and automations
 *      will NEVER break because of missing version or archetype fields.
 * 2. Strict Zero-Any Invariant:
 *    - Strictly typed inputs and returns. No `any` or `any[]`.
 * 3. Testability:
 *    - Tested in src/lib/surveys/__tests__/survey-hydration-adapter.test.ts.
 */

import type { Survey } from '@/lib/types';
import type { SurveyVersion, SurveyDeployment, SurveyType, SurveyLifecycleStatus, SurveyPrivacyMode } from './survey-v2-types';

/**
 * Calculates a deterministic content checksum for a survey's elements, scoring, and outcome rules.
 */
export function computeSurveyChecksum(elements: unknown[], resultRules?: unknown[], scoringEnabled?: boolean): string {
  try {
    const raw = JSON.stringify({ elements: elements || [], resultRules: resultRules || [], scoringEnabled: !!scoringEnabled });
    // Simple deterministic hash for browser and node runtime compatibility
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `v_${Math.abs(hash).toString(16)}`;
  } catch {
    return `v_${Date.now().toString(16)}`;
  }
}

/**
 * Ingests a raw or partial Firestore Survey document and normalizes it into a complete Survey 2.0 structure.
 * Guaranteed to never mutate the input object directly.
 */
export function hydrateSurveyDocument(raw: Partial<Survey> | null | undefined): Survey {
  if (!raw) {
    throw new Error('hydrateSurveyDocument received null or undefined survey document.');
  }

  const rawElements = Array.isArray(raw.elements) ? raw.elements : [];
  
  // Heuristic archetype detection for legacy surveys
  let derivedType: SurveyType = raw.surveyType || 'feedback';
  if (!raw.surveyType) {
    const hasNps = rawElements.some((el) => el.type === 'nps' || (el.title && /nps|recommend/i.test(el.title)));
    if (hasNps) {
      derivedType = 'nps';
    } else if (raw.scoringEnabled) {
      derivedType = 'assessment';
    } else if (raw.createEntity || raw.entityMapping) {
      derivedType = 'lead_qualification';
    }
  }

  // Derive 8-state lifecycle status
  let derivedLifecycle: SurveyLifecycleStatus = raw.lifecycleStatus || 'draft';
  if (!raw.lifecycleStatus) {
    if (raw.status === 'published') {
      derivedLifecycle = 'published';
    } else if (raw.status === 'archived') {
      derivedLifecycle = 'archived';
    } else {
      derivedLifecycle = 'draft';
    }
  }

  // Derive privacy mode
  let derivedPrivacy: SurveyPrivacyMode = raw.privacyMode || 'identified';
  if (!raw.privacyMode && raw.entityMapping) {
    derivedPrivacy = 'crm_linked';
  }

  const now = new Date().toISOString();

  const hydrated: Survey = {
    id: raw.id || '',
    workspaceIds: Array.isArray(raw.workspaceIds) ? raw.workspaceIds : [],
    organizationId: raw.organizationId,
    internalName: raw.internalName || raw.title || 'Untitled Survey',
    title: raw.title || 'Untitled Survey',
    description: raw.description || '',
    slug: raw.slug || '',
    logoUrl: raw.logoUrl,
    bannerImageUrl: raw.bannerImageUrl,
    videoUrl: raw.videoUrl,
    videoThumbnailUrl: raw.videoThumbnailUrl,
    videoCaption: raw.videoCaption,
    status: raw.status || 'draft',
    elements: rawElements,
    entityId: raw.entityId || null,
    entityName: raw.entityName || null,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    scoringEnabled: !!raw.scoringEnabled,
    maxScore: raw.maxScore,
    scoreDisplayMode: raw.scoreDisplayMode || 'percentage',
    resultRules: Array.isArray(raw.resultRules) ? raw.resultRules : [],
    resultPages: Array.isArray(raw.resultPages) ? raw.resultPages : [],
    thankYouTitle: raw.thankYouTitle,
    thankYouDescription: raw.thankYouDescription,
    startButtonText: raw.startButtonText || 'Start Survey',
    submitButtonText: raw.submitButtonText || 'Submit',
    embedRedirectMode: raw.embedRedirectMode || 'modal',
    showCoverPage: raw.showCoverPage ?? false,
    showIntroAsPage: raw.showIntroAsPage ?? false,
    stepperVariant: raw.stepperVariant || 'linear',
    showSurveyTitles: raw.showSurveyTitles ?? true,
    questionTitleBold: raw.questionTitleBold ?? true,
    optionsColumns: raw.optionsColumns || 1,
    showBranding: raw.showBranding ?? true,
    showFooter: raw.showFooter ?? true,
    backgroundColor: raw.backgroundColor || '#F8FAFC',
    backgroundPattern: raw.backgroundPattern || 'none',
    patternColor: raw.patternColor || '#3B82F6',
    webhookEnabled: raw.webhookEnabled,
    webhookId: raw.webhookId,
    showDebugProcessingModal: raw.showDebugProcessingModal,
    adminAlertsEnabled: raw.adminAlertsEnabled,
    adminAlertChannel: raw.adminAlertChannel,
    adminAlertChannels: raw.adminAlertChannels,
    adminAlertNotifyManager: raw.adminAlertNotifyManager,
    adminAlertSpecificUserIds: raw.adminAlertSpecificUserIds,
    adminAlertEmailTemplateId: raw.adminAlertEmailTemplateId,
    adminAlertSmsTemplateId: raw.adminAlertSmsTemplateId,
    adminAlertWhatsappTemplateId: raw.adminAlertWhatsappTemplateId,
    externalAlertsEnabled: raw.externalAlertsEnabled,
    externalAlertChannel: raw.externalAlertChannel,
    externalAlertChannels: raw.externalAlertChannels,
    externalAlertContactTypes: raw.externalAlertContactTypes,
    externalAlertEmailTemplateId: raw.externalAlertEmailTemplateId,
    externalAlertSmsTemplateId: raw.externalAlertSmsTemplateId,
    externalAlertWhatsappTemplateId: raw.externalAlertWhatsappTemplateId,
    useEntityLogo: raw.useEntityLogo,
    logoMode: raw.logoMode || 'organization',
    createEntity: raw.createEntity,
    entityMapping: raw.entityMapping,
    assignmentEnabled: raw.assignmentEnabled,
    assignedUsers: raw.assignedUsers,
    notifyAssignedUsers: raw.notifyAssignedUsers,
    autoTags: raw.autoTags,
    autoAutomations: raw.autoAutomations,
    autoPipelineEnabled: raw.autoPipelineEnabled,
    autoPipelineId: raw.autoPipelineId,
    autoPipelineStageId: raw.autoPipelineStageId,
    autoPipelineMode: raw.autoPipelineMode,
    allowCrossVisibility: raw.allowCrossVisibility,
    allowResubmission: raw.allowResubmission,
    aiMetadata: raw.aiMetadata,
    seo: raw.seo,
    leadCaptureMode: raw.leadCaptureMode,
    leadCaptureTitle: raw.leadCaptureTitle,
    leadCaptureDescription: raw.leadCaptureDescription,
    leadCaptureFieldsConfig: raw.leadCaptureFieldsConfig,
    thankYouRedirectEnabled: raw.thankYouRedirectEnabled,
    thankYouRedirectUrl: raw.thankYouRedirectUrl,
    thankYouConfettiEnabled: raw.thankYouConfettiEnabled,

    // Survey 2.0 Core Extensions
    projectId: raw.projectId,
    surveyType: derivedType,
    lifecycleStatus: derivedLifecycle,
    currentVersionNumber: raw.currentVersionNumber || 1,
    currentDraftVersionId: raw.currentDraftVersionId,
    publishedVersionId: raw.publishedVersionId,
    privacyMode: derivedPrivacy,
    consentConfig: raw.consentConfig,
    deploymentIds: raw.deploymentIds || [],
  };

  return hydrated;
}

/**
 * Creates an immutable SurveyVersion snapshot from a Survey object.
 */
export function synthesizeVersionSnapshot(survey: Survey, versionNumber = 1, authorId = 'system', authorName?: string): SurveyVersion {
  const checksum = computeSurveyChecksum(survey.elements, survey.resultRules, survey.scoringEnabled);
  const now = new Date().toISOString();

  return {
    id: `v_${survey.id}_${versionNumber}`,
    surveyId: survey.id,
    workspaceId: survey.workspaceIds[0] || '',
    organizationId: survey.organizationId,
    versionNumber,
    status: survey.status === 'published' ? 'published' : 'draft',
    elements: survey.elements,
    resultRules: survey.resultRules,
    resultPages: survey.resultPages,
    scoringEnabled: survey.scoringEnabled,
    maxScore: survey.maxScore,
    scoreDisplayMode: survey.scoreDisplayMode,
    checksum,
    changeLog: `Version ${versionNumber} snapshot generated.`,
    createdBy: authorId,
    createdByName: authorName,
    createdAt: now,
    publishedAt: survey.status === 'published' ? now : undefined,
  };
}

/**
 * Validates whether a survey and/or specific deployment is currently active and accepting responses.
 */
export function isSurveyAcceptingSubmissions(
  survey: Survey,
  deployment?: Partial<SurveyDeployment> | null
): { allowed: boolean; reason?: 'not_published' | 'paused' | 'closed' | 'quota_reached' | 'expired' | 'not_started' } {
  // Check master survey lifecycle status
  if (survey.lifecycleStatus === 'paused' || survey.status === 'archived') {
    return { allowed: false, reason: 'paused' };
  }
  if (survey.lifecycleStatus === 'closed') {
    return { allowed: false, reason: 'closed' };
  }
  if (survey.lifecycleStatus !== 'published' && survey.status !== 'published') {
    return { allowed: false, reason: 'not_published' };
  }

  // Check deployment level constraints if a deployment is specified
  if (deployment) {
    if (deployment.status === 'paused') {
      return { allowed: false, reason: 'paused' };
    }
    if (deployment.status === 'closed') {
      return { allowed: false, reason: 'closed' };
    }

    const now = new Date().getTime();

    // Check Schedule Gates
    if (deployment.scheduleConfig?.startDate) {
      const startTime = new Date(deployment.scheduleConfig.startDate).getTime();
      if (now < startTime) {
        return { allowed: false, reason: 'not_started' };
      }
    }
    if (deployment.scheduleConfig?.endDate) {
      const endTime = new Date(deployment.scheduleConfig.endDate).getTime();
      if (now > endTime) {
        return { allowed: false, reason: 'expired' };
      }
    }

    // Check Quota Gates
    if (deployment.quotaConfig?.maxResponses && deployment.quotaConfig.maxResponses > 0) {
      const completions = deployment.stats?.completionsCount || 0;
      if (completions >= deployment.quotaConfig.maxResponses) {
        return { allowed: false, reason: 'quota_reached' };
      }
    }
  }

  return { allowed: true };
}

/**
 * Validates whether a survey document is authorized for a specific workspaceId.
 */
export function isAuthorizedForWorkspace(survey: Survey, workspaceId: string): boolean {
  if (!workspaceId) return false;
  if (survey.workspaceIds && Array.isArray(survey.workspaceIds)) {
    return survey.workspaceIds.includes(workspaceId);
  }
  return false;
}
