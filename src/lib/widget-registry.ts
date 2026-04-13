import type { AppFeatureId, WidgetDefinition } from './types';

/**
 * @fileOverview Dashboard Widget Registry.
 * Central source of truth for all available dashboard widgets.
 * Each widget maps to a feature. When widgets are filtered,
 * disabled features will hide their corresponding widgets.
 */

/**
 * Static widget definitions — one per feature area.
 * These are always available (subject to feature toggles).
 */
export const STATIC_WIDGETS: WidgetDefinition[] = [
  {
    id: 'userAssignments',
    type: 'static',
    label: 'Assignment Distribution',
    description: 'Workload balancing and entity ownership distribution.',
    icon: 'Users',
    featureId: 'entities',
    category: 'Management',
    gridClass: 'md:col-span-2 lg:col-span-4',
  },
  {
    id: 'taskWidget',
    type: 'static',
    label: 'Critical Focus Protocol',
    description: 'High-stakes list of overdue or urgent operational tasks.',
    icon: 'CheckSquare',
    featureId: 'tasks',
    category: 'Operations',
    gridClass: 'md:col-span-2 lg:col-span-2',
  },
  {
    id: 'messagingWidget',
    type: 'static',
    label: 'Messaging Intelligence',
    description: 'Cross-channel communication success and delivery analytics.',
    icon: 'MessageSquareText',
    featureId: 'messaging',
    category: 'Messaging',
    gridClass: 'md:col-span-2 lg:col-span-2',
  },
  {
    id: 'pipelinePieChart',
    type: 'static',
    label: 'Registration Pipeline',
    description: 'Overall stage distribution across the unified onboarding system.',
    icon: 'Workflow',
    featureId: 'pipeline',
    category: 'Operations',
    gridClass: 'md:col-span-2 lg:col-span-2 lg:row-span-2',
  },
  {
    id: 'upcomingMeetings',
    type: 'static',
    label: 'Session Intelligence',
    description: 'Next scheduled field assessments and meetings.',
    icon: 'Calendar',
    featureId: 'meetings',
    category: 'Operations',
    gridClass: 'lg:col-span-2',
  },
  {
    id: 'recentActivity',
    type: 'static',
    label: 'Operational Stream',
    description: 'Real-time telemetry of all entity-related activities.',
    icon: 'History',
    category: 'System',
    gridClass: 'md:col-span-4 lg:col-span-2 lg:row-span-2',
  },
  {
    id: 'zoneDistribution',
    type: 'static',
    label: 'Geographic Density',
    description: 'Regional distribution and student density analytics.',
    icon: 'MapPin',
    featureId: 'entities',
    category: 'Operations',
    gridClass: 'lg:col-span-2',
  },
  {
    id: 'moduleRadarChart',
    type: 'static',
    label: 'Service Implementation',
    description: 'System-wide adoption of active service modules.',
    icon: 'Target',
    category: 'System',
    gridClass: 'lg:col-span-2',
  },
  {
    id: 'latestSurveys',
    type: 'static',
    label: 'Data Archetypes',
    description: 'Latest pulse surveys or feedback instruments published.',
    icon: 'ClipboardList',
    featureId: 'surveys',
    category: 'Intelligence',
    gridClass: 'lg:col-span-2',
  },
  {
    id: 'monthlySchoolsChart',
    type: 'static',
    label: 'Registration Velocity',
    description: 'Monthly velocity of new entity registrations.',
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
