'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 9: Workflow Dry-Run Simulator Modal
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Non-Destructive Dry-Run Sandbox:
 *    - Executes simulation flows without committing database mutations or pushing external alerts.
 * 2. Mobile Accessibility:
 *    - Touch targets >= 44px (`min-h-[44px]`).
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  FlaskConical,
  Play,
  Loader2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type {
  WorkflowDefinition,
  WorkflowSimulationResult,
} from '@/lib/workflows/types';
import type { McpPayloadValue } from '@/lib/mcp/types';

export interface WorkflowSimulatorModalProps {
  workflow: WorkflowDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  onSimulate: (
    workflow: WorkflowDefinition,
    payload: Record<string, McpPayloadValue>
  ) => Promise<WorkflowSimulationResult | null>;
}

const PRESET_PAYLOADS: Record<string, Record<string, McpPayloadValue>> = {
  'crm.deal.stalled': {
    eventType: 'crm.deal.stalled',
    dealId: 'deal_enterprise_mock_99',
    dealTitle: 'Apex Global 2026 Expansion',
    daysStalled: 24,
    dealValue: 185000,
    stalledReason: 'Security audit questionnaire pending',
    riskScore: 82,
  },
  'crm.lead.created': {
    eventType: 'crm.lead.created',
    leadId: 'lead_inbound_mock_42',
    companyName: 'Nova FinTech Group',
    leadScore: 88,
    industry: 'Financial Services',
    budgetUsd: 95000,
  },
  'meeting.completed': {
    eventType: 'meeting.completed',
    meetingId: 'meet_sync_mock_17',
    title: 'Enterprise Architecture & Procurement Alignment',
    attendees: ['CTO', 'VP Engineering', 'Head of Compliance'],
    transcriptWordCount: 4200,
  },
};

export function WorkflowSimulatorModal({
  workflow,
  isOpen,
  onClose,
  onSimulate,
}: WorkflowSimulatorModalProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<string>('crm.deal.stalled');
  const [customPayloadJson, setCustomPayloadJson] = React.useState<string>(
    JSON.stringify(PRESET_PAYLOADS['crm.deal.stalled'], null, 2)
  );
  const [isSimulating, setIsSimulating] = React.useState<boolean>(false);
  const [simulationResult, setSimulationResult] = React.useState<WorkflowSimulationResult | null>(null);

  React.useEffect(() => {
    if (workflow) {
      const matchKey = Object.keys(PRESET_PAYLOADS).find((k) => k === workflow.trigger.eventType);
      if (matchKey) {
        setSelectedPreset(matchKey);
        setCustomPayloadJson(JSON.stringify(PRESET_PAYLOADS[matchKey], null, 2));
      }
      setSimulationResult(null);
    }
  }, [workflow]);

  const handleSelectPreset = (key: string) => {
    setSelectedPreset(key);
    setCustomPayloadJson(JSON.stringify(PRESET_PAYLOADS[key], null, 2));
    setSimulationResult(null);
  };

  const handleRunSimulation = async () => {
    if (!workflow) return;

    let payload: Record<string, McpPayloadValue> = {};
    try {
      payload = JSON.parse(customPayloadJson) as Record<string, McpPayloadValue>;
    } catch {
      payload = { error: 'Invalid JSON payload provided' };
    }

    setIsSimulating(true);
    try {
      const res = await onSimulate(workflow, payload);
      setSimulationResult(res);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!workflow) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Interactive Event Trigger Simulator
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Dry-run &ldquo;{workflow.title}&rdquo; with synthetic event payloads before activating live background triggers.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Preset Selector Chips */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Load Synthetic Event Preset:</Label>
          <div className="flex items-center gap-2 flex-wrap">
            {Object.keys(PRESET_PAYLOADS).map((presetKey) => (
              <Button
                key={presetKey}
                type="button"
                variant={selectedPreset === presetKey ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSelectPreset(presetKey)}
                className={`min-h-[44px] sm:min-h-[32px] text-xs font-mono active:scale-[0.97] transition-all ${
                  selectedPreset === presetKey
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                    : 'text-slate-700'
                }`}
              >
                {presetKey}
              </Button>
            ))}
          </div>
        </div>

        {/* JSON Payload Editor */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-700">Event Ingestion Payload (JSON)</Label>
            <Badge variant="outline" className="text-[10px] font-mono text-purple-700 border-purple-200">
              Dry-Run Mode (Non-Mutating)
            </Badge>
          </div>
          <Textarea
            value={customPayloadJson}
            onChange={(e) => setCustomPayloadJson(e.target.value)}
            className="font-mono text-[11px] min-h-[110px] bg-slate-50 border-slate-200 text-slate-800"
          />
        </div>

        {/* Simulation Action Button */}
        <Button
          type="button"
          onClick={handleRunSimulation}
          disabled={isSimulating}
          className="w-full min-h-[44px] text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white active:scale-[0.97] shadow-sm gap-2"
        >
          {isSimulating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Simulating Autonomous Execution...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Execute Dry-Run Simulation</span>
            </>
          )}
        </Button>

        {/* Simulation Output Card */}
        {simulationResult && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in-50 duration-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="font-bold text-slate-900">Simulation Certification Results</span>
              </div>
              <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                {simulationResult.predictedNodesExecuted} Steps Predicted ({simulationResult.estimatedDurationMs}ms)
              </Badge>
            </div>

            {/* Path Traversed */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                Execution Steps Traversed:
              </span>
              <div className="space-y-1.5">
                {simulationResult.executionSteps.map((step, idx) => (
                  <div
                    key={`${step.nodeId}_${idx}`}
                    className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono capitalize">
                        {step.nodeType}
                      </Badge>
                      <span className="font-semibold text-slate-800">{step.title}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">{step.details}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Predicted Actions */}
            {simulationResult.predictedActions.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                  Predicted Downstream Mutations ({simulationResult.predictedActions.length}):
                </span>
                <div className="space-y-1">
                  {simulationResult.predictedActions.map((action, i) => (
                    <div key={i} className="p-2 bg-white rounded border border-slate-200 text-[11px] font-mono flex items-center justify-between">
                      <span className="font-bold text-purple-700">{action.actionType}</span>
                      <span className="text-slate-600">{action.title}</span>
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {action.riskLevel}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approval Gate Interceptions */}
            {simulationResult.predictedApprovalsCount > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-900">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  Approval Intercept Point Predicted ({simulationResult.predictedApprovalsCount} Gate):
                </div>
                <p className="text-[11px] leading-relaxed">
                  In live automation, execution will pause at this human-in-the-loop gate until an administrator verifies the proposed payload.
                </p>
              </div>
            )}

            {/* Warnings if any */}
            {simulationResult.warnings.length > 0 && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px]">
                {simulationResult.warnings.join('; ')}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="min-h-[44px] sm:min-h-[36px] text-xs active:scale-[0.97]"
          >
            Close Simulator
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
