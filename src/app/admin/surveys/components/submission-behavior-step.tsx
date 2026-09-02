'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Submission Behavior & Automations Step (Step 4)
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Double-Column Responsive Workspace:
 *    - Left Column: Unified CRM & Lead Capture Engine + Inbound Lifecycle Triggers.
 *    - Right Column: Autonomous Decisioning & Action Studio + Unified Dispatch & Notifications Hub + A/B Testing Studio.
 * 2. Consolidates 9 previously fragmented cards into 4 cohesive, high-impact modules.
 * 3. Preserves 100% of underlying RHF form state, custom fields, tags, workflows, pipelines, alerts, and webhooks.
 * 4. Mobile Ergonomics: Touch targets >= 44px (min-h-[44px]), tactile press states (active:scale-[0.97]).
 * 5. Defensive Grid Containment: 'min-w-0' on both column wrappers to avoid table/popover grid blowouts.
 */

import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { SurveyCrmEngineCard } from './SurveyCrmEngineCard';
import { SurveyCrmInboundTriggersCard } from './SurveyCrmInboundTriggersCard';
import { SurveyDecisionHub } from './SurveyDecisionHub';
import { SurveyCommunicationsHub } from './SurveyCommunicationsHub';

export default function SubmissionBehaviorStep() {
  const { activeWorkspaceId } = useWorkspace();

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-500 text-left pb-32 relative">
      {/*
        * RESPONSIVE DOUBLE-COLUMN GRID ARCHITECTURE:
        * - Breakpoint: 'grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8'
        * - Both columns contain 'min-w-0' to safeguard against nested table/command overflow.
        */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 items-start">
        {/* ─── LEFT COLUMN: CRM Ingestion, Lead Capture & Data Pipeline ─── */}
        <div className="space-y-6 lg:space-y-8 min-w-0">
          {/* 1. Unified CRM & Lead Capture Engine (Identity Bridge, Field Mappings, Tags & Pipeline) */}
          <SurveyCrmEngineCard />

          {/* 2. Inbound CRM Lifecycle Triggers (CRM ➔ Survey automated delivery) */}
          <SurveyCrmInboundTriggersCard workspaceId={activeWorkspaceId || ''} />
        </div>

        {/* ─── RIGHT COLUMN: Logic Studio & Dispatch Hub ─── */}
        <div className="space-y-6 lg:space-y-8 min-w-0">
          {/* 1. Autonomous Decisioning & Action Studio (Multi-condition Matrix & Prescriptions) */}
          <SurveyDecisionHub workspaceId={activeWorkspaceId || ''} />

          {/* 2. Unified Dispatch, Notifications & Webhooks Hub (Internal Alerts, Autoresponders, Webhooks) */}
          <SurveyCommunicationsHub />
        </div>
      </div>
    </div>
  );
}
