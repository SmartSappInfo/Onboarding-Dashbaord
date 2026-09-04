'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Specialist Detail Drawer & Code-Free Policy Editor
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Deep Persona & Policy Inspection:
 *    - Displays system directives, allowed MCP tools, read/write memory domains, and findings.
 * 2. Code-Free Autonomy Governance:
 *    - Allows operators to adjust autonomy tier and toggle disabled tools directly in the UI.
 * 3. Mobile Accessibility:
 *    - Touch targets >= 44px (`min-h-[44px]`).
 * 4. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1).
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  BookOpen,
  TrendingUp,
  Calendar,
  Target,
  CheckSquare,
  ShieldAlert,
  Sliders,
  Shield,
  Layers,
  Wrench,
  Check,
  Save,
  AlertTriangle,
} from 'lucide-react';
import type {
  SpecialistDescriptor,
  SpecialistWorkspaceConfig,
  SpecialistAutonomyLevel,
} from '@/lib/agents/domain-types';
import { updateSpecialistConfigAction } from '@/lib/agents/actions/domain-agent-actions';
import { useToast } from '@/hooks/use-toast';

export interface SpecialistDetailDrawerProps {
  descriptor: SpecialistDescriptor | null;
  config: SpecialistWorkspaceConfig | null;
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (newConfig: SpecialistWorkspaceConfig) => void;
}

export function SpecialistDetailDrawer({
  descriptor,
  config,
  workspaceId,
  isOpen,
  onClose,
  onConfigSaved,
}: SpecialistDetailDrawerProps) {
  const { toast } = useToast();

  const [autonomy, setAutonomy] = React.useState<SpecialistAutonomyLevel>(
    config?.autonomyLevel || descriptor?.defaultAutonomy || 'supervised'
  );
  const [disabledTools, setDisabledTools] = React.useState<string[]>(
    config?.disabledTools || []
  );
  const [customDirective, setCustomDirective] = React.useState<string>(
    config?.customDirective || ''
  );
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (descriptor) {
      setAutonomy(config?.autonomyLevel || descriptor.defaultAutonomy);
      setDisabledTools(config?.disabledTools || []);
      setCustomDirective(config?.customDirective || '');
    }
  }, [descriptor, config]);

  if (!descriptor) return null;

  const getSpecialistIcon = () => {
    switch (descriptor.id) {
      case 'knowledge_specialist':
        return <BookOpen className="w-5 h-5 text-violet-600" />;
      case 'revenue_specialist':
        return <TrendingUp className="w-5 h-5 text-emerald-600" />;
      case 'meeting_specialist':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'sdr_specialist':
        return <Target className="w-5 h-5 text-amber-600" />;
      case 'operations_specialist':
        return <CheckSquare className="w-5 h-5 text-cyan-600" />;
      case 'governance_specialist':
        return <ShieldAlert className="w-5 h-5 text-rose-600" />;
      default:
        return <Shield className="w-5 h-5 text-indigo-600" />;
    }
  };

  const handleToggleTool = (toolName: string) => {
    if (disabledTools.includes(toolName)) {
      setDisabledTools(disabledTools.filter((t) => t !== toolName));
    } else {
      setDisabledTools([...disabledTools, toolName]);
    }
  };

  const handleSavePolicy = async () => {
    setIsSaving(true);
    try {
      const updated: SpecialistWorkspaceConfig = {
        workspaceId,
        specialistId: descriptor.id,
        autonomyLevel: autonomy,
        disabledTools,
        customDirective: customDirective.trim() || undefined,
        updatedBy: 'current_operator',
        updatedAt: new Date().toISOString(),
      };

      const res = await updateSpecialistConfigAction(updated);
      if (res.success) {
        toast({
          title: 'Specialist Policy Updated',
          description: `Policy configuration saved for ${descriptor.name}.`,
          actionConfig: {
            path: '/admin/companybrain/agents',
            label: 'View Agents',
          },
        });
        if (onConfigSaved) onConfigSaved(updated);
      } else {
        toast({
          title: 'Save Failed',
          description: res.error || 'Failed to update policy.',
          variant: 'destructive',
          actionConfig: {
            path: '/admin/companybrain/agents',
            label: 'Retry',
          },
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Unknown exception saving policy.',
        variant: 'destructive',
        actionConfig: {
          path: '/admin/companybrain/agents',
          label: 'Dismiss',
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto p-4 sm:p-6 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800"
      >
        <SheetHeader className="space-y-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
              {getSpecialistIcon()}
            </div>
            <div>
              <SheetTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {descriptor.name}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500">
                {descriptor.roleTitle} &bull; v{descriptor.version}
              </SheetDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className="text-[11px] font-medium uppercase tracking-wider">
              {descriptor.category}
            </Badge>
            <Badge
              variant="secondary"
              className={`text-[11px] font-medium capitalize ${
                autonomy === 'autonomous'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : autonomy === 'supervised'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {autonomy.replace('_', ' ')}
            </Badge>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-4 space-y-4">
          <TabsList className="grid grid-cols-3 w-full bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <TabsTrigger value="overview" className="text-xs font-medium min-h-[36px]">
              Overview
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-xs font-medium min-h-[36px]">
              Tools & Policy
            </TabsTrigger>
            <TabsTrigger value="memory" className="text-xs font-medium min-h-[36px]">
              Memory Scope
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Overview & System Directive */}
          <TabsContent value="overview" className="space-y-4">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Persona Description
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {descriptor.personaDescription}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Core System Directive
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                {descriptor.systemDirective}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Declared Capabilities
              </span>
              <div className="flex flex-wrap gap-1.5">
                {descriptor.capabilities.map((cap) => (
                  <Badge key={cap} variant="secondary" className="text-xs py-1 px-2.5">
                    {cap.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Tools & Policy Configuration */}
          <TabsContent value="tools" className="space-y-4">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Workspace Autonomy Tier
                </span>
                <Sliders className="w-4 h-4 text-slate-400" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['read_only', 'supervised', 'autonomous'] as SpecialistAutonomyLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setAutonomy(level)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-medium border text-center transition-all min-h-[44px] active:scale-[0.97] ${
                      autonomy === level
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {level.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                {autonomy === 'read_only' && 'Specialist can only query memories and records; all mutations blocked.'}
                {autonomy === 'supervised' && 'Specialist proposes actions, but all mutations require human approval.'}
                {autonomy === 'autonomous' && 'Low-risk actions execute automatically; high-risk actions pause for sign-off.'}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Allowed MCP Tools ({descriptor.allowedTools.length})
              </span>
              <div className="space-y-1.5">
                {descriptor.allowedTools.map((tool) => {
                  const isDisabled = disabledTools.includes(tool);
                  return (
                    <div
                      key={tool}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80"
                    >
                      <div className="flex items-center gap-2">
                        <Wrench className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-mono text-slate-800 dark:text-slate-200">
                          {tool}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleTool(tool)}
                        className={`text-xs px-2.5 py-1 rounded font-medium transition-all min-h-[36px] active:scale-[0.97] ${
                          isDisabled
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isDisabled ? 'Disabled' : 'Active'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label htmlFor="custom-prompt" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Custom Workspace Directive (Optional)
              </label>
              <textarea
                id="custom-prompt"
                rows={3}
                value={customDirective}
                onChange={(e) => setCustomDirective(e.target.value)}
                placeholder="e.g. Prioritize European GDPR compliance rules and enterprise terminology..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <Button
              onClick={handleSavePolicy}
              disabled={isSaving}
              className="w-full min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving Policy...' : 'Save Workspace Policy'}
            </Button>
          </TabsContent>

          {/* Tab 3: Memory Scope */}
          <TabsContent value="memory" className="space-y-4">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Readable Memory Domains
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {descriptor.memoryScope.readDomains.map((dom) => (
                  <Badge key={dom} variant="outline" className="text-[11px] bg-emerald-50/50 text-emerald-800 border-emerald-200">
                    {dom}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> Writable Memory Domains
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {descriptor.memoryScope.writeDomains.map((dom) => (
                  <Badge key={dom} variant="outline" className="text-[11px] bg-blue-50/50 text-blue-800 border-blue-200">
                    {dom}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-2">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Disallowed Domains (Hard Blocked)
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {descriptor.memoryScope.disallowedDomains.map((dom) => (
                  <Badge key={dom} variant="outline" className="text-[11px] bg-rose-50 text-rose-800 border-rose-300">
                    {dom}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
