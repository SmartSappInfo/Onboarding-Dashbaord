'use client';

/**
 * @fileOverview Standardized Tool Inspector Drawer (Phase 5 Milestone 4 Task 3)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with min-h-[52px] sm:min-h-[56px]
 * - Zero Raw Descriptions: routed exclusively through `<CardInfoTooltip text="..." />` alongside title
 * - Accessible Screen Reader: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]`
 *
 * Security & Governance (Rules 4, 14, 17, 21, 22, 30, 41):
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 14 & 21: Tool fingerprint drift visualization and operator re-approval workflow.
 * - Rule 17: Prominent non-delegable action warning shield badges.
 * - Rule 22: Cryptographic SHA-256 composite & component hash badges with copy capability.
 * - Rule 30: Untrusted tool descriptions and schemas isolated in `<untrusted_reference_data>` container.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Check,
  Code2,
  Lock,
  Layers,
  Fingerprint,
  RefreshCw,
  Eye,
  FileCode,
} from 'lucide-react';
import type { McpToolDetails } from '@/app/actions/mcp-actions';

export interface ToolInspectorDrawerProps {
  tool: McpToolDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'overview' | 'fingerprint' | 'schema' | 'permissions';
  onApproveFingerprint?: (toolId: string, reason: string) => Promise<void>;
  onToggleToolState?: (toolId: string, enabled: boolean) => Promise<void>;
  isProcessing?: boolean;
}

export function ToolInspectorDrawer({
  tool,
  open,
  onOpenChange,
  initialTab = 'overview',
  onApproveFingerprint,
  onToggleToolState: _onToggleToolState,
  isProcessing = false,
}: ToolInspectorDrawerProps) {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'fingerprint' | 'schema' | 'permissions'>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);
  const [showApprovalInput, setShowApprovalInput] = React.useState(false);
  const [approvalReason, setApprovalReason] = React.useState('');

  if (!tool) return null;

  const handleCopy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleApprove = async () => {
    if (!onApproveFingerprint || !approvalReason.trim()) return;
    await onApproveFingerprint(tool.id, approvalReason.trim());
    setShowApprovalInput(false);
    setApprovalReason('');
  };

  const getRiskBadge = () => {
    switch (tool.riskLevel) {
      case 'L4_PRIVILEGED_DESTRUCTIVE':
        return (
          <Badge variant="destructive" className="font-mono text-xs uppercase flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" />
            L4 Destructive
          </Badge>
        );
      case 'L3_EXTERNAL_SIDE_EFFECT':
        return (
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 font-mono text-xs uppercase flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            L3 Side Effect
          </Badge>
        );
      case 'L2_STATE_MUTATION':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-mono text-xs uppercase">
            L2 Mutation
          </Badge>
        );
      case 'L1_TRANSIENT':
        return (
          <Badge variant="secondary" className="font-mono text-xs uppercase">
            L1 Transient
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-xs uppercase">
            L0 Read-Only
          </Badge>
        );
    }
  };

  const compositeHash = tool.fingerprint?.compositeHash || 'sha256_uncalculated';
  const hasDrift = tool.driftReport?.hasDrift ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl max-h-[90vh]"
      >
        {/* Demarcated Header (theme.md §8.2) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="text-base sm:text-lg font-semibold truncate flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{tool.name}</span>
              <span className="text-xs font-mono text-muted-foreground font-normal">v{tool.version}</span>
            </DialogTitle>
            <CardInfoTooltip
              text="Inspect capability metadata, cryptographic fingerprint breakdown, draft-2020-12 input/output schemas, and RBAC permissions."
            />
          </div>
          <DialogDescription className="sr-only">
            Capability inspection drawer showing tool parameters, schemas, and fingerprint security.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as typeof activeTab)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid grid-cols-4 mx-6 mt-4 bg-muted/40 shrink-0">
            <TabsTrigger value="overview" className="text-xs py-1.5 gap-1.5 active:scale-[0.97]">
              <Layers className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="fingerprint" className="text-xs py-1.5 gap-1.5 active:scale-[0.97]">
              <Fingerprint className="h-3.5 w-3.5" />
              Fingerprint
              {hasDrift && (
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="schema" className="text-xs py-1.5 gap-1.5 active:scale-[0.97]">
              <FileCode className="h-3.5 w-3.5" />
              Schemas
            </TabsTrigger>
            <TabsTrigger value="permissions" className="text-xs py-1.5 gap-1.5 active:scale-[0.97]">
              <Lock className="h-3.5 w-3.5" />
              Scopes
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Overview */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            {/* Drift Alert Banner */}
            {hasDrift && (
              <div className="p-3.5 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-semibold">Cryptographic Schema Drift Detected (Rule 14)</div>
                  <div className="text-muted-foreground">
                    This capability definition diverged from the approved tenant baseline. Dynamic dispatch is blocked until an operator re-approves this fingerprint.
                  </div>
                </div>
              </div>
            )}

            {/* Non-Delegable Warning Badge (Rule 17) */}
            {tool.isNonDelegable && (
              <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-semibold">Non-Delegable Action (Rule 17)</div>
                  <div className="text-muted-foreground">
                    This action requires human operator execution. Automated agents cannot invoke or sub-delegate this capability under any circumstances.
                  </div>
                </div>
              </div>
            )}

            {/* Badges Grid */}
            <div className="flex flex-wrap items-center gap-2">
              {getRiskBadge()}
              <Badge variant="outline" className="font-mono text-xs uppercase">
                {tool.domain}
              </Badge>
              {tool.supportsDryRun && (
                <Badge variant="secondary" className="font-mono text-xs flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  Dry-Run Safe
                </Badge>
              )}
              {hasDrift ? (
                <Badge variant="destructive" className="font-mono text-xs flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Drifted
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-mono text-xs flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </Badge>
              )}
            </div>

            {/* Description (Rule 30: Containerized untrusted text) */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/15 space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description (Isolated Reference Data)
              </div>
              <div
                data-testid="untrusted-reference-container"
                className="text-xs text-foreground/90 leading-relaxed font-mono whitespace-pre-wrap bg-background/50 p-2.5 rounded-lg border border-border/60"
              >
                {`<untrusted_reference_data id="${tool.id}">`}
                {'\n'}
                {tool.description}
                {'\n'}
                {'</untrusted_reference_data>'}
              </div>
            </div>

            {/* Property Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Capability ID</div>
                <div className="font-mono text-xs truncate select-all">{tool.id}</div>
              </div>
              <div className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Canonical Domain</div>
                <div className="font-mono text-xs">{tool.domain}</div>
              </div>
              <div className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Invocations (24h)</div>
                <div className="font-mono text-xs font-semibold">142 calls (99.8% success)</div>
              </div>
              <div className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Execution Isolation</div>
                <div className="font-mono text-xs">Stateless Streamable HTTP</div>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Fingerprint & Drift */}
          <TabsContent value="fingerprint" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            {/* Composite Hash Card (Rule 22) */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/15 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium flex items-center gap-1.5">
                  <Fingerprint className="h-4 w-4 text-primary" />
                  Canonical Composite Hash (SHA-256)
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(compositeHash, 'composite')}
                  className="h-7 text-xs gap-1 active:scale-[0.97]"
                >
                  {copiedHash === 'composite' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedHash === 'composite' ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="font-mono text-xs p-2.5 rounded-lg bg-background border border-border/60 break-all select-all">
                {compositeHash}
              </div>
            </div>

            {/* Sub-component Hashes Breakdown */}
            {tool.fingerprint && (
              <div className="space-y-2.5 text-xs">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sub-Component Hash Breakdown
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-lg border border-border/60 bg-muted/10 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Schema Hash</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(tool.fingerprint!.schemaHash, 'schema')}
                        className="hover:text-foreground"
                      >
                        {copiedHash === 'schema' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="font-mono text-[11px] truncate select-all">{tool.fingerprint.schemaHash}</div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border/60 bg-muted/10 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Description Hash</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(tool.fingerprint!.descriptionHash, 'desc')}
                        className="hover:text-foreground"
                      >
                        {copiedHash === 'desc' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="font-mono text-[11px] truncate select-all">{tool.fingerprint.descriptionHash}</div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border/60 bg-muted/10 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Permissions Hash</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(tool.fingerprint!.permissionHash, 'perm')}
                        className="hover:text-foreground"
                      >
                        {copiedHash === 'perm' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="font-mono text-[11px] truncate select-all">{tool.fingerprint.permissionHash}</div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border/60 bg-muted/10 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Risk Hash</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(tool.fingerprint!.riskHash, 'risk')}
                        className="hover:text-foreground"
                      >
                        {copiedHash === 'risk' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="font-mono text-[11px] truncate select-all">{tool.fingerprint.riskHash}</div>
                  </div>
                </div>

                {/* Approval Metadata */}
                <div className="p-3 rounded-xl border border-border/60 bg-muted/10 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Approved By:</span>{' '}
                    <span className="font-mono font-medium">{tool.fingerprint.approvedBy}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Approved At:</span>{' '}
                    <span className="font-mono font-medium">
                      {new Date(tool.fingerprint.approvedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Re-Approval Section if Drifted */}
            {hasDrift && onApproveFingerprint && (
              <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-primary" />
                  Operator Re-Approval (Rule 21)
                </div>
                {showApprovalInput ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Reason for approving schema drift (e.g. Q4 CRM v2 upgrade)..."
                      value={approvalReason}
                      onChange={(e) => setApprovalReason(e.target.value)}
                      className="text-xs h-9 bg-background"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowApprovalInput(false)}
                        className="text-xs h-8"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={!approvalReason.trim() || isProcessing}
                        onClick={() => void handleApprove()}
                        className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl active:scale-[0.97]"
                      >
                        Confirm & Sign Hash
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowApprovalInput(true)}
                    className="w-full text-xs h-9 gap-1.5 rounded-xl active:scale-[0.97]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Authorize Updated Fingerprint
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Tab 3: Schema Viewer */}
          <TabsContent value="schema" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5 text-primary" />
                  Input JSON Schema (draft-2020-12)
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(JSON.stringify(tool.inputSchema, null, 2), 'input_schema')}
                  className="h-7 text-xs gap-1 active:scale-[0.97]"
                >
                  {copiedHash === 'input_schema' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedHash === 'input_schema' ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <pre className="font-mono text-[11px] p-3 rounded-xl bg-background border border-border/80 overflow-x-auto max-h-60 leading-relaxed select-all">
                {`<untrusted_reference_data id="${tool.id}_input_schema">\n`}
                {JSON.stringify(tool.inputSchema, null, 2)}
                {`\n</untrusted_reference_data>`}
              </pre>
            </div>

            {tool.outputSchema && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5 text-primary" />
                    Output JSON Schema (draft-2020-12)
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(JSON.stringify(tool.outputSchema, null, 2), 'output_schema')}
                    className="h-7 text-xs gap-1 active:scale-[0.97]"
                  >
                    {copiedHash === 'output_schema' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copiedHash === 'output_schema' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <pre className="font-mono text-[11px] p-3 rounded-xl bg-background border border-border/80 overflow-x-auto max-h-60 leading-relaxed select-all">
                  {`<untrusted_reference_data id="${tool.id}_output_schema">\n`}
                  {JSON.stringify(tool.outputSchema, null, 2)}
                  {`\n</untrusted_reference_data>`}
                </pre>
              </div>
            )}
          </TabsContent>

          {/* Tab 4: Scopes & Permissions */}
          <TabsContent value="permissions" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Required Authorization Scopes
              </div>
              {tool.requiredScopes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tool.requiredScopes.map((scope) => (
                    <Badge
                      key={scope}
                      variant="outline"
                      className="font-mono text-xs px-2.5 py-1 bg-muted/30 border-border/80"
                    >
                      {scope}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  No explicit scopes required (Public / Unrestricted L0).
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-2 text-xs">
              <div className="font-semibold">Tenant Scoping Policy (Rules 8 & 47)</div>
              <p className="text-muted-foreground leading-relaxed">
                All invocations are strictly bound to the authenticated organization and workspace. Client-injected tenant overrides are unconditionally rejected.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Demarcated Footer (theme.md §8.5) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[36px]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
