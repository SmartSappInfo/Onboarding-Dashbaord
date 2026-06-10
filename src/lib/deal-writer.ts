import type { DealFocalContact } from '@/lib/types';

export interface WriteDealParams {
  entityId: string;
  entityName: string;
  pipelineId: string;
  stageId: string;
  stageName?: string;
  dealName: string;
  value: number;
  status?: 'open' | 'won' | 'lost';
  assignedTo?: { userId: string | null; name: string | null; email: string | null } | null;
  expectedCloseDate?: string | null;
  focalContacts?: DealFocalContact[];
  workspaceId: string;
  organizationId: string;
  source?: 'manual' | 'bulk_import' | 'automation';
  isBulkImport?: boolean;
  suppressAutomations?: boolean;
}

export function buildDealDocument(params: WriteDealParams, dealId: string): Record<string, any> {
  const timestamp = new Date().toISOString();
  return {
    id: dealId,
    organizationId: params.organizationId,
    workspaceId: params.workspaceId,
    entityId: params.entityId,
    pipelineId: params.pipelineId,
    stageId: params.stageId,
    ...(params.stageName && { stageName: params.stageName }),
    name: params.dealName,
    value: params.value,
    status: params.status ?? 'open',
    assignedTo: params.assignedTo ?? null,
    expectedCloseDate: params.expectedCloseDate ?? null,
    focalContacts: params.focalContacts ?? [],
    source: params.source ?? 'manual',
    isBulkImport: params.isBulkImport ?? false,
    createdAt: timestamp,
    updatedAt: timestamp,
    customFields: {},
  };
}

export function resolveDealName(template: string, entityName: string): string {
  return template
    .replace('{{name}}', entityName)
    .replace('{{date}}', new Date().toLocaleDateString());
}
