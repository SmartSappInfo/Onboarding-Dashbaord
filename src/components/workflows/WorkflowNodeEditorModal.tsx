'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 9: Workflow Node Configuration Modal / Slide-Over
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Node Parameter Specialization:
 *    - Strongly binds directly to WorkflowNodeConfig first-class fields:
 *      specialistId, toolName, toolArguments, contextConfig, decisionRules, approvalConfig, actionConfig.
 * 2. Mobile Accessibility:
 *    - All form controls and action buttons maintain >= 44px touch targets.
 * 3. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]`.
 * 4. Strict Zero-`any` & Zero-`unknown` Standard.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  WorkflowNodeConfig,
  WorkflowNodeType,
  DomainSpecialistId,
} from '@/lib/workflows/types';
import type { McpPayloadValue } from '@/lib/mcp/types';

export interface WorkflowNodeEditorModalProps {
  node: WorkflowNodeConfig | null;
  allNodes: WorkflowNodeConfig[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (node: WorkflowNodeConfig) => void;
}

const SPECIALIST_OPTIONS = [
  { id: 'revenue_specialist', label: 'Revenue Specialist (Deals & Pipeline)' },
  { id: 'sdr_specialist', label: 'SDR Specialist (Leads & Qualification)' },
  { id: 'meeting_specialist', label: 'Meeting Specialist (Commitments & Transcripts)' },
  { id: 'operations_specialist', label: 'Operations Specialist (Tasks & Execution)' },
  { id: 'governance_specialist', label: 'Governance Specialist (Compliance & Audit)' },
  { id: 'knowledge_specialist', label: 'Knowledge Specialist (Global Recall & Graph)' },
];

const GOVERNED_TOOLS = [
  { id: 'crm.deal.update', label: 'crm.deal.update (Update Deal Stage/Value)' },
  { id: 'task.create', label: 'task.create (Create Operations Task)' },
  { id: 'crm.lead.update', label: 'crm.lead.update (Score/Update Lead)' },
  { id: 'notification.send', label: 'notification.send (Workspace Push Alert)' },
  { id: 'context.build', label: 'context.build (Assemble Token-Budget Dossier)' },
];

export function WorkflowNodeEditorModal({
  node,
  allNodes,
  isOpen,
  onClose,
  onSave,
}: WorkflowNodeEditorModalProps) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [nodeType, setNodeType] = React.useState<WorkflowNodeType>('specialist');
  const [nextNodeIds, setNextNodeIds] = React.useState<string[]>([]);

  // Specialist Config
  const [specialistId, setSpecialistId] = React.useState<DomainSpecialistId>('revenue_specialist');

  // Context Config
  const [targetType, setTargetType] = React.useState<'deal' | 'lead' | 'contact' | 'meeting'>('deal');
  const [maxTokens, setMaxTokens] = React.useState('3500');

  // Decision Config
  const [decisionField, setDecisionField] = React.useState('score');
  const [decisionOperator, setDecisionOperator] = React.useState<string>('>');
  const [decisionValue, setDecisionValue] = React.useState('70');
  const [trueBranchId, setTrueBranchId] = React.useState('');
  const [falseBranchId, setFalseBranchId] = React.useState('');

  // Tool Config
  const [toolName, setToolName] = React.useState('crm.deal.update');
  const [toolArgsJson, setToolArgsJson] = React.useState('{}');

  // Approval Gate Config
  const [timeoutHours, setTimeoutHours] = React.useState('48');
  const [onTimeout, setOnTimeout] = React.useState<'auto_cancel' | 'escalate' | 'continue_fallback'>('escalate');

  React.useEffect(() => {
    if (node) {
      setTitle(node.title);
      setDescription(node.description || '');
      setNodeType(node.nodeType);
      setNextNodeIds(node.nextNodeIds || []);

      if (node.nodeType === 'specialist') {
        if (node.specialistId) setSpecialistId(node.specialistId);
      } else if (node.nodeType === 'context') {
        if (node.contextConfig?.targetSubjectType) {
          setTargetType(node.contextConfig.targetSubjectType);
        }
        if (node.contextConfig?.maxTokens) {
          setMaxTokens(String(node.contextConfig.maxTokens));
        }
      } else if (node.nodeType === 'decision') {
        const firstRule = node.decisionRules?.[0];
        if (firstRule) {
          setDecisionField(firstRule.condition.field);
          setDecisionOperator(
            firstRule.condition.operator === 'eq'
              ? '=='
              : firstRule.condition.operator === 'neq'
              ? '!='
              : firstRule.condition.operator === 'gt'
              ? '>'
              : '<'
          );
          setDecisionValue(String(firstRule.condition.value));
          setTrueBranchId(firstRule.targetNodeId);
        }
        if (node.defaultNextNodeId) {
          setFalseBranchId(node.defaultNextNodeId);
        }
      } else if (node.nodeType === 'tool') {
        if (node.toolName) setToolName(node.toolName);
        if (node.toolArguments) {
          setToolArgsJson(JSON.stringify(node.toolArguments, null, 2));
        }
      } else if (node.nodeType === 'approval_gate') {
        if (node.approvalConfig?.timeoutHours) {
          setTimeoutHours(String(node.approvalConfig.timeoutHours));
        }
        if (node.approvalConfig?.onTimeout) {
          setOnTimeout(node.approvalConfig.onTimeout);
        }
      }
    } else {
      setTitle('');
      setDescription('');
      setNodeType('specialist');
      setNextNodeIds([]);
      setSpecialistId('revenue_specialist');
      setToolArgsJson('{}');
    }
  }, [node]);

  const handleSave = () => {
    let parsedArgs: Record<string, McpPayloadValue> = {};
    try {
      parsedArgs = JSON.parse(toolArgsJson);
    } catch {
      parsedArgs = {};
    }

    const updatedNode: WorkflowNodeConfig = {
      id: node?.id || `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim() || 'Untitled Step',
      description: description.trim(),
      nodeType,
      specialistId: nodeType === 'specialist' ? specialistId : undefined,
      contextConfig:
        nodeType === 'context'
          ? {
              targetSubjectType: targetType,
              subjectIdBindingField: targetType === 'deal' ? 'dealId' : 'leadId',
              maxTokens: parseInt(maxTokens, 10) || 3500,
              tiers: [1, 2, 3],
              includeGraph: true,
            }
          : undefined,
      decisionRules:
        nodeType === 'decision'
          ? [
              {
                id: 'rule_1',
                condition: {
                  field: decisionField,
                  operator:
                    decisionOperator === '=='
                      ? 'eq'
                      : decisionOperator === '!='
                      ? 'neq'
                      : decisionOperator === '>'
                      ? 'gt'
                      : 'lt',
                  value: isNaN(Number(decisionValue)) ? decisionValue : Number(decisionValue),
                },
                targetNodeId: trueBranchId,
                label: 'True Branch',
              },
            ]
          : undefined,
      defaultNextNodeId: nodeType === 'decision' ? falseBranchId : undefined,
      toolName: nodeType === 'tool' ? toolName : undefined,
      toolArguments: nodeType === 'tool' ? parsedArgs : undefined,
      approvalConfig:
        nodeType === 'approval_gate'
          ? {
              prompt: description || title || 'Human approval required',
              timeoutHours: parseInt(timeoutHours, 10) || 48,
              onTimeout,
            }
          : undefined,
      nextNodeIds:
        nodeType === 'decision' ? [trueBranchId, falseBranchId].filter(Boolean) : nextNodeIds,
    };

    onSave(updatedNode);
    onClose();
  };

  const otherNodes = allNodes.filter((n) => n.id !== node?.id);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6 space-y-4">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            {node ? 'Configure Workflow Step' : 'Add Pipeline Step'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {/* Node Title & Type */}
          <div className="space-y-1.5">
            <Label htmlFor="node-title" className="text-xs font-semibold text-slate-700">
              Step Title
            </Label>
            <Input
              id="node-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SDR Lead Scoring"
              className="min-h-[44px] text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="node-type" className="text-xs font-semibold text-slate-700">
              Step Type
            </Label>
            <Select
              value={nodeType}
              onValueChange={(val) => setNodeType(val as WorkflowNodeType)}
            >
              <SelectTrigger id="node-type" className="min-h-[44px] text-xs">
                <SelectValue placeholder="Select node type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="specialist">Domain Specialist (Phase 8 Agent)</SelectItem>
                <SelectItem value="context">Context Builder (Phase 5 Dossier)</SelectItem>
                <SelectItem value="decision">Decision Gateway (Predicate Branching)</SelectItem>
                <SelectItem value="tool">Governed Tool (Phase 6 MCP)</SelectItem>
                <SelectItem value="approval_gate">Human Approval Gate (Sign-Off)</SelectItem>
                <SelectItem value="action">Action Dispatcher (Tasks / Push)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="node-desc" className="text-xs font-semibold text-slate-700">
              Description (Optional)
            </Label>
            <Input
              id="node-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain this step's business role"
              className="min-h-[44px] text-xs"
            />
          </div>

          {/* Dynamic Configuration per NodeType */}
          {nodeType === 'specialist' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Select Specialist Agent</Label>
                <Select
                  value={specialistId}
                  onValueChange={(val) => setSpecialistId(val as DomainSpecialistId)}
                >
                  <SelectTrigger className="min-h-[44px] text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALIST_OPTIONS.map((spec) => (
                      <SelectItem key={spec.id} value={spec.id}>
                        {spec.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {nodeType === 'context' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Target Subject Entity Type</Label>
                <Select
                  value={targetType}
                  onValueChange={(val) => setTargetType(val as 'deal' | 'lead' | 'contact' | 'meeting')}
                >
                  <SelectTrigger className="min-h-[44px] text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deal">Deal</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Max Token Budget (Tiers 1–3)</Label>
                <Input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                  className="min-h-[44px] text-xs bg-white"
                />
              </div>
            </div>
          )}

          {nodeType === 'decision' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Field</Label>
                  <Input
                    value={decisionField}
                    onChange={(e) => setDecisionField(e.target.value)}
                    placeholder="score"
                    className="min-h-[44px] text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Operator</Label>
                  <Select value={decisionOperator} onValueChange={setDecisionOperator}>
                    <SelectTrigger className="min-h-[44px] text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=">">&gt; Greater</SelectItem>
                      <SelectItem value="<">&lt; Less</SelectItem>
                      <SelectItem value="==">== Equals</SelectItem>
                      <SelectItem value="!=">!= Not Equals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Threshold</Label>
                  <Input
                    value={decisionValue}
                    onChange={(e) => setDecisionValue(e.target.value)}
                    placeholder="70"
                    className="min-h-[44px] text-xs bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">True Branch Target</Label>
                  <Select value={trueBranchId} onValueChange={setTrueBranchId}>
                    <SelectTrigger className="min-h-[44px] text-xs bg-white">
                      <SelectValue placeholder="Select node" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherNodes.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">False Branch Target</Label>
                  <Select value={falseBranchId} onValueChange={setFalseBranchId}>
                    <SelectTrigger className="min-h-[44px] text-xs bg-white">
                      <SelectValue placeholder="Select node" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherNodes.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {nodeType === 'tool' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Select Governed MCP Tool</Label>
                <Select value={toolName} onValueChange={setToolName}>
                  <SelectTrigger className="min-h-[44px] text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOVERNED_TOOLS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Arguments Template (JSON)</Label>
                <Textarea
                  value={toolArgsJson}
                  onChange={(e) => setToolArgsJson(e.target.value)}
                  className="font-mono text-[11px] min-h-[72px] bg-white"
                />
              </div>
            </div>
          )}

          {nodeType === 'approval_gate' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-amber-900">Timeout Duration (Hours)</Label>
                <Select value={timeoutHours} onValueChange={setTimeoutHours}>
                  <SelectTrigger className="min-h-[44px] text-xs bg-white border-amber-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 Hours</SelectItem>
                    <SelectItem value="48">48 Hours (Recommended)</SelectItem>
                    <SelectItem value="72">72 Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-amber-900">On-Timeout Fallback Action</Label>
                <Select
                  value={onTimeout}
                  onValueChange={(val) => setOnTimeout(val as 'auto_cancel' | 'escalate' | 'continue_fallback')}
                >
                  <SelectTrigger className="min-h-[44px] text-xs bg-white border-amber-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="escalate">Escalate to Operational Manager</SelectItem>
                    <SelectItem value="auto_cancel">Auto-Cancel Run</SelectItem>
                    <SelectItem value="continue_fallback">Continue via Conservative Fallback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Sequential Next Node (for non-decision nodes) */}
          {nodeType !== 'decision' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Connect to Next Step</Label>
              <Select
                value={nextNodeIds[0] || 'end'}
                onValueChange={(val) => setNextNodeIds(val === 'end' ? [] : [val])}
              >
                <SelectTrigger className="min-h-[44px] text-xs">
                  <SelectValue placeholder="End of pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="end">-- End of Pipeline --</SelectItem>
                  {otherNodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.title} ({n.nodeType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="min-h-[44px] sm:min-h-[36px] text-xs active:scale-[0.97]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.97]"
          >
            Save Step Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
