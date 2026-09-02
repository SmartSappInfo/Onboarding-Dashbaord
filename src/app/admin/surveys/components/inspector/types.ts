/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey Design Studio Types
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Strict Zero-Any Invariant: All props, states, and return types are strictly typed.
 * 2. Single source of truth for Design Studio tabs, patterns, palettes, and device viewports.
 */

export type StudioInspectorTab = 'identity' | 'media' | 'palette' | 'layout';

export type SurveyBackgroundPattern = 
  | 'none' 
  | 'dots' 
  | 'grid' 
  | 'circuit' 
  | 'topography' 
  | 'cubes' 
  | 'gradient';

export type SurveyStepperVariant = 'full' | 'simple' | 'linear' | 'none';

export type SimulationDevice = 'desktop' | 'mobile';

export type SimulationTheme = 'light' | 'dark' | 'sync';

export type SimulationScale = 'fit' | 0.75 | 1.0 | 1.25;

export type SimulationScreen = 'cover' | 'questions' | 'success';

export interface ContrastScoreResult {
  ratio: number;
  scoreText: string;
  isAaPassed: boolean;
  isAaaPassed: boolean;
  status: 'excellent' | 'good' | 'warning' | 'fail';
}

export interface SurveyPalettePreset {
  id: string;
  name: string;
  description?: string;
  backgroundColor: string;
  patternColor: string;
  textColor?: string;
  accentColor?: string;
  badge?: 'Popular' | 'Corporate' | 'Minimal' | 'Vibrant' | 'Dark' | 'Warm' | string;
}
