/**
 * @fileOverview Pipeline Starter Templates and Default Stage Configurations
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Provides out-of-the-box stage blueprints for newly created pipelines.
 * 2. Stage probabilities, SLA days, and colors are carefully balanced for instant usability.
 * 3. Strict zero 'any' / 'any[]' compliance (Rule 5).
 */

import type { StarterStageConfig, PipelineType } from '@/lib/types';

export interface PipelineStarterTemplate {
  id: string;
  name: string;
  description: string;
  type: PipelineType;
  stages: StarterStageConfig[];
}

export const PIPELINE_STARTER_TEMPLATES: PipelineStarterTemplate[] = [
  {
    id: 'standard_sales',
    name: 'Standard Sales',
    description: 'Best for deal closing, outbound prospecting, and sales qualification.',
    type: 'sales',
    stages: [
      { name: 'Lead Qualified', order: 1, color: '#3B82F6', probability: 10, slaDays: 3 },
      { name: 'Contact Made', order: 2, color: '#6366F1', probability: 25, slaDays: 5 },
      { name: 'Meeting Scheduled', order: 3, color: '#8B5CF6', probability: 50, slaDays: 7 },
      { name: 'Proposal Sent', order: 4, color: '#EC4899', probability: 70, slaDays: 7 },
      { name: 'Negotiation', order: 5, color: '#F59E0B', probability: 85, slaDays: 5 },
      { name: 'Closed Won', order: 6, color: '#10B981', probability: 100, isWon: true },
      { name: 'Closed Lost', order: 7, color: '#EF4444', probability: 0, isLost: true },
    ],
  },
  {
    id: 'customer_onboarding',
    name: 'Client Onboarding',
    description: 'Step-by-step institutional implementation and delivery milestones.',
    type: 'implementation',
    stages: [
      { name: 'Kickoff Scheduled', order: 1, color: '#3B82F6', probability: 20, slaDays: 3 },
      { name: 'Configuration', order: 2, color: '#6366F1', probability: 40, slaDays: 7 },
      { name: 'User Training', order: 3, color: '#F59E0B', probability: 70, slaDays: 5 },
      { name: 'Go-Live Verification', order: 4, color: '#8B5CF6', probability: 90, slaDays: 5 },
      { name: 'Completed & Active', order: 5, color: '#10B981', probability: 100, isWon: true },
    ],
  },
  {
    id: 'renewals_growth',
    name: 'Renewals & Retention',
    description: 'Track subscription renewals, contract extensions, and accounts.',
    type: 'renewal',
    stages: [
      { name: 'Upcoming Renewal', order: 1, color: '#6B7280', probability: 25, slaDays: 14 },
      { name: 'Outreach & Review', order: 2, color: '#3B82F6', probability: 60, slaDays: 7 },
      { name: 'Terms Agreed', order: 3, color: '#F59E0B', probability: 85, slaDays: 5 },
      { name: 'Renewed', order: 4, color: '#10B981', probability: 100, isWon: true },
      { name: 'Churned', order: 5, color: '#EF4444', probability: 0, isLost: true },
    ],
  },
  {
    id: 'simple_workflow',
    name: 'Simple Track',
    description: 'Lightweight 3-stage board for quick operational tracking.',
    type: 'custom',
    stages: [
      { name: 'Discovery', order: 1, color: '#3B82F6', probability: 30 },
      { name: 'In Progress', order: 2, color: '#F59E0B', probability: 60 },
      { name: 'Completed', order: 3, color: '#10B981', probability: 100, isWon: true },
    ],
  },
];
