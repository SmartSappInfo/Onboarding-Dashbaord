import type { AppFeatureId, WidgetDefinition, PermissionsSchema, AppPermissionAction } from './types';

/**
 * @fileOverview Dashboard Widget Registry.
 * Central source of truth for all available dashboard widgets.
 * Each widget maps to a feature. When widgets are filtered,
 * disabled features or unauthorized views will hide their corresponding widgets.
 */

/**
 * Static widget definitions — one per feature area.
 * These are always available (subject to feature toggles).
 */
export const STATIC_WIDGETS: WidgetDefinition[] = [
  {
    id: 'executiveIntelligence',
    type: 'static',
    label: 'CompanyBrain Executive Pulse',
    description: 'Autonomous risk detection, strategic opportunities, and knowledge health.',
    icon: 'Cpu',
    category: 'Intelligence',
    gridClass: 'md:col-span-4 lg:col-span-4',
  },
  {
    id: 'userAssignments',
    type: 'static',
    label: 'Team Workload',
    description: 'Workload balancing and ownership distribution.',
    icon: 'Users',
    featureId: 'entities',
    category: 'Management',
    gridClass: 'md:col-span-2 lg:col-span-4',
  },
  {
    id: 'taskWidget',
    type: 'static',
    label: 'Urgent Tasks',
    description: 'Priority list of overdue or urgent operational tasks.',
    icon: 'CheckSquare',
    featureId: 'tasks',
    category: 'Operations',
    gridClass: 'md:col-span-2 lg:col-span-2',
  },
  {
    id: 'messagingWidget',
    type: 'static',
    label: 'Messaging Status',
    description: 'Communication success and delivery analytics.',
    icon: 'MessageSquareText',
    featureId: 'messaging',
    category: 'Messaging',
    gridClass: 'md:col-span-2 lg:col-span-2',
  },
  {
    id: 'pipelinePieChart',
    type: 'static',
    label: 'Onboarding Progress',
    description: 'Overall stage distribution across the system.',
    icon: 'Workflow',
    featureId: 'pipeline',
    category: 'Operations',
    gridClass: 'md:col-span-2 lg:col-span-2 lg:row-span-2',
  },
  {
    id: 'upcomingMeetings',
    type: 'static',
    label: 'Upcoming Meetings',
    description: 'Next scheduled field assessments and meetings.',
    icon: 'Calendar',
    featureId: 'meetings',
    category: 'Operations',
    gridClass: 'lg:col-span-2',
  },
  {
    id: 'recentActivity',
    type: 'static',
    label: 'Recent Activity',
    description: 'Real-time feed of all latest system actions.',
    icon: 'History',
    category: 'System',
    gridClass: 'md:col-span-4 lg:col-span-2 lg:row-span-2',
  },
  {
    id: 'zoneDistribution',
    type: 'static',
    label: '{Entity} distribution',
    description: 'Regional distribution and density analytics.',
    icon: 'MapPin',
    featureId: 'entities',
    category: 'Operations',
    gridClass: 'lg:col-span-2',
  },
  {
    id: 'moduleRadarChart',
    type: 'static',
    label: 'Module usage',
    description: 'System-wide adoption of active service modules.',
    icon: 'Target',
    category: 'System',
    gridClass: 'lg:col-span-2',
  },
  {
    id: 'latestSurveys',
    type: 'static',
    label: 'Recent Surveys',
    description: 'Latest pulse surveys or feedback instruments.',
    icon: 'ClipboardList',
    featureId: 'surveys',
    category: 'Intelligence',
    gridClass: 'lg:col-span-2',
  },
  {
    id: 'monthlySchoolsChart',
    type: 'static',
    label: 'Signup Trends',
    description: 'Monthly velocity of new registrations.',
    icon: 'BarChart3',
    featureId: 'entities',
    category: 'Operations',
    gridClass: 'md:col-span-4',
  },
];

/**
 * Generates a pipeline widget definition for a specific pipeline.
 */
export function createPipelineWidget(pipelineId: string, pipelineName: string): WidgetDefinition {
  return {
    id: `pipeline_${pipelineId}`,
    type: 'pipeline',
    label: pipelineName,
    description: `Stage distribution for the "${pipelineName}" pipeline.`,
    icon: 'Workflow',
    featureId: 'pipeline',
    category: 'Operations',
    gridClass: 'md:col-span-2 lg:col-span-2',
    pipelineId,
  };
}

/**
 * Returns all available widgets for a workspace, including
 * dynamically generated pipeline widgets.
 */
export function getAllWidgets(
  pipelines: { id: string; name: string }[] = []
): WidgetDefinition[] {
  const pipelineWidgets = pipelines.map(p => createPipelineWidget(p.id, p.name));
  return [...STATIC_WIDGETS, ...pipelineWidgets];
}

/**
 * Filters widgets by which features are currently enabled.
 */
export function filterWidgetsByFeatures(
  widgets: WidgetDefinition[],
  isFeatureEnabled: (featureId: AppFeatureId) => boolean
): WidgetDefinition[] {
  return widgets.filter(w => {
    // Widgets without a featureId are always available (system widgets)
    if (!w.featureId) return true;
    return isFeatureEnabled(w.featureId);
  });
}

/**
 * Evaluates whether the current user has permission to view a specific widget.
 * Conceals unaccessible dashboard widgets from unauthorized view.
 */
export function isWidgetPermitted(
  widget: WidgetDefinition,
  can: (section: keyof PermissionsSchema, feature: string, action?: AppPermissionAction) => boolean,
  isSystemAdmin = false
): boolean {
  if (isSystemAdmin) {
    return true;
  }
  if (widget.id === 'executiveIntelligence') {
    return can('operations', 'intelligence', 'view');
  }
  if (widget.id === 'userAssignments') {
    return can('operations', 'campuses', 'view') || can('workforce', 'crmWorkload', 'view');
  }
  if (widget.id === 'taskWidget') {
    return can('operations', 'tasks', 'view');
  }
  if (widget.id === 'messagingWidget') {
    return can('studios', 'messaging', 'view');
  }
  if (widget.id === 'pipelinePieChart' || widget.type === 'pipeline' || widget.featureId === 'pipeline') {
    return can('operations', 'pipeline', 'view');
  }
  if (widget.id === 'upcomingMeetings') {
    return can('operations', 'meetings', 'view');
  }
  if (widget.id === 'recentActivity') {
    return can('management', 'activities', 'view');
  }
  if (
    widget.id === 'zoneDistribution' ||
    widget.id === 'moduleRadarChart' ||
    widget.id === 'monthlySchoolsChart'
  ) {
    return can('operations', 'campuses', 'view');
  }
  if (widget.id === 'latestSurveys') {
    return can('studios', 'surveys', 'view');
  }
  return true;
}

/**
 * Default widget IDs for a fresh workspace dashboard.
 */
export const DEFAULT_WIDGET_IDS = [
  'userAssignments',
  'taskWidget',
  'messagingWidget',
  'pipelinePieChart',
  'upcomingMeetings',
  'recentActivity',
  'zoneDistribution',
  'moduleRadarChart',
  'latestSurveys',
  'monthlySchoolsChart',
];
