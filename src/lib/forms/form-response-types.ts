/**
 * SmartSapp Forms 2.0: Response Center & Submissions Inbox Types
 * 
 * Defines domain models for submission qualification statuses, filters,
 * custom column visibility presets, saved views, bulk actions, and staff notes.
 */

export type SubmissionStatus = 
  | 'new' 
  | 'processing' 
  | 'qualified' 
  | 'unqualified' 
  | 'contacted' 
  | 'converted' 
  | 'rejected' 
  | 'needs_review' 
  | 'ai_flagged';

export interface SubmissionFilterCriteria {
  statuses?: SubmissionStatus[];
  scoreMin?: number;
  scoreMax?: number;
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
  assignedTo?: string;
  tagIds?: string[];
  isResolved?: boolean;
}

export interface FormSavedView {
  id: string;
  formId: string;
  workspaceId: string;
  name: string;
  filters: SubmissionFilterCriteria;
  visibleColumnKeys?: string[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type BulkSubmissionActionType = 'status' | 'assign' | 'tag' | 'delete';

export interface BulkSubmissionActionPayload {
  formId: string;
  workspaceId: string;
  submissionIds: string[];
  action: BulkSubmissionActionType;
  status?: SubmissionStatus;
  assignedTo?: string;
  tagIds?: string[];
}

export interface SubmissionNote {
  id: string;
  submissionId: string;
  workspaceId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: string;
}

export interface ColumnDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'badge' | 'avatar' | 'score' | 'tags' | 'actions';
  isCustomField?: boolean;
  isVisible: boolean;
  order: number;
}
