/**
 * @fileoverview Domain Types for Event Type Templates & Custom Meeting Archetypes.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure schemas.
 * - Zero 'any' policy strictly enforced.
 */

import type { BookingField, EventTypeFormat, ConferenceProvider, EventTypePurpose } from './index';

export type TemplateCategory =
  | 'sales'
  | 'education'
  | 'onboarding'
  | 'support'
  | 'internal'
  | 'webinar';

export interface MeetingTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  purpose: EventTypePurpose;
  description: string;
  durationMinutes: number;
  format: EventTypeFormat;
  defaultProvider: ConferenceProvider;
  defaultQuestions: BookingField[];
  confirmationMessage?: string;
  accentColor?: string;
  iconName?: string;
  tags: string[];
}
