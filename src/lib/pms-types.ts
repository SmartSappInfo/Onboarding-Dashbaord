export interface BasePromptConfig {
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  aiModels: string[];
  temperature?: number;
  maxTokens?: number;
}

export interface GlobalPrompt extends BasePromptConfig {
  id: string; // matches flowName
  title: string;
  description: string;
  category: string;
  tags: string[];
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface TenantPromptOverride extends BasePromptConfig {
  id: string; // e.g. organizationId_workspaceId_flowName
  parentPromptId: string; // Reference to GlobalPrompt.id
  organizationId: string;
  workspaceId: string; // empty string for org-wide defaults
  flowName: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  status: 'draft' | 'review' | 'approved' | 'production' | 'archived';
  isActive: boolean;
  version: number;
  updatedAt: string;
  updatedBy: string;
}
