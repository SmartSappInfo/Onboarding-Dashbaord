/**
 * @fileoverview Deals Platform 2.0 Saved Views & Filter Hierarchy Domain
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 123 & Sections 31, 32):
 * - Strongly-typed schema for Deal Saved Views, Filter Rules, Filter Groups, and Filter Trees.
 * - Provides system presets out-of-the-box:
 *   ⭐ My Deals, 🔥 Closing This Month, ⚠️ At Risk, 🕐 Stalled Deals, 💰 High Value,
 *   🏆 Won This Quarter, 📋 Deals Without Next Steps, 🔄 Active Renewals.
 * - Supports visibility scoping: 'private' (author only) vs 'workspace' (shared with team).
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 5):
 * - Strict zero 'any' / zero 'any[]'.
 * - Pure data models with complete typing.
 *
 * TESTABILITY POINTER:
 * Tested by unit tests in `src/lib/deals/__tests__/deal-filter-engine.test.ts`.
 */

export type DealFilterField =
  | 'name'
  | 'value'
  | 'mrr'
  | 'arr'
  | 'stageId'
  | 'status'
  | 'ownerId'
  | 'probability'
  | 'forecastCategory'
  | 'healthStatus'
  | 'daysInStage'
  | 'dealAge'
  | 'expectedCloseDate'
  | 'createdAt'
  | 'contractStatus'
  | 'tagIds'
  | 'source';

export type DealFilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'is_between'
  | 'is_empty'
  | 'is_not_empty'
  | 'in'
  | 'not_in';

export interface DealFilterRule {
  id: string;
  field: DealFilterField | string;
  operator: DealFilterOperator;
  value: string | number | boolean | string[] | null;
  valueTo?: string | number | null; // Used for 'is_between' range bounds
}

export interface DealFilterGroup {
  id: string;
  conjunction: 'AND' | 'OR';
  rules: DealFilterRule[];
}

export interface DealFilterTree {
  conjunction: 'AND' | 'OR';
  groups: DealFilterGroup[];
}

export type DealColumnKey =
  | 'name'
  | 'entity'
  | 'value'
  | 'mrr'
  | 'arr'
  | 'contractTerm'
  | 'probability'
  | 'forecastCategory'
  | 'stage'
  | 'daysInStage'
  | 'dealAge'
  | 'expectedClose'
  | 'assignee'
  | 'status'
  | 'lastActivity'
  | 'source';

export type TableDensity = 'compact' | 'standard' | 'comfortable';

export interface DealSavedView {
  id: string;
  workspaceId: string;
  organizationId?: string;
  userId: string;
  userName?: string;
  name: string;
  icon?: string; // Lucide icon name: 'Star', 'Flame', 'AlertTriangle', 'Clock', 'DollarSign', 'Trophy', 'ListTodo', 'Layers'
  color?: string;
  description?: string;
  isDefault?: boolean;
  isSystemPreset?: boolean;
  visibility: 'private' | 'workspace';
  pipelineId?: string | null;
  filters: {
    searchTerm?: string;
    status?: 'all' | 'open' | 'won' | 'lost';
    ownerId?: string | 'all' | 'unassigned';
    stageIds?: string[];
    tagIds?: string[];
    valueMin?: number | null;
    valueMax?: number | null;
    healthStatus?: string | 'all';
    isArchived?: boolean;
    filterTree?: DealFilterTree;
  };
  columns?: DealColumnKey[];
  density?: TableDensity;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  viewMode?: 'kanban' | 'list' | 'forecast' | 'overview';
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_DEAL_COLUMNS: DealColumnKey[] = [
  'name',
  'entity',
  'value',
  'stage',
  'expectedClose',
  'assignee',
  'status',
];

export const ALL_AVAILABLE_DEAL_COLUMNS: Array<{ key: DealColumnKey; label: string; minWidth: string }> = [
  { key: 'name', label: 'Deal Name', minWidth: '220px' },
  { key: 'entity', label: 'Company / Lead', minWidth: '180px' },
  { key: 'value', label: 'Total Value', minWidth: '130px' },
  { key: 'mrr', label: 'MRR', minWidth: '120px' },
  { key: 'arr', label: 'ARR', minWidth: '120px' },
  { key: 'contractTerm', label: 'Term (Months)', minWidth: '120px' },
  { key: 'probability', label: 'Win Probability', minWidth: '130px' },
  { key: 'forecastCategory', label: 'Forecast Category', minWidth: '140px' },
  { key: 'stage', label: 'Pipeline Stage', minWidth: '160px' },
  { key: 'daysInStage', label: 'Days in Stage', minWidth: '120px' },
  { key: 'dealAge', label: 'Deal Age', minWidth: '110px' },
  { key: 'expectedClose', label: 'Expected Close', minWidth: '140px' },
  { key: 'assignee', label: 'Deal Owner', minWidth: '150px' },
  { key: 'status', label: 'Status', minWidth: '110px' },
  { key: 'lastActivity', label: 'Last Activity', minWidth: '130px' },
  { key: 'source', label: 'Lead Source', minWidth: '130px' },
];

/**
 * Built-in Commercial System Presets (PRD Section 31, UI Section 14)
 */
export const SYSTEM_SAVED_VIEW_PRESETS: Array<Omit<DealSavedView, 'workspaceId' | 'userId' | 'createdAt' | 'updatedAt'>> = [
  {
    id: 'preset_all_deals',
    name: 'All Deals',
    icon: 'Layers',
    color: '#6366f1',
    description: 'All active open opportunities in the pipeline',
    isSystemPreset: true,
    visibility: 'workspace',
    filters: {
      status: 'open',
      isArchived: false,
    },
    columns: DEFAULT_DEAL_COLUMNS,
    density: 'standard',
  },
  {
    id: 'preset_my_deals',
    name: 'My Deals',
    icon: 'Star',
    color: '#3b82f6',
    description: 'Deals directly assigned to you',
    isSystemPreset: true,
    visibility: 'workspace',
    filters: {
      status: 'open',
      ownerId: 'current_user',
      isArchived: false,
    },
    columns: DEFAULT_DEAL_COLUMNS,
    density: 'standard',
  },
  {
    id: 'preset_closing_this_month',
    name: 'Closing This Month',
    icon: 'Flame',
    color: '#f97316',
    description: 'Deals scheduled to close by the end of this calendar month',
    isSystemPreset: true,
    visibility: 'workspace',
    filters: {
      status: 'open',
      isArchived: false,
      filterTree: {
        conjunction: 'AND',
        groups: [
          {
            id: 'grp_closing_month',
            conjunction: 'AND',
            rules: [
              {
                id: 'rule_close_date',
                field: 'expectedCloseDate',
                operator: 'equals',
                value: 'current_month',
              },
            ],
          },
        ],
      },
    },
    columns: DEFAULT_DEAL_COLUMNS,
    density: 'standard',
  },
  {
    id: 'preset_at_risk',
    name: 'At Risk',
    icon: 'AlertTriangle',
    color: '#ef4444',
    description: 'Deals exhibiting SLA breaches, high inactivity, or low health score',
    isSystemPreset: true,
    visibility: 'workspace',
    filters: {
      status: 'open',
      healthStatus: 'at_risk',
      isArchived: false,
    },
    columns: ['name', 'entity', 'value', 'stage', 'daysInStage', 'expectedClose', 'assignee'],
    density: 'standard',
  },
  {
    id: 'preset_stalled',
    name: 'Stalled Deals',
    icon: 'Clock',
    color: '#eab308',
    description: 'Deals with no recent activities or stuck in stage past SLA limit',
    isSystemPreset: true,
    visibility: 'workspace',
    filters: {
      status: 'open',
      healthStatus: 'stalled',
      isArchived: false,
    },
    columns: ['name', 'entity', 'value', 'stage', 'daysInStage', 'assignee'],
    density: 'standard',
  },
  {
    id: 'preset_high_value',
    name: 'High Value',
    icon: 'DollarSign',
    color: '#10b981',
    description: 'Top enterprise opportunities with value >= $10,000 / GHS 50,000',
    isSystemPreset: true,
    visibility: 'workspace',
    filters: {
      status: 'open',
      valueMin: 10000,
      isArchived: false,
    },
    columns: ['name', 'entity', 'value', 'mrr', 'probability', 'stage', 'expectedClose', 'assignee'],
    density: 'standard',
  },
  {
    id: 'preset_won_quarter',
    name: 'Won This Quarter',
    icon: 'Trophy',
    color: '#8b5cf6',
    description: 'Closed-won deals won during the active fiscal quarter',
    isSystemPreset: true,
    visibility: 'workspace',
    filters: {
      status: 'won',
      isArchived: false,
    },
    columns: ['name', 'entity', 'value', 'mrr', 'stage', 'assignee'],
    density: 'standard',
  },
  {
    id: 'preset_no_next_steps',
    name: 'Without Next Steps',
    icon: 'ListTodo',
    color: '#64748b',
    description: 'Open deals missing scheduled next actions or follow-ups',
    isSystemPreset: true,
    visibility: 'workspace',
    filters: {
      status: 'open',
      isArchived: false,
      filterTree: {
        conjunction: 'AND',
        groups: [
          {
            id: 'grp_no_next_step',
            conjunction: 'AND',
            rules: [
              {
                id: 'rule_no_next_step',
                field: 'nextStep',
                operator: 'is_empty',
                value: null,
              },
            ],
          },
        ],
      },
    },
    columns: DEFAULT_DEAL_COLUMNS,
    density: 'standard',
  },
];
