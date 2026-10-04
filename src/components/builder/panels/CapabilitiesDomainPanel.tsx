'use client';

/**
 * @fileOverview Panel 2: Capabilities & Domain Scopes Configuration (Phase 8 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 12: Autonomous risk levels (L0 to L4).
 * - Rule 16: Attenuated domain scopes.
 * - Rule 17: Non-delegable action stripping.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  CAPABILITY_DOMAINS,
  type CapabilityDomain,
} from '@/platform/capabilities/contracts/capability-definition';
import {
  RISK_LEVELS,
  type RiskLevel,
} from '@/platform/capabilities/contracts/risk-levels';
import type { CapabilitiesDomainConfig } from '@/platform/ui/builder/agent-builder-types';
import { ShieldCheck } from 'lucide-react';

export interface CapabilitiesDomainPanelProps {
  value: CapabilitiesDomainConfig;
  onChange: (value: CapabilitiesDomainConfig) => void;
  isBuiltIn?: boolean;
}

const DOMAIN_LABELS: Record<CapabilityDomain, { label: string; desc: string }> = {
  crm_contacts: { label: 'CRM & Contacts', desc: 'Manage contact records, timelines, and relationships' },
  deals_revenue: { label: 'Deals & Revenue', desc: 'Track sales pipelines, deals, and stages' },
  lead_intelligence: { label: 'Lead Intelligence', desc: 'Score, enrich, and qualify inbound leads' },
  communication_messaging: { label: 'Communication & Messaging', desc: 'Send emails, SMS, and WhatsApp messages' },
  knowledge_memory: { label: 'Knowledge & Memory', desc: 'Search corporate documents and semantic memory' },
  tasks_productivity: { label: 'Tasks & Productivity', desc: 'Create and assign operator tasks' },
  meetings_conversations: { label: 'Meetings & Audio', desc: 'Inspect transcripts and call recordings' },
  identity_access: { label: 'Identity & Access', desc: 'User profiles and organization memberships' },
  ai_governance: { label: 'AI Governance & Policy', desc: 'Security rules, approval policies, and dead-man controls' },
  campaigns_marketing: { label: 'Campaigns & Marketing', desc: 'Broadcast outreach and marketing campaigns' },
  forms_surveys: { label: 'Forms & Surveys', desc: 'Interactive forms and survey data collection' },
  automation_workflows: { label: 'Automation & Workflows', desc: 'Deterministic workflow execution and triggers' },
  media_creative: { label: 'Media & Creative', desc: 'Storage objects, creative assets, and generated media' },
  finance_subscriptions: { label: 'Finance & Subscriptions', desc: 'Stripe payments, billing, and subscription state' },
  analytics_reporting: { label: 'Analytics & Reporting', desc: 'Aggregated metrics and executive KPIs' },
  platform_integrations: { label: 'Platform Integrations', desc: 'Third-party API connectors and webhooks' },
  experience_portal: { label: 'Experience Portal', desc: 'Client portal spaces and collaboration' },
  school_operations: { label: 'School Operations', desc: 'Educational courses, enrollments, and academic workflows' },
};

export function CapabilitiesDomainPanel({
  value,
  onChange,
  isBuiltIn = false,
}: CapabilitiesDomainPanelProps) {
  const toggleDomain = (domain: CapabilityDomain) => {
    if (isBuiltIn) return;
    const exists = value.allowedDomains.includes(domain);
    let updated: CapabilityDomain[];
    if (exists) {
      if (value.allowedDomains.length <= 1) return; // Keep at least 1
      updated = value.allowedDomains.filter((d) => d !== domain);
    } else {
      updated = [...value.allowedDomains, domain];
    }
    onChange({
      ...value,
      allowedDomains: updated,
    });
  };

  const handleRiskChange = (risk: RiskLevel) => {
    if (isBuiltIn) return;
    onChange({
      ...value,
      maxAutonomousRiskLevel: risk,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Max Autonomous Risk Level Ceiling (Rule 12) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Maximum Autonomous Risk Level (Rule 12 & 21)
          </label>
          <span className="text-[11px] text-muted-foreground">
            Determines whether mutating operations require approval
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {RISK_LEVELS.map((risk) => {
            const isSelected = value.maxAutonomousRiskLevel === risk;
            return (
              <button
                key={risk}
                type="button"
                disabled={isBuiltIn}
                onClick={() => handleRiskChange(risk)}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 min-h-[44px] text-left transition-all active:scale-[0.97] ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary font-medium shadow-sm'
                    : 'border-border/70 bg-card hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold text-foreground">{risk}</span>
                  {isSelected && <ShieldCheck className="h-4 w-4 text-primary" />}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {risk === 'L0_READ' && 'Strict read-only analysis'}
                  {risk === 'L1_INTERNAL_DRAFT' && 'Create drafts without sending'}
                  {risk === 'L2_STATE_MUTATION' && 'Update non-critical records'}
                  {risk === 'L3_EXTERNAL_COMMUNICATION_FINANCE' && 'Send emails/payments'}
                  {risk === 'L4_PRIVILEGED_DESTRUCTIVE' && 'Delete or modify permissions'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Allowed Capability Domains (Rule 16 Attenuated Scope) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Allowed Capability Domains ({value.allowedDomains.length} Active)
          </label>
          <Badge variant="outline" className="text-[10px]">
            Rule 16 Least Privilege
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {CAPABILITY_DOMAINS.map((domain) => {
            const isChecked = value.allowedDomains.includes(domain);
            const info = DOMAIN_LABELS[domain] || { label: domain, desc: '' };
            return (
              <button
                key={domain}
                type="button"
                disabled={isBuiltIn}
                onClick={() => toggleDomain(domain)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 min-h-[44px] text-left transition-all active:scale-[0.97] ${
                  isChecked
                    ? 'border-primary/60 bg-primary/5 text-foreground font-medium'
                    : 'border-border/60 bg-card/60 hover:bg-muted/20 text-muted-foreground'
                }`}
              >
                <div
                  className={`flex h-4 w-4 shrink-0 rounded border mt-0.5 items-center justify-center ${
                    isChecked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/40'
                  }`}
                >
                  {isChecked && <span className="text-[10px] leading-none">✓</span>}
                </div>
                <div>
                  <div className="text-xs font-medium tracking-tight text-foreground">{info.label}</div>
                  <div className="text-[11px] text-muted-foreground line-clamp-1">{info.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
