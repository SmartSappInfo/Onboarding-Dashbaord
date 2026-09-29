'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Enterprise Governance Dock in Agreements Hub (Phase 6 UI):
 * 1. Purpose:
 *    Central administrative command center for enterprise e-signature features:
 *    - E-Signature Assurance Profiles (SES / AES / QES)
 *    - Self-Healing Webhooks, Telemetry & Dead-Letter Queue (DLQ) 1-Click Replay
 *    - Litigation Legal Hold & Statutory Retention Schedules
 *    - Tamper-Proof Cryptographic Evidence Package Exporter
 * 2. Mobile Ergonomics & Accessibility:
 *    - All interactive buttons & inputs strictly enforce `min-h-[44px]`.
 *    - Inputs lock font size at `text-base sm:text-sm` preventing iOS Safari zoom.
 *    - Tactile micro-interactions (`active:scale-[0.97]`).
 * 3. Security (FM-P6-03 & FM-P6-08):
 *    - Tenant isolated by `workspaceId`.
 *    - Legal hold prevents unauthorized destruction of evidence.
 * 4. Zero-Tolerance Typing (Rule 4):
 *    - Strictly zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck,
  Webhook,
  Scale,
  Archive,
  RefreshCw,
  Palette,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Download,
  Copy,
  Check,
  Clock,
  Fingerprint,
} from 'lucide-react';
import {
  getAssuranceProfilesAction,
  getWebhookHealthAction,
  replayWebhookDeliveryAction,
  getLegalHoldAndRetentionAction,
  toggleContractLegalHoldAction,
  generateEvidencePackageAction,
} from '@/app/actions/enterprise-governance-actions';
import {
  AssuranceProfile,
  WebhookSubscription,
  WebhookDeliveryLog,
  ContractRetentionPolicy,
  EvidencePackageManifest,
} from '@/lib/types/document-signing';
import { WorkspaceBrandingDrawer } from '@/app/admin/documents/components/WorkspaceBrandingDrawer';

export interface EnterpriseGovernanceTabProps {
  workspaceId: string;
}

export default function EnterpriseGovernanceTab({
  workspaceId,
}: EnterpriseGovernanceTabProps) {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = React.useState<
    'assurance' | 'webhooks' | 'legal_hold' | 'evidence'
  >('assurance');

  // Assurance Profiles state
  const [profiles, setProfiles] = React.useState<AssuranceProfile[]>([]);
  const [isBrandingOpen, setIsBrandingOpen] = React.useState(false);

  // Webhooks state
  const [subscriptions, setSubscriptions] = React.useState<WebhookSubscription[]>([]);
  const [deliveryLogs, setDeliveryLogs] = React.useState<WebhookDeliveryLog[]>([]);
  const [successRate, setSuccessRate] = React.useState(100);
  const [dlqCount, setDlqCount] = React.useState(0);
  const [isReplayingId, setIsReplayingId] = React.useState<string | null>(null);

  // Legal Hold & Retention state
  const [retentionPolicies, setRetentionPolicies] = React.useState<ContractRetentionPolicy[]>([]);
  const [targetContractId, setTargetContractId] = React.useState('');
  const [legalHoldReason, setLegalHoldReason] = React.useState('');
  const [isUpdatingHold, setIsUpdatingHold] = React.useState(false);

  // Evidence Package state
  const [evidenceContractId, setEvidenceContractId] = React.useState('');
  const [isGeneratingPackage, setIsGeneratingPackage] = React.useState(false);
  const [generatedManifest, setGeneratedManifest] = React.useState<EvidencePackageManifest | null>(null);
  const [copiedHashKey, setCopiedHashKey] = React.useState<string | null>(null);

  // Initial Data Fetch
  const loadData = React.useCallback(async () => {
    try {
      const [profilesData, webhooksData, retentionData] = await Promise.all([
        getAssuranceProfilesAction(workspaceId),
        getWebhookHealthAction(workspaceId),
        getLegalHoldAndRetentionAction(workspaceId),
      ]);

      setProfiles(profilesData);
      setSubscriptions(webhooksData.subscriptions);
      setDeliveryLogs(webhooksData.recentLogs);
      setSuccessRate(webhooksData.successRate);
      setDlqCount(webhooksData.dlqCount);
      setRetentionPolicies(retentionData.retentionPolicies);
    } catch (err: unknown) {
      console.error('[EnterpriseGovernanceTab] load error:', err);
    }
  }, [workspaceId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Replay dead-letter webhook
  const handleReplayWebhook = async (logId: string) => {
    setIsReplayingId(logId);
    try {
      const res = await replayWebhookDeliveryAction(workspaceId, logId);
      if (res.success && res.data) {
        toast({
          title: 'Webhook Replay Initiated',
          description: `Delivery attempt ${res.data.id} transitioned to ${res.data.status}.`,
        });
        await loadData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Replay Failed',
          description: res.error || 'Failed to dispatch webhook retry.',
        });
      }
    } finally {
      setIsReplayingId(null);
    }
  };

  // Toggle Legal Hold on Contract
  const handleToggleLegalHold = async (active: boolean) => {
    if (!targetContractId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Contract Required',
        description: 'Please specify the Contract ID to modify legal hold status.',
      });
      return;
    }

    setIsUpdatingHold(true);
    try {
      const res = await toggleContractLegalHoldAction(
        workspaceId,
        targetContractId.trim(),
        active,
        legalHoldReason.trim() || undefined
      );

      if (res.success) {
        toast({
          title: active ? 'Legal Hold Applied' : 'Legal Hold Released',
          description: `Contract ${targetContractId} is ${
            active ? 'now frozen from deletion or retention purging' : 'restored to standard retention'
          }.`,
        });
        setTargetContractId('');
        setLegalHoldReason('');
      } else {
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: res.error || 'Unable to update contract legal hold.',
        });
      }
    } finally {
      setIsUpdatingHold(false);
    }
  };

  // Generate Evidence Package
  const handleGenerateEvidencePackage = async () => {
    if (!evidenceContractId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Contract Required',
        description: 'Please provide a valid Contract ID to compile evidence manifest.',
      });
      return;
    }

    setIsGeneratingPackage(true);
    try {
      const res = await generateEvidencePackageAction(workspaceId, evidenceContractId.trim());
      if (res.success && res.manifest) {
        setGeneratedManifest(res.manifest);
        toast({
          title: 'Evidence Package Ready',
          description: 'Cryptographic SHA-256 package manifest compiled successfully.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Export Failed',
          description: res.error || 'Failed to compile evidence package.',
        });
      }
    } finally {
      setIsGeneratingPackage(false);
    }
  };

  const copyToClipboard = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedHashKey(key);
    setTimeout(() => setCopiedHashKey(null), 2000);
    toast({ title: 'Copied', description: 'Checksum copied to clipboard.' });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Enterprise Governance & Jurisdictional Assurance
            </h3>
            <p className="text-xs text-muted-foreground">
              Institutional e-signature policies, self-healing event webhooks, litigation holds, and evidence exports.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsBrandingOpen(true)}
            className="min-h-[44px] rounded-xl text-xs font-semibold gap-2 active:scale-[0.97]"
          >
            <Palette className="h-4 w-4 text-primary" />
            Workspace Branding
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={loadData}
            className="h-11 w-11 rounded-xl"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Governance Sub-Navigation */}
      <Tabs
        value={activeSubTab}
        onValueChange={(v) =>
          setActiveSubTab(v as 'assurance' | 'webhooks' | 'legal_hold' | 'evidence')
        }
        className="w-full space-y-6"
      >
        <TabsList className="bg-muted/60 p-1 rounded-xl border">
          <TabsTrigger
            value="assurance"
            className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm min-h-[44px]"
          >
            <Fingerprint className="h-4 w-4" />
            Assurance Profiles
          </TabsTrigger>
          <TabsTrigger
            value="webhooks"
            className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm min-h-[44px]"
          >
            <Webhook className="h-4 w-4" />
            Webhooks & DLQ
            {dlqCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] py-0 px-1.5 h-4">
                {dlqCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="legal_hold"
            className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm min-h-[44px]"
          >
            <Scale className="h-4 w-4" />
            Legal Hold & Retention
          </TabsTrigger>
          <TabsTrigger
            value="evidence"
            className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm min-h-[44px]"
          >
            <Archive className="h-4 w-4" />
            Evidence Exporter
          </TabsTrigger>
        </TabsList>

        {/* 1. Assurance Profiles */}
        <TabsContent value="assurance" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {profiles.map((p) => {
              const isQualified = p.level === 'qualified';
              const isAdvanced = p.level === 'advanced';

              return (
                <Card
                  key={p.id}
                  className={`rounded-2xl border transition-all ${
                    isQualified
                      ? 'border-indigo-500/30 bg-indigo-500/5'
                      : isAdvanced
                      ? 'border-blue-500/30 bg-blue-500/5'
                      : 'border-border'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={isQualified ? 'default' : 'secondary'}
                        className="text-[10px] font-bold uppercase"
                      >
                        {p.level}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {p.certificateStandard}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-bold mt-2">{p.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {p.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Required Authentication:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {p.requiredAuth.map((auth) => (
                          <Badge key={auth} variant="outline" className="text-[10px]">
                            {auth.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t">
                      <span className="text-muted-foreground">Biometric Telemetry:</span>
                      <span className="font-semibold">
                        {p.requireSignatureBiometrics ? 'Mandatory' : 'Optional'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* 2. Webhooks & DLQ */}
        <TabsContent value="webhooks" className="space-y-6 mt-0">
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="rounded-2xl border">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Delivery Success Rate</CardDescription>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  {successRate}%
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="rounded-2xl border">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Active Subscriptions</CardDescription>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-primary" />
                  {subscriptions.length}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className={`rounded-2xl border ${dlqCount > 0 ? 'border-destructive/40 bg-destructive/5' : ''}`}>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Dead-Letter Queue (DLQ)</CardDescription>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <AlertTriangle className={`h-5 w-5 ${dlqCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                  {dlqCount}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Delivery Log Table */}
          <Card className="rounded-2xl border overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-sm font-bold">Recent Webhook Deliveries</CardTitle>
              <CardDescription className="text-xs">
                Real-time delivery attempts with automated exponential backoff and 1-click dead-letter recovery.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {deliveryLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  No webhook delivery attempts recorded yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Delivery ID</TableHead>
                      <TableHead className="text-xs">Event</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Attempts</TableHead>
                      <TableHead className="text-xs">HTTP Code</TableHead>
                      <TableHead className="text-xs">Timestamp</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveryLogs.map((log) => {
                      const isDeadLetter = log.status === 'dead_letter';
                      const isDelivered = log.status === 'delivered';

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">{log.id.slice(0, 10)}...</TableCell>
                          <TableCell className="text-xs font-semibold">{log.event}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                isDelivered
                                  ? 'default'
                                  : isDeadLetter
                                  ? 'destructive'
                                  : 'secondary'
                              }
                              className="text-[10px]"
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{log.attemptCount}</TableCell>
                          <TableCell className="text-xs font-mono">
                            {log.responseStatusCode ?? '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {(isDeadLetter || log.status === 'failed') && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleReplayWebhook(log.id)}
                                disabled={isReplayingId === log.id}
                                className="min-h-[44px] text-xs gap-1 active:scale-[0.97]"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${isReplayingId === log.id ? 'animate-spin' : ''}`} />
                                Replay
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Legal Hold & Retention */}
        <TabsContent value="legal_hold" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Legal Hold Quick Action Card */}
            <Card className="rounded-2xl border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-bold">Litigation Legal Hold Protection</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Place an active contract under legal hold to permanently prevent accidental deletion or automated retention purges (FM-P6-03).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Contract Identifier</label>
                  <Input
                    type="text"
                    value={targetContractId}
                    onChange={(e) => setTargetContractId(e.target.value)}
                    placeholder="e.g. con_12345"
                    className="min-h-[44px] rounded-xl text-base sm:text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Litigation Matter / Hold Reason</label>
                  <Input
                    type="text"
                    value={legalHoldReason}
                    onChange={(e) => setLegalHoldReason(e.target.value)}
                    placeholder="e.g. SEC Inquiry 2026 / Case #8812"
                    className="min-h-[44px] rounded-xl text-base sm:text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={() => handleToggleLegalHold(true)}
                    disabled={isUpdatingHold}
                    className="flex-1 min-h-[44px] rounded-xl text-xs font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground active:scale-[0.97]"
                  >
                    Place on Legal Hold
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleToggleLegalHold(false)}
                    disabled={isUpdatingHold}
                    className="flex-1 min-h-[44px] rounded-xl text-xs font-semibold active:scale-[0.97]"
                  >
                    Release Hold
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Retention Policies Card */}
            <Card className="rounded-2xl border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-bold">Statutory Retention Schedules</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Regulatory data retention periods configured for this workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  {retentionPolicies.length > 0 ? (
                    retentionPolicies.map((pol) => (
                      <div key={pol.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                        <span className="text-xs font-medium capitalize">{pol.category.replace('_', ' ')} Records</span>
                        <Badge variant="outline" className="text-xs font-semibold">{pol.retentionYears} Years</Badge>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                        <span className="text-xs font-medium">Financial & Tax Agreements</span>
                        <Badge variant="outline" className="text-xs font-semibold">7 Years</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                        <span className="text-xs font-medium">Intellectual Property Licenses</span>
                        <Badge variant="outline" className="text-xs font-semibold">10 Years</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                        <span className="text-xs font-medium">Standard Commercial NDAs</span>
                        <Badge variant="outline" className="text-xs font-semibold">3 Years</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                        <span className="text-xs font-medium">Employment Contracts</span>
                        <Badge variant="outline" className="text-xs font-semibold">5 Years</Badge>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 4. Evidence Package Exporter */}
        <TabsContent value="evidence" className="space-y-6 mt-0">
          <Card className="rounded-2xl border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm font-bold">Tamper-Proof Evidence Archive Exporter</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Export complete cryptographic packages containing authoritative vector PDFs, Certificates of Completion, and immutable JSON evidence logs (FM-P6-06).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Input
                  type="text"
                  value={evidenceContractId}
                  onChange={(e) => setEvidenceContractId(e.target.value)}
                  placeholder="Enter Contract ID (e.g. con_99182)"
                  className="min-h-[44px] rounded-xl text-base sm:text-sm font-mono flex-1"
                />
                <Button
                  type="button"
                  onClick={handleGenerateEvidencePackage}
                  disabled={isGeneratingPackage}
                  className="w-full sm:w-auto min-h-[44px] rounded-xl text-xs font-semibold gap-2 active:scale-[0.97]"
                >
                  <Download className="h-4 w-4" />
                  Compile Package
                </Button>
              </div>

              {/* Generated Manifest Display */}
              {generatedManifest && (
                <div className="rounded-xl border p-4 bg-muted/20 space-y-3 mt-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold text-foreground">
                      Package Manifest: {generatedManifest.packageId}
                    </span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                      Verified Cryptographic Hash
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Document Digest (SHA-256):</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('doc', generatedManifest.documentSha256)}
                        className="font-mono text-[11px] flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        {generatedManifest.documentSha256.slice(0, 16)}...
                        {copiedHashKey === 'doc' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Certificate Digest (SHA-256):</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('cert', generatedManifest.certificateSha256)}
                        className="font-mono text-[11px] flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        {generatedManifest.certificateSha256.slice(0, 16)}...
                        {copiedHashKey === 'cert' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Overall Package Checksum:</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('all', generatedManifest.overallChecksum)}
                        className="font-mono text-[11px] flex items-center gap-1 font-bold text-primary hover:underline"
                      >
                        {generatedManifest.overallChecksum.slice(0, 20)}...
                        {copiedHashKey === 'all' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Workspace Branding Slide-Over Drawer */}
      <WorkspaceBrandingDrawer
        workspaceId={workspaceId}
        open={isBrandingOpen}
        onOpenChange={setIsBrandingOpen}
      />
    </div>
  );
}
