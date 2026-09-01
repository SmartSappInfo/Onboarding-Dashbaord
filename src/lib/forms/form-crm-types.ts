/**
 * SmartSapp Forms 2.0: CRM Integration & Pipeline Types
 * 
 * Defines canonical data models for entity resolution, automated pipeline
 * deal creation, follow-up task assignment, and progressive profiling.
 */

import type { EntityType } from '@/lib/types';

export type EntityHandlingStrategy = 'create_or_update' | 'update_matching' | 'create_new';

export interface DealCreationRule {
  enabled: boolean;
  pipelineId?: string;
  stageId?: string;
  titleTemplate?: string;
  valueFieldVariableName?: string;
  fixedValue?: number;
}

export interface TaskAssignmentRule {
  enabled: boolean;
  titleTemplate?: string;
  descriptionTemplate?: string;
  assignedUserId?: string;
  priority?: 'low' | 'medium' | 'high';
  dueInHours?: number;
}

export interface ProgressiveProfilingConfig {
  enabled: boolean;
  hideKnownFields?: boolean;
  welcomeBannerText?: string;
}

export interface FormCrmSettings {
  entityHandling: EntityHandlingStrategy;
  contactScope: EntityType;
  leadSource?: string;
  progressiveProfiling?: ProgressiveProfilingConfig;
  dealCreation?: DealCreationRule;
  taskAssignment?: TaskAssignmentRule;
  tags?: string[];
}

export interface WorkspacePipelineStage {
  id: string;
  name: string;
  order: number;
  color?: string;
}

export interface WorkspacePipeline {
  id: string;
  name: string;
  stages: WorkspacePipelineStage[];
}

export interface WorkspaceTeamMember {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string;
}
