/**
 * @fileOverview Feature Gate Usage Examples
 * 
 * This file demonstrates various ways to use the feature gate system
 * to conditionally render industry-specific features.
 * 
 * Requirements:
 * - 15.7: Hide features not applicable to Workspace Industry_Vertical
 * - 15.8: Validate feature access based on Workspace Industry_Vertical
 */

'use client';

import * as React from 'react';
import { FeatureGate, FeatureGateMultiple, withFeatureGate } from '@/components/FeatureGate';
import { useFeatureGate, useIndustry } from '@/context/IndustryContext';
import { isFeatureEnabled } from '@/lib/feature-gate';

// ─────────────────────────────────────────────────
// Example 1: Basic FeatureGate Component
// ─────────────────────────────────────────────────

export function TrialsPanel() {
  return (
    <FeatureGate feature="trials">
      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-bold">Trials Management</h2>
        <p>Manage customer trials and conversions</p>
        {/* Trials-specific content */}
      </div>
    </FeatureGate>
  );
}

// ─────────────────────────────────────────────────
// Example 2: FeatureGate with Fallback
// ─────────────────────────────────────────────────

export function MattersPanel() {
  return (
    <FeatureGate
      feature="matters"
      fallback={
        <div className="p-4 border rounded-lg bg-gray-50">
          <p className="text-gray-600">Matter management is not available for this workspace</p>
        </div>
      }
    >
      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-bold">Legal Matters</h2>
        <p>Manage legal cases and matters</p>
        {/* Matters-specific content */}
      </div>
    </FeatureGate>
  );
}

// ─────────────────────────────────────────────────
// Example 3: FeatureGate with Callback
// ─────────────────────────────────────────────────

export function CampaignsPanel() {
  const handleDisabled = React.useCallback(() => {
    console.log('Campaigns feature is not available for this industry');
  }, []);

  return (
    <FeatureGate feature="campaigns" onDisabled={handleDisabled}>
      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-bold">Marketing Campaigns</h2>
        <p>Create and manage marketing campaigns</p>
        {/* Campaigns-specific content */}
      </div>
    </FeatureGate>
  );
}

// ─────────────────────────────────────────────────
// Example 4: Multiple Features (ALL mode)
// ─────────────────────────────────────────────────

export function TrialsAndSubscriptionsPanel() {
  return (
    <FeatureGateMultiple features={['trials', 'subscriptions']} mode="all">
      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-bold">Trials & Subscriptions</h2>
        <p>Comprehensive view of trials and subscription management</p>
        {/* Content requiring both features */}
      </div>
    </FeatureGateMultiple>
  );
}

// ─────────────────────────────────────────────────
// Example 5: Multiple Features (ANY mode)
// ─────────────────────────────────────────────────

export function CaseOrCampaignPanel() {
  return (
    <FeatureGateMultiple
      features={['matters', 'campaigns']}
      mode="any"
      fallback={<div>No case or campaign management available</div>}
    >
      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-bold">Case/Campaign Management</h2>
        <p>Manage legal matters or marketing campaigns</p>
        {/* Content for either feature */}
      </div>
    </FeatureGateMultiple>
  );
}

// ─────────────────────────────────────────────────
// Example 6: Using useFeatureGate Hook
// ─────────────────────────────────────────────────

export function DynamicFeaturePanel() {
  const isFeatureEnabled = useFeatureGate();

  return (
    <div className="space-y-4">
      {isFeatureEnabled('trials') && (
        <div className="p-4 border rounded-lg">
          <h3>Trials</h3>
        </div>
      )}
      
      {isFeatureEnabled('applications') && (
        <div className="p-4 border rounded-lg">
          <h3>Applications</h3>
        </div>
      )}
      
      {isFeatureEnabled('matters') && (
        <div className="p-4 border rounded-lg">
          <h3>Matters</h3>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Example 7: Using useIndustry Hook
// ─────────────────────────────────────────────────

export function IndustryAwarePanel() {
  const { industry, features, terminology } = useIndustry();

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold">
        {terminology.entityPlural} Dashboard
      </h2>
      <p className="text-sm text-gray-600">Industry: {industry}</p>
      
      <div className="mt-4 space-y-2">
        {features.trials && <div>✓ Trials Management</div>}
        {features.applications && <div>✓ Applications Management</div>}
        {features.matters && <div>✓ Legal Matters</div>}
        {features.campaigns && <div>✓ Marketing Campaigns</div>}
        {features.properties && <div>✓ Property Management</div>}
        {features.engagements && <div>✓ Consulting Engagements</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Example 8: Higher-Order Component Pattern
// ─────────────────────────────────────────────────

const PropertiesContent = () => (
  <div className="p-4 border rounded-lg">
    <h2 className="text-xl font-bold">Properties</h2>
    <p>Manage real estate properties</p>
  </div>
);

// Wrap component with feature gating
export const GatedPropertiesPanel = withFeatureGate(
  'properties',
  PropertiesContent,
  <div>Property management not available</div>
);

// ─────────────────────────────────────────────────
// Example 9: Server-Side Feature Check
// ─────────────────────────────────────────────────

export function ServerSideExample({ workspaceIndustry }: { workspaceIndustry: 'SaaS' | 'Law' }) {
  // Can be used in server components or server actions
  const trialsEnabled = isFeatureEnabled('trials', workspaceIndustry);
  const mattersEnabled = isFeatureEnabled('matters', workspaceIndustry);

  return (
    <div className="p-4 border rounded-lg">
      <h2>Server-Side Feature Check</h2>
      <p>Trials: {trialsEnabled ? 'Enabled' : 'Disabled'}</p>
      <p>Matters: {mattersEnabled ? 'Enabled' : 'Disabled'}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Example 10: Conditional Navigation Items
// ─────────────────────────────────────────────────

export function IndustryNavigation() {
  const isFeatureEnabled = useFeatureGate();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', feature: null },
    { label: 'Trials', href: '/trials', feature: 'trials' as const },
    { label: 'Applications', href: '/applications', feature: 'applications' as const },
    { label: 'Matters', href: '/matters', feature: 'matters' as const },
    { label: 'Campaigns', href: '/campaigns', feature: 'campaigns' as const },
    { label: 'Properties', href: '/properties', feature: 'properties' as const },
    { label: 'Engagements', href: '/engagements', feature: 'engagements' as const },
  ];

  return (
    <nav className="space-y-2">
      {navItems.map((item) => {
        // Show item if no feature requirement or if feature is enabled
        if (!item.feature || isFeatureEnabled(item.feature)) {
          return (
            <a
              key={item.href}
              href={item.href}
              className="block p-2 hover:bg-gray-100 rounded"
            >
              {item.label}
            </a>
          );
        }
        return null;
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────
// Example 11: Feature-Based Form Fields
// ─────────────────────────────────────────────────

export function EntityForm() {
  const isFeatureEnabled = useFeatureGate();
  const { terminology } = useIndustry();

  return (
    <form className="space-y-4">
      <div>
        <label>Name</label>
        <input type="text" className="border rounded p-2 w-full" />
      </div>

      {isFeatureEnabled('trials') && (
        <div>
          <label>Trial Status</label>
          <select className="border rounded p-2 w-full">
            <option>Active</option>
            <option>Expired</option>
            <option>Converted</option>
          </select>
        </div>
      )}

      {isFeatureEnabled('applications') && (
        <div>
          <label>Application Status</label>
          <select className="border rounded p-2 w-full">
            <option>Submitted</option>
            <option>Under Review</option>
            <option>Accepted</option>
          </select>
        </div>
      )}

      {isFeatureEnabled('matters') && (
        <div>
          <label>Matter Type</label>
          <select className="border rounded p-2 w-full">
            <option>Litigation</option>
            <option>Corporate</option>
            <option>Family</option>
          </select>
        </div>
      )}

      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Create {terminology.entitySingular}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────
// Example 12: Conditional Dashboard Widgets
// ─────────────────────────────────────────────────

export function DashboardWidgets() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <FeatureGate feature="trials">
        <div className="p-4 border rounded-lg bg-blue-50">
          <h3 className="font-bold">Active Trials</h3>
          <p className="text-3xl">24</p>
        </div>
      </FeatureGate>

      <FeatureGate feature="subscriptions">
        <div className="p-4 border rounded-lg bg-green-50">
          <h3 className="font-bold">Active Subscriptions</h3>
          <p className="text-3xl">156</p>
        </div>
      </FeatureGate>

      <FeatureGate feature="applications">
        <div className="p-4 border rounded-lg bg-purple-50">
          <h3 className="font-bold">Pending Applications</h3>
          <p className="text-3xl">42</p>
        </div>
      </FeatureGate>

      <FeatureGate feature="matters">
        <div className="p-4 border rounded-lg bg-yellow-50">
          <h3 className="font-bold">Active Matters</h3>
          <p className="text-3xl">18</p>
        </div>
      </FeatureGate>

      <FeatureGate feature="campaigns">
        <div className="p-4 border rounded-lg bg-pink-50">
          <h3 className="font-bold">Running Campaigns</h3>
          <p className="text-3xl">7</p>
        </div>
      </FeatureGate>

      <FeatureGate feature="properties">
        <div className="p-4 border rounded-lg bg-indigo-50">
          <h3 className="font-bold">Listed Properties</h3>
          <p className="text-3xl">89</p>
        </div>
      </FeatureGate>
    </div>
  );
}
