export type ImportWizardStep = 'upload' | 'map' | 'configure' | 'validate' | 'execute' | 'review';

export interface ColumnMapping {
  csvColumn: string;
  targetField: string | null; // null means ignored
  isCustomField?: boolean;
}

export interface ImportState {
  step: ImportWizardStep;
  file: File | null;
  csvData: Record<string, string>[];
  headers: string[];
  entityType: 'institution' | 'family' | 'person' | null;
  workspaceId?: string;
  organizationId?: string;
  userId?: string;
  pipelineId?: string;
  stageId?: string;
  mappings: ColumnMapping[];
  configuration?: {
    selectedTags: string[];
    selectedAutomations: string[];
    globalDefaults: Record<string, string>;
  };
  validationResults: ValidationSummary | null;
  importResult: ExecutionSummary | null;
  error?: string;
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
  errors: Array<{
    rowNumber: number;
    reason: string;
    rowData?: any;
  }>;
  duplicates: Array<{
    rowNumber: number;
    entityId: string;
    name: string;
  }>;
  previewRows: any[];
}

export interface ExecutionSummary {
  successCount: number;
  errorCount: number;
  skippedCount: number;
  failedRows: Array<{
    rowNumber: number;
    reason: string;
    originalData: Record<string, string>;
    isDuplicate?: boolean;
    duplicateInfo?: any[];
  }>;
}

export const INITIAL_IMPORT_STATE: ImportState = {
  step: 'upload',
  file: null,
  csvData: [],
  headers: [],
  entityType: null,
  mappings: [],
  configuration: {
    selectedTags: [],
    selectedAutomations: [],
    globalDefaults: {},
  },
  validationResults: null,
  importResult: null,
};
