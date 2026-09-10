'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 9: Turnkey Workflow Blueprint Gallery
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. 1-Click Installation:
 *    - Allows workspace operators to install pre-configured production blueprints.
 * 2. Mobile Accessibility:
 *    - All cards, badges, and action buttons maintain >= 44px touch targets.
 * 3. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]`.
 * 4. Strict Zero-`any` & Zero-`unknown` Standard.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Download,
  CheckCircle2,
  ShieldAlert,
  Zap,
  Bot,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { TURNKEY_WORKFLOW_BLUEPRINTS } from '@/lib/workflows/blueprints';

export interface WorkflowGalleryGridProps {
  onInstallBlueprint: (blueprintId: string) => Promise<void>;
  installingId?: string | null;
  installedBlueprintIds?: string[];
}

export function WorkflowGalleryGrid({
  onInstallBlueprint,
  installingId,
  installedBlueprintIds = [],
}: WorkflowGalleryGridProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-bold text-slate-900">
            Turnkey Autonomous Blueprints
          </h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Production-certified agentic workflows with pre-configured specialist agents, token-budget context assembly, decision thresholds, and human-in-the-loop approval gates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TURNKEY_WORKFLOW_BLUEPRINTS.map((blueprint) => {
          const isInstalling = installingId === blueprint.id;
          const isInstalled = installedBlueprintIds.includes(blueprint.id);
          const hasApprovalGate = blueprint.nodes.some((n) => n.nodeType === 'approval_gate');
          const specialistCount = blueprint.nodes.filter((n) => n.nodeType === 'specialist').length;

          return (
            <Card
              key={blueprint.id}
              className="border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between rounded-xl overflow-hidden"
            >
              <div>
                <CardHeader className="p-4 sm:p-5 pb-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 text-[10px] font-mono">
                      <Zap className="w-3 h-3 mr-1 text-amber-600" />
                      {blueprint.trigger.eventType}
                    </Badge>
                    {hasApprovalGate && (
                      <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-800 text-[10px] font-medium">
                        <ShieldAlert className="w-3 h-3 mr-1 text-rose-600" />
                        HITL Gate
                      </Badge>
                    )}
                  </div>

                  <CardTitle className="text-sm font-bold text-slate-900 leading-snug">
                    {blueprint.title}
                  </CardTitle>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                    {blueprint.description}
                  </p>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 pt-0 space-y-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span className="flex items-center gap-1">
                        <Bot className="w-3 h-3 text-blue-600" />
                        Specialists Involved:
                      </span>
                      <span className="font-semibold text-slate-900">{specialistCount} Agents</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Total Nodes in Graph:</span>
                      <span className="font-semibold text-slate-900">{blueprint.nodes.length} Steps</span>
                    </div>
                  </div>

                  {/* Flow preview pills */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block">
                      Pipeline Traversal:
                    </span>
                    <div className="flex items-center gap-1 flex-wrap text-[10px] text-slate-600">
                      {blueprint.nodes.map((node, i) => (
                        <React.Fragment key={node.id}>
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 capitalize">
                            {node.nodeType.replace('_', ' ')}
                          </span>
                          {i < blueprint.nodes.length - 1 && (
                            <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </div>

              <CardFooter className="p-4 sm:p-5 pt-0">
                <Button
                  type="button"
                  onClick={() => onInstallBlueprint(blueprint.id)}
                  disabled={isInstalling}
                  className={`w-full min-h-[44px] text-xs font-semibold active:scale-[0.97] transition-all shadow-xs gap-1.5 ${
                    isInstalled
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Installing into Workspace...</span>
                    </>
                  ) : isInstalled ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Re-Install Blueprint</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Install Blueprint</span>
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
