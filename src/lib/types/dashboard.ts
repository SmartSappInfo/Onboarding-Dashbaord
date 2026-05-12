import type { Layout, ResponsiveLayouts as Layouts } from 'react-grid-layout';

export interface WidgetConfig {
  /** Unique identifier within the dashboard instance */
  id: string;
  /** Identifier mapped in the WidgetRegistry (e.g., 'saas-mrr', 'pipeline-overview') */
  widgetId: string;
  /** Optional override for the widget title */
  title?: string;
  /** Additional configuration or props for the widget */
  props?: Record<string, any>;
}

export interface DashboardLayoutConfig {
  /** Unique ID for this configuration */
  id: string;
  /** The industry this layout is for (e.g., 'saas', 'agency') */
  industry: string;
  /** The entity type (e.g., 'deals', 'contacts'). If undefined, it's the main workspace dashboard */
  entityType?: string;
  /** Responsive react-grid-layout configurations */
  layouts: Layouts;
  /** The list of widgets included in this layout */
  widgets: WidgetConfig[];
}

export interface IndustryTemplate {
  /** Industry identifier */
  industry: string;
  /** Human readable name */
  name: string;
  /** Description of the template */
  description?: string;
  /** The default dashboard configuration for this industry */
  defaultLayout: DashboardLayoutConfig;
}
