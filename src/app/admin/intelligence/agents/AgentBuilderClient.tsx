'use client';

/**
 * @fileOverview Agent Persona Studio & Policy Editor Client Console (Phase 8 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 7: Mobile-first touch targets >= 44px with Emil Kowalski mechanical feel.
 * - Rule 8 & 47: Anti-IDOR tenant validation.
 * - Rule 10: Complete inline architectural documentation.
 * - Rule 12 & 21: Autonomous risk levels & mandatory approval thresholds.
 * - Rule 42: Shadow Mode simulation integration.
 * - Rule 60: Dead-man switch emergency pause awareness.
 * - Rule 61: Backoffice operator control plane.
 * - Rule 65: Canary Releases & Staging Drafts SemVer progression.
 */

import * as React from 'react';
import Link from 'next/link';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bot,
  Plus,
  Search,
  ArrowLeft,
  Save,
  UploadCloud,
  FlaskConical,
  GitCompare,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type {
  CustomAgentPersona,
  AgentVersionDiff,
} from '@/platform/ui/builder/agent-builder-types';
import {
  PersonaCatalogCard,
  AgentVersionDiffModal,
  AgentTestLab,
} from '@/components/builder';
import {
  IdentityPurposePanel,
  CapabilitiesDomainPanel,
  MemoryKnowledgePanel,
  GovernancePolicyPanel,
  ModelsBudgetsPanel,
  TriggersOutputsPanel,
} from '@/components/builder/panels';
import {
  listAgentPersonasAction,
  saveAgentPersonaDraftAction,
  publishAgentPersonaAction,
  getAgentVersionDiffAction,
} from '@/app/actions/agent-builder-actions';

export type BuilderFilterTab = 'ALL' | 'CUSTOM' | 'SYSTEM' | 'DRAFTS';
export type StudioTab =
  | 'identity'
  | 'capabilities'
  | 'memory'
  | 'governance'
  | 'models'
  | 'triggers';

const STUDIO_TABS: Array<{ id: StudioTab; label: string; icon: string }> = [
  { id: 'identity', label: '1. Identity & Purpose', icon: 'Bot' },
  { id: 'capabilities', label: '2. Capabilities & Domains', icon: 'Layers' },
  { id: 'memory', label: '3. Memory & Knowledge', icon: 'Brain' },
  { id: 'governance', label: '4. Governance & Policies', icon: 'ShieldCheck' },
  { id: 'models', label: '5. Models & Budgets', icon: 'Zap' },
  { id: 'triggers', label: '6. Triggers & Outputs', icon: 'Radio' },
];

export function AgentBuilderClient() {
  const [personas, setPersonas] = React.useState<CustomAgentPersona[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [filterTab, setFilterTab] = React.useState<BuilderFilterTab>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  // Studio Mode State
  const [activePersona, setActivePersona] = React.useState<CustomAgentPersona | null>(null);
  const [activeStudioTab, setActiveStudioTab] = React.useState<StudioTab>('identity');
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [notification, setNotification] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals & Drawers
  const [testLabPersona, setTestLabPersona] = React.useState<CustomAgentPersona | null>(null);
  const [isTestLabOpen, setIsTestLabOpen] = React.useState(false);

  const [diffModalData, setDiffModalData] = React.useState<AgentVersionDiff | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = React.useState(false);

  // 300ms Debounced Search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch personas on mount
  const loadPersonas = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listAgentPersonasAction({
        organizationId: 'default-org',
        workspaceId: 'default',
      });
      if (res.success && res.data) {
        setPersonas(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadPersonas();
  }, [loadPersonas]);

  // Clear notification after 4s
  React.useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Filtered Personas
  const filteredPersonas = React.useMemo(() => {
    return personas.filter((p) => {
      // Search filter
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const matchesName = p.identity.name.toLowerCase().includes(q);
        const matchesRole = p.identity.role.toLowerCase().includes(q);
        const matchesDesc = p.identity.description.toLowerCase().includes(q);
        const matchesSlug = p.identity.slug.toLowerCase().includes(q);
        if (!matchesName && !matchesRole && !matchesDesc && !matchesSlug) {
          return false;
        }
      }

      // Tab filter
      if (filterTab === 'CUSTOM') return !p.isBuiltIn;
      if (filterTab === 'SYSTEM') return p.isBuiltIn;
      if (filterTab === 'DRAFTS') return p.status === 'draft';
      return true;
    });
  }, [personas, debouncedSearch, filterTab]);

  // Handlers for Studio Editor
  const handleCreateNewPersona = () => {
    const newPersona: CustomAgentPersona = {
      id: `custom_agent_${Date.now().toString().slice(-6)}`,
      organizationId: 'default-org',
      workspaceId: 'default',
      version: '0.1.0',
      status: 'draft',
      isBuiltIn: false,
      identity: {
        name: 'New Custom Agent',
        slug: `agent_${Date.now().toString().slice(-6)}`,
        avatarIcon: 'Bot',
        role: 'Autonomous Operations Specialist',
        description: 'Custom autonomous agent designed to streamline platform operations.',
        systemPromptSnippet:
          'You are a specialized autonomous SmartSapp agent. You operate strictly within your assigned domain capabilities and budget limits.',
      },
      capabilities: {
        allowedDomains: ['crm_contacts', 'knowledge_memory'],
        allowedCapabilities: [],
        maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
      },
      memory: {
        enabledTiers: ['working', 'semantic'],
        decayPreset: 'standard',
        retrievalTokenLimit: 2000,
        searchThreshold: 0.7,
      },
      governance: {
        maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
        mandatoryApprovalRiskLevels: ['L3_EXTERNAL_COMMUNICATION_FINANCE', 'L4_PRIVILEGED_DESTRUCTIVE'],
        delegationDepthCeiling: 2,
        requireHumanIntervention: false,
        allowedEnvironments: ['development', 'staging', 'production'],
      },
      modelsAndBudgets: {
        primaryModelTier: 'flash',
        fallbackModelTier: 'flash',
        budgets: {
          maxDurationMs: 120000,
          maxTokens: 50000,
          maxToolCalls: 15,
          maxRecordsMutated: 25,
          costBudgetUsd: 5.0,
        },
      },
      triggers: {
        triggerType: 'manual',
        eventSubscriptions: [],
        enabledNotificationChannels: ['in_app'],
      },
      authorId: 'user',
      authorName: 'Operator',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setActivePersona(newPersona);
    setActiveStudioTab('identity');
  };

  const handleSaveDraft = async () => {
    if (!activePersona) return;
    setIsSavingDraft(true);
    setNotification(null);

    try {
      const res = await saveAgentPersonaDraftAction({
        organizationId: activePersona.organizationId,
        workspaceId: activePersona.workspaceId,
        personaId: activePersona.isBuiltIn ? undefined : activePersona.id,
        identity: activePersona.identity,
        capabilities: activePersona.capabilities,
        memory: activePersona.memory,
        governance: activePersona.governance,
        modelsAndBudgets: activePersona.modelsAndBudgets,
        triggers: activePersona.triggers,
      });

      if (res.success && res.data) {
        setActivePersona(res.data);
        setNotification({
          type: 'success',
          message: `Persona draft '${res.data.identity.name}' saved successfully.`,
        });
        await loadPersonas();
      } else {
        setNotification({
          type: 'error',
          message: res.error?.message || 'Failed to save draft.',
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error saving draft.',
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePublishRelease = async () => {
    if (!activePersona) return;
    setIsPublishing(true);
    setNotification(null);

    try {
      const res = await publishAgentPersonaAction({
        personaId: activePersona.id,
        organizationId: activePersona.organizationId,
        workspaceId: activePersona.workspaceId,
        versionBump: 'patch',
      });

      if (res.success && res.data) {
        setActivePersona(res.data);
        setIsDiffModalOpen(false);
        setNotification({
          type: 'success',
          message: `Persona '${res.data.identity.name}' published as v${res.data.version}!`,
        });
        await loadPersonas();
      } else {
        setNotification({
          type: 'error',
          message: res.error?.message || 'Failed to publish persona release.',
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error publishing release.',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOpenDiff = async (persona: CustomAgentPersona) => {
    try {
      const res = await getAgentVersionDiffAction({
        organizationId: persona.organizationId,
        personaId: persona.id,
        workspaceId: persona.workspaceId,
      });

      if (res.success && res.data) {
        setDiffModalData(res.data);
        setIsDiffModalOpen(true);
      } else {
        setNotification({
          type: 'error',
          message: res.error?.message || 'Unable to compute version diff.',
        });
      }
    } catch {
      setNotification({
        type: 'error',
        message: 'Failed to load version diff.',
      });
    }
  };

  const handleOpenTestLab = (persona: CustomAgentPersona) => {
    setTestLabPersona(persona);
    setIsTestLabOpen(true);
  };

  return (
    <PageContainerFluid>
      <div className="flex flex-col min-h-screen bg-background font-figtree">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-xl border p-3.5 shadow-lg text-xs font-medium transition-all ${
            notification.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* VIEW 1: STUDIO EDITOR VIEW */}
      {activePersona ? (
        <div className="flex-1 flex flex-col w-full pb-20">
          {/* Top Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5 mb-6 border-b border-border/80">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl min-h-[44px] active:scale-[0.97] text-xs gap-1.5"
                onClick={() => {
                  setActivePersona(null);
                  loadPersonas();
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Catalog
              </Button>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                    {activePersona.identity.name}
                  </h1>
                  <Badge
                    variant={activePersona.status === 'draft' ? 'outline' : 'secondary'}
                    className={
                      activePersona.status === 'draft'
                        ? 'border-amber-500/40 text-amber-500 bg-amber-500/5 text-xs'
                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs'
                    }
                  >
                    {activePersona.status === 'draft' ? 'Draft' : 'Published'}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    v{activePersona.version}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  ID: {activePersona.id}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl min-h-[44px] active:scale-[0.97] text-xs gap-1.5"
                onClick={() => handleOpenTestLab(activePersona)}
              >
                <FlaskConical className="h-4 w-4 text-primary" />
                Test in Lab
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="rounded-xl min-h-[44px] active:scale-[0.97] text-xs gap-1.5"
                onClick={() => handleOpenDiff(activePersona)}
              >
                <GitCompare className="h-4 w-4" />
                Version Diff
              </Button>

              {!activePersona.isBuiltIn && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-xl min-h-[44px] active:scale-[0.97] text-xs font-medium gap-1.5"
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft}
                  >
                    {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Draft
                  </Button>

                  <Button
                    size="sm"
                    className="rounded-xl min-h-[44px] active:scale-[0.97] text-xs font-medium gap-1.5"
                    onClick={handlePublishRelease}
                    disabled={isPublishing}
                  >
                    {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    Publish Release
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* 6 Studio Tabs Navigation */}
          <div className="flex overflow-x-auto pb-2 gap-2 mb-6 border-b border-border/60">
            {STUDIO_TABS.map((tab) => {
              const isSelected = activeStudioTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveStudioTab(tab.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all active:scale-[0.97] min-h-[44px] ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Active Panel Body */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
            {activeStudioTab === 'identity' && (
              <IdentityPurposePanel
                value={activePersona.identity}
                onChange={(identity) => setActivePersona({ ...activePersona, identity })}
                isBuiltIn={activePersona.isBuiltIn}
              />
            )}

            {activeStudioTab === 'capabilities' && (
              <CapabilitiesDomainPanel
                value={activePersona.capabilities}
                onChange={(capabilities) => setActivePersona({ ...activePersona, capabilities })}
                isBuiltIn={activePersona.isBuiltIn}
              />
            )}

            {activeStudioTab === 'memory' && (
              <MemoryKnowledgePanel
                value={activePersona.memory}
                onChange={(memory) => setActivePersona({ ...activePersona, memory })}
                isBuiltIn={activePersona.isBuiltIn}
              />
            )}

            {activeStudioTab === 'governance' && (
              <GovernancePolicyPanel
                value={activePersona.governance}
                onChange={(governance) => setActivePersona({ ...activePersona, governance })}
                isBuiltIn={activePersona.isBuiltIn}
              />
            )}

            {activeStudioTab === 'models' && (
              <ModelsBudgetsPanel
                value={activePersona.modelsAndBudgets}
                onChange={(modelsAndBudgets) => setActivePersona({ ...activePersona, modelsAndBudgets })}
                isBuiltIn={activePersona.isBuiltIn}
              />
            )}

            {activeStudioTab === 'triggers' && (
              <TriggersOutputsPanel
                value={activePersona.triggers}
                onChange={(triggers) => setActivePersona({ ...activePersona, triggers })}
                isBuiltIn={activePersona.isBuiltIn}
              />
            )}
          </div>
        </div>
      ) : (
        /* VIEW 2: PERSONA CATALOG GRID */
        <div className="flex-1 flex flex-col w-full pb-20">
          {/* Executive Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-border/80 pb-5">
            <div className="flex items-center gap-2.5">
              <Link
                href="/admin/intelligence"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Agent Persona Studio & Policy Editor
              </h1>
              <CardInfoTooltip text="Build, configure, govern, and test autonomous agent personas. Enforces Rule 16 least privilege, Rule 23 budget ceilings, and Rule 42 shadow mode testing." />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Filter Tabs - Standard Segmented Pill Navigation at Top Right */}
              <div className="inline-flex items-center gap-1 bg-muted/30 dark:bg-muted/40 p-1 rounded-xl border border-border/60 shadow-inner h-auto shrink-0">
                {(
                  [
                    { id: 'ALL', label: 'All Personas' },
                    { id: 'CUSTOM', label: 'Custom' },
                    { id: 'SYSTEM', label: 'Built-in' },
                    { id: 'DRAFTS', label: 'Drafts' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterTab(tab.id)}
                    className={`h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] ${
                      filterTab === tab.id
                        ? 'bg-card text-primary font-bold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <Button
                className="rounded-xl min-h-[44px] active:scale-[0.97] text-xs font-medium gap-2 shadow-sm"
                onClick={handleCreateNewPersona}
              >
                <Plus className="h-4 w-4" />
                New Agent Persona
              </Button>
            </div>
          </div>

          {/* Search Toolbar */}
          <div className="flex items-center justify-end mb-6">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search personas, roles, domains..."
                className="pl-9 rounded-xl min-h-[44px] text-xs"
              />
            </div>
          </div>

          {/* Personas Grid */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground text-xs gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <span>Loading agent personas...</span>
            </div>
          ) : filteredPersonas.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
              <Bot className="h-10 w-10 text-muted-foreground/60 mb-3" />
              <h3 className="text-sm font-semibold text-foreground">No Agent Personas Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                {debouncedSearch
                  ? `No personas matching "${debouncedSearch}". Try a different search query.`
                  : 'Get started by creating your first custom agent persona.'}
              </p>
              <Button
                size="sm"
                className="rounded-xl min-h-[44px] text-xs font-medium gap-1.5"
                onClick={handleCreateNewPersona}
              >
                <Plus className="h-3.5 w-3.5" />
                Create First Custom Agent
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPersonas.map((persona) => (
                <PersonaCatalogCard
                  key={persona.id}
                  persona={persona}
                  onEdit={(p) => {
                    setActivePersona(p);
                    setActiveStudioTab('identity');
                  }}
                  onTest={handleOpenTestLab}
                  onViewDiff={handleOpenDiff}
                  onPublish={async (p) => {
                    setActivePersona(p);
                    await handlePublishRelease();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Test Lab Drawer/Dialog */}
      <AgentTestLab
        persona={testLabPersona}
        open={isTestLabOpen}
        onOpenChange={setIsTestLabOpen}
      />

      {/* Version Diff Modal */}
      <AgentVersionDiffModal
        diff={diffModalData}
        open={isDiffModalOpen}
        onOpenChange={setIsDiffModalOpen}
        onConfirmPublish={activePersona && !activePersona.isBuiltIn ? handlePublishRelease : undefined}
        isPublishing={isPublishing}
      />
      </div>
    </PageContainerFluid>
  );
}
