'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 9: Visual Workflow Builder Canvas
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Responsive Linear & Graph Layout:
 *    - Mobile (< 768px): Linear vertical flow with touch targets >= 44px.
 *    - Desktop (>= 768px): Pipeline flow with connectors, node badges, and actions.
 * 2. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]`.
 * 3. Strict Zero-`any` & Zero-`unknown` Standard.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Zap,
  Bot,
  Layers,
  GitBranch,
  Wrench,
  ShieldCheck,
  Activity,
  Plus,
  Play,
  FlaskConical,
  Edit2,
  Trash2,
  ArrowDown,
  ArrowRight,
  Save,
  Loader2,
} from 'lucide-react';
import type {
  WorkflowDefinition,
  WorkflowNodeConfig,
  WorkflowNodeType,
} from '@/lib/workflows/types';
import { WorkflowNodeEditorModal } from './WorkflowNodeEditorModal';

export interface WorkflowBuilderCanvasProps {
  workflow: WorkflowDefinition;
  onSaveWorkflow: (updated: WorkflowDefinition) => Promise<void>;
  onSimulate: (workflow: WorkflowDefinition) => void;
  onExecute: (workflow: WorkflowDefinition) => Promise<void>;
  isSaving?: boolean;
  isExecuting?: boolean;
}

function getNodeIcon(nodeType: WorkflowNodeType) {
  switch (nodeType) {
    case 'trigger':
      return <Zap className="w-4 h-4 text-amber-500" />;
    case 'specialist':
      return <Bot className="w-4 h-4 text-blue-500" />;
    case 'context':
      return <Layers className="w-4 h-4 text-indigo-500" />;
    case 'decision':
      return <GitBranch className="w-4 h-4 text-purple-500" />;
    case 'tool':
      return <Wrench className="w-4 h-4 text-emerald-500" />;
    case 'approval_gate':
      return <ShieldCheck className="w-4 h-4 text-rose-500" />;
    case 'action':
      return <Activity className="w-4 h-4 text-sky-500" />;
    default:
      return <Activity className="w-4 h-4 text-slate-500" />;
  }
}

function getNodeBadgeVariant(nodeType: WorkflowNodeType) {
  switch (nodeType) {
    case 'trigger':
      return 'border-amber-300 bg-amber-50 text-amber-900';
    case 'specialist':
      return 'border-blue-300 bg-blue-50 text-blue-900';
    case 'context':
      return 'border-indigo-300 bg-indigo-50 text-indigo-900';
    case 'decision':
      return 'border-purple-300 bg-purple-50 text-purple-900';
    case 'tool':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    case 'approval_gate':
      return 'border-rose-300 bg-rose-50 text-rose-900';
    case 'action':
      return 'border-sky-300 bg-sky-50 text-sky-900';
    default:
      return 'border-slate-300 bg-slate-50 text-slate-900';
  }
}

export function WorkflowBuilderCanvas({
  workflow: initialWorkflow,
  onSaveWorkflow,
  onSimulate,
  onExecute,
  isSaving = false,
  isExecuting = false,
}: WorkflowBuilderCanvasProps) {
  const [workflow, setWorkflow] = React.useState<WorkflowDefinition>(initialWorkflow);
  const [editingNode, setEditingNode] = React.useState<WorkflowNodeConfig | null>(null);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);

  React.useEffect(() => {
    setWorkflow(initialWorkflow);
  }, [initialWorkflow]);

  const handleToggleStatus = (active: boolean) => {
    setWorkflow((prev) => ({
      ...prev,
      status: active ? 'active' : 'paused',
    }));
  };

  const handleEditNode = (node: WorkflowNodeConfig) => {
    setEditingNode(node);
    setIsEditorOpen(true);
  };

  const handleAddNode = () => {
    setEditingNode(null);
    setIsEditorOpen(true);
  };

  const handleSaveNode = (savedNode: WorkflowNodeConfig) => {
    setWorkflow((prev) => {
      const existingIndex = prev.nodes.findIndex((n) => n.id === savedNode.id);
      let updatedNodes: WorkflowNodeConfig[];

      if (existingIndex >= 0) {
        updatedNodes = [...prev.nodes];
        updatedNodes[existingIndex] = savedNode;
      } else {
        // If appending a new node, link previous last node to it if not already linked
        updatedNodes = [...prev.nodes];
        if (updatedNodes.length > 0) {
          const last = updatedNodes[updatedNodes.length - 1];
          if (last.nodeType !== 'decision' && last.nextNodeIds.length === 0) {
            updatedNodes[updatedNodes.length - 1] = {
              ...last,
              nextNodeIds: [savedNode.id],
            };
          }
        }
        updatedNodes.push(savedNode);
      }

      return {
        ...prev,
        nodes: updatedNodes,
      };
    });
  };

  const handleDeleteNode = (nodeId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
    }));
  };

  const handleSaveAll = () => {
    onSaveWorkflow(workflow);
  };

  return (
    <div className="space-y-4">
      {/* Workflow Header & Actions */}
      <Card className="border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {workflow.title}
              </h3>
              <div className="flex items-center gap-2">
                <Switch
                  checked={workflow.status === 'active'}
                  onCheckedChange={handleToggleStatus}
                  aria-label="Toggle active automation"
                />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  {workflow.status}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
              {workflow.description}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSimulate(workflow)}
              className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold active:scale-[0.97]"
            >
              <FlaskConical className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
              Simulate Event
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onExecute(workflow)}
              disabled={isExecuting}
              className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold active:scale-[0.97]"
            >
              {isExecuting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              )}
              Execute Run
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.97]"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              Save Pipeline
            </Button>
          </div>
        </div>
      </Card>

      {/* Trigger Overview Banner */}
      <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-amber-950 block">
              Trigger Source: {workflow.trigger.type.toUpperCase()}
            </span>
            <span className="text-[11px] text-amber-800 font-mono">
              Event: {workflow.trigger.eventType || 'Manual Dispatch'}
            </span>
          </div>
        </div>
        <Badge variant="outline" className="border-amber-300 bg-white text-amber-900 text-xs">
          Auto-Listening
        </Badge>
      </div>

      {/* Pipeline Node Cards */}
      <div className="space-y-3">
        {workflow.nodes.map((node, index) => {
          const badgeClass = getNodeBadgeVariant(node.nodeType);

          return (
            <div key={node.id} className="space-y-3">
              <Card className="border-slate-200 hover:border-slate-300 transition-all p-3.5 sm:p-4 rounded-xl shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      {getNodeIcon(node.nodeType)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">
                          Step {index + 1}: {node.title}
                        </span>
                        <Badge variant="outline" className={`text-[10px] font-mono capitalize ${badgeClass}`}>
                          {node.nodeType}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {node.description || 'Configured pipeline node'}
                      </p>

                      {/* Brief Configuration Preview */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px] text-slate-600 font-mono">
                        {node.nodeType === 'specialist' && (
                          <span>Agent: {String(node.specialistId || 'revenue_specialist')}</span>
                        )}
                        {node.nodeType === 'context' && (
                          <span>Dossier: {String(node.contextConfig?.targetSubjectType || 'deal')} (Max {String(node.contextConfig?.maxTokens || 3500)} tokens)</span>
                        )}
                        {node.nodeType === 'decision' && (
                          <span>If: {String(node.decisionRules?.[0]?.condition.field || 'predicate')} {String(node.decisionRules?.[0]?.condition.operator || '==')} {String(node.decisionRules?.[0]?.condition.value || 'true')}</span>
                        )}
                        {node.nodeType === 'tool' && (
                          <span>Tool: {String(node.toolName || 'tool')}</span>
                        )}
                        {node.nodeType === 'approval_gate' && (
                          <span className="text-rose-600 font-semibold">HITL Sign-Off Required (Timeout: {String(node.approvalConfig?.timeoutHours || 48)}h)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Node Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditNode(node)}
                      className="min-h-[44px] sm:min-h-[36px] text-xs text-slate-600 hover:text-blue-600 active:scale-[0.97]"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Configure
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNode(node.id)}
                      className="min-h-[44px] sm:min-h-[36px] text-xs text-slate-600 hover:text-rose-600 active:scale-[0.97]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Connecting Flow Indicator */}
              {index < workflow.nodes.length - 1 && (
                <div className="flex justify-center py-1">
                  <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Step Button */}
        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleAddNode}
            disabled={workflow.nodes.length >= 12}
            className="w-full min-h-[44px] border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 text-xs font-semibold active:scale-[0.97] transition-all"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Pipeline Step {workflow.nodes.length >= 12 ? '(Max 12 Reached)' : ''}
          </Button>
        </div>
      </div>

      {/* Slide-Over / Modal Node Editor */}
      <WorkflowNodeEditorModal
        node={editingNode}
        allNodes={workflow.nodes}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveNode}
      />
    </div>
  );
}
