'use server';

import { processFormSubmissionAction } from './forms-actions';

/**
 * Persists a submission for a standalone or headless form, routing through
 * the unified processing pipeline to guarantee consistent CRM deduplication,
 * tagging, webhooks, multi-channel notifications, and workflow automations.
 */
export async function submitStandaloneFormAction(
    formId: string, 
    data: Record<string, unknown>, 
    workspaceId: string, 
    organizationId: string,
    metadata?: { 
        ipAddress?: string; 
        userAgent?: string; 
        sourcePageId?: string;
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        utmTerm?: string;
        utmContent?: string;
    }
) {
    const stringMetadata: Record<string, string> = {};
    if (metadata?.utmSource) stringMetadata.utmSource = metadata.utmSource;
    if (metadata?.utmMedium) stringMetadata.utmMedium = metadata.utmMedium;
    if (metadata?.utmCampaign) stringMetadata.utmCampaign = metadata.utmCampaign;
    if (metadata?.utmTerm) stringMetadata.utmTerm = metadata.utmTerm;
    if (metadata?.utmContent) stringMetadata.utmContent = metadata.utmContent;

    return processFormSubmissionAction({
        formId,
        data,
        sourcePageId: metadata?.sourcePageId,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: stringMetadata,
    });
}
