
export const ONBOARDING_STAGE_COLORS = [
  '#f72585', // neon_pink
  '#b5179e', // raspberry_plum
  '#7209b7', // indigo_bloom
  '#560bad', // ultrasonic_blue
  '#480ca8', // true_azure
  '#3f37c9', // bright_indigo
  '#4361ee', // electric_sapphire
  '#4895ef', // blue_energy
  '#4cc9f0', // sky_aqua
  '#d00000', // brick_ember
  '#e85d04', // cayenne_red
  '#ffba08', // amber_flame
];

/**
 * Standardized neutral and semantic colors for pipeline stages.
 * Eliminates rainbow clutter in Kanban headers and Stage Architect.
 * Intermediate stages use neutral, low-contrast slate/zinc tones.
 * Terminal stages reserve semantic colors exclusively for Won (#10B981) and Lost (#EF4444).
 */
export const PIPELINE_STAGE_COLORS = [
  '#64748B', // Slate (Default intermediate neutral)
  '#475569', // Slate Dark (Deep intermediate neutral)
  '#71717A', // Zinc (Cool intermediate neutral)
  '#6B7280', // Cool Gray (Subtle intermediate neutral)
  '#4F46E5', // Subtle Indigo (Focus / Negotiation stage)
  '#2563EB', // Subtle Blue (Initial intake stage)
  '#0D9488', // Subtle Teal (Milestone / Delivery stage)
  '#10B981', // Emerald (Terminal Won)
  '#EF4444', // Rose (Terminal Lost)
];

export const DEFAULT_STAGE_COLOR = '#64748B';
export const TERMINAL_WON_COLOR = '#10B981';
export const TERMINAL_LOST_COLOR = '#EF4444';

