'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey Automations Step (Step 5)
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Sequential Automation Architecture:
 *    - Positioned after Results (Step 4).
 *    - Top: Unified Dispatch, Notifications & Webhooks Hub (SurveyCommunicationsHub).
 *    - Followed by: Autonomous Decisioning & Action Studio (SurveyDecisionHub).
 * 2. Dedicated Lead Capture Decoupling:
 *    - CRM & Lead Capture Engine now resides in its own dedicated Step 3.
 * 3. Mobile Ergonomics: Touch targets >= 44px (min-h-[44px]), tactile press states (active:scale-[0.97]).
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { SurveyCommunicationsHub } from './SurveyCommunicationsHub';
import { SurveyDecisionHub } from './SurveyDecisionHub';

export default function SubmissionBehaviorStep() {
  const { activeWorkspaceId } = useWorkspace();

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-500 text-left pb-32 max-w-5xl mx-auto space-y-6 lg:space-y-8 min-w-0">
      {/* ─── 1. TOP: Unified Dispatch, Notifications & Webhooks Hub (Messaging) ─── */}
      <SurveyCommunicationsHub />

      {/* ─── 2. FOLLOWED BY: Autonomous Decisioning & Action Studio (Decisions) ─── */}
      <SurveyDecisionHub workspaceId={activeWorkspaceId || ''} />
    </div>
  );
}
