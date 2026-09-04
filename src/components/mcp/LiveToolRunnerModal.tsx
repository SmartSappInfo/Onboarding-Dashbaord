/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Live MCP Tool Runner Modal
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Safe Interactive Testing:
 *    - Allows administrators to test tool executions safely within the backoffice console.
 * 2. Mobile Accessibility & Touch Targets:
 *    - Minimum touch targets >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]` and smooth loading state.
 * 4. Strict Zero-`any` & Zero-`unknown` Standard:
 *    - Fully typed state and handlers.
 */

'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, AlertTriangle, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import type { GovernedToolInfo } from '@/lib/mcp/actions/mcp-governance-actions';
import type { McpJsonRpcResponse, McpPayloadValue } from '@/lib/mcp/types';

export interface LiveToolRunnerModalProps {
  tool: GovernedToolInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onExecute: (toolName: string, args: Record<string, McpPayloadValue>) => Promise<McpJsonRpcResponse>;
}

export function LiveToolRunnerModal({
  tool,
  isOpen,
  onClose,
  onExecute,
}: LiveToolRunnerModalProps) {
  const [jsonInput, setJsonInput] = React.useState('{}');
  const [jsonError, setJsonError] = React.useState<string | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [response, setResponse] = React.useState<McpJsonRpcResponse | null>(null);
  const [latencyMs, setLatencyMs] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (tool) {
      setResponse(null);
      setLatencyMs(null);
      setJsonError(null);

      // Populate default sample input based on tool name
      let defaultArgs: Record<string, McpPayloadValue> = {};
      if (tool.name === 'memory.recall') {
        defaultArgs = { query: 'contract pricing terms', limit: 5 };
      } else if (tool.name === 'memory.remember') {
        defaultArgs = { content: 'Client prefers quarterly invoices on the 1st.', type: 'preference' };
      } else if (tool.name === 'memory.resolve_conflict') {
        defaultArgs = { conflictId: 'sample_conflict_id', resolution: 'confirm_a', notes: 'Verified via contract' };
      } else if (tool.name === 'context.build') {
        defaultArgs = { objective: 'Prepare executive briefing', maxTokens: 3000 };
      } else if (tool.name === 'context.get_dossier') {
        defaultArgs = { subjectId: 'sample_entity_id', subjectType: 'entity' };
      } else if (tool.name === 'crm.get_entity') {
        defaultArgs = { entityId: 'sample_entity_id' };
      } else if (tool.name === 'crm.search_entities') {
        defaultArgs = { query: 'School', limit: 5 };
      } else if (tool.name === 'deal.get') {
        defaultArgs = { dealId: 'sample_deal_id' };
      } else if (tool.name === 'deal.update_stage') {
        defaultArgs = { dealId: 'sample_deal_id', stageId: 'negotiation', reason: 'Agreed on scope' };
      } else if (tool.name === 'task.list') {
        defaultArgs = { limit: 5 };
      } else if (tool.name === 'task.create') {
        defaultArgs = { title: 'Follow up on proposal', priority: 'high' };
      }

      setJsonInput(JSON.stringify(defaultArgs, null, 2));
    }
  }, [tool]);

  const handleRun = async () => {
    if (!tool) return;
    setJsonError(null);

    let parsedArgs: Record<string, McpPayloadValue>;
    try {
      const parsed = JSON.parse(jsonInput) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Arguments must be a valid JSON object.');
      }
      parsedArgs = parsed as Record<string, McpPayloadValue>;
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON format.');
      return;
    }

    setIsRunning(true);
    const start = Date.now();
    try {
      const res = await onExecute(tool.name, parsedArgs);
      setResponse(res);
      setLatencyMs(Date.now() - start);
    } catch (err) {
      setResponse({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : 'Failed to invoke tool.',
        },
      });
      setLatencyMs(Date.now() - start);
    } finally {
      setIsRunning(false);
    }
  };

  if (!tool) return null;

  const isApprovalRequired = response?.error?.code === -32003;
  const isError = Boolean(response?.error && !isApprovalRequired);
  const isSuccess = Boolean(response?.result);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900">
              Run Tool: <span className="font-mono text-indigo-600">{tool.name}</span>
            </DialogTitle>
            <Badge
              variant="outline"
              className={
                tool.riskLevel === 'read_only'
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : tool.riskLevel === 'low_risk'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : tool.riskLevel === 'high_risk'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }
            >
              {tool.riskLevel.replace('_', ' ').toUpperCase()}
            </Badge>
            {tool.requiresApproval && (
              <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                APPROVAL GATED
              </Badge>
            )}
          </div>
          <DialogDescription className="text-sm text-slate-600 pt-1">
            {tool.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div>
            <Label htmlFor="json-args" className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
              Tool Input Arguments (JSON)
            </Label>
            <Textarea
              id="json-args"
              rows={6}
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setJsonError(null);
              }}
              className="font-mono text-xs leading-relaxed bg-slate-900 text-slate-100 selection:bg-indigo-500 rounded-lg p-3"
              placeholder="{}"
            />
            {jsonError && (
              <p className="text-xs text-rose-600 font-medium mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {jsonError}
              </p>
            )}
          </div>

          {/* Results Display */}
          {response && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider">Execution Output</span>
                {latencyMs !== null && (
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    {latencyMs}ms
                  </span>
                )}
              </div>

              {isApprovalRequired && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">Human Approval Required</p>
                    <p>
                      This execution was blocked by governance policy and queued for administrator adjudication.
                    </p>
                    <p className="font-mono text-amber-900">
                      Approval ID: {String(response?.error?.data && typeof response.error.data === 'object' && 'pendingApprovalId' in response.error.data ? response.error.data.pendingApprovalId : 'pending')}
                    </p>
                  </div>
                </div>
              )}

              {isError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-800 space-y-1">
                    <p className="font-semibold">Execution Error ({response.error?.code})</p>
                    <p>{response.error?.message}</p>
                  </div>
                </div>
              )}

              {isSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-800">
                    <p className="font-semibold">Tool executed successfully</p>
                  </div>
                </div>
              )}

              <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-xs rounded-lg overflow-x-auto max-h-56">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="min-h-[44px] active:scale-[0.97] transition-transform"
          >
            Close
          </Button>
          <Button
            onClick={handleRun}
            disabled={isRunning}
            className="min-h-[44px] active:scale-[0.97] transition-transform bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" /> Execute Tool
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
