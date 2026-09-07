'use client';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Enterprise Governance, Retention & Audit Console
 *
 * Implements an enterprise governance dashboard providing an immutable compliance audit trail,
 * configurable GDPR/CCPA data retention policies, contact subject erasure tooling, and resource-level RBAC.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (RULE 10):
 * 1. Append-Only Audit Integrity: Audit records cannot be modified or deleted through the UI.
 * 2. Non-Destructive Purging: Retention purges only raw playback events (`media_page_events`).
 *    Attribution and deal velocity records are permanently preserved.
 * 3. Mobile Accessibility: Touch targets enforce `min-h-[44px] min-w-[44px]` with `active:scale-[0.97]`.
 * 4. Strict Typing: Zero `any`, `any[]`, or `unknown`.
 *
 * PRD & UX REFERENCES:
 * - PRD Sec 80 (Audit Log), Sec 156 (Retention Policy), Sec 132 (Phase 9 - Enterprise Platform).
 * - UX Sec 131-133 (Admin - Tracking, Permissions, Audit Log) & Screens 59-62.
 */

import React, { useState, useEffect, useTransition } from 'react';
import {
  Shield,
  History,
  Trash2,
  Download,
  Search,
  Filter,
  Eye,
  Lock,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Calendar,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  listMediaAuditLogsAction,
  exportMediaAuditLogsCsvAction,
} from '@/lib/media/audit-service';
import {
  getMediaRetentionPolicyAction,
  saveMediaRetentionPolicyAction,
  purgeExpiredMediaTelemetryAction,
  exportContactComplianceDataAction,
  eraseContactComplianceDataAction,
  DEFAULT_RETENTION_POLICY,
} from '@/lib/media/retention-service';
import {
  listResourcePermissionsAction,
  saveResourcePermissionAction,
  deleteResourcePermissionAction,
} from '@/lib/media/rbac-service';
import type {
  MediaAuditLog,
  MediaAuditResourceType,
  MediaRetentionPolicy,
  MediaResourcePermission,
  MediaResourceRole,
} from '@/lib/types/media-2.0';

export default function MediaGovernanceConsolePage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'audit' | 'retention' | 'rbac'>('audit');
  const [auditLogs, setAuditLogs] = useState<MediaAuditLog[]>([]);
  const [retentionPolicy, setRetentionPolicy] = useState<MediaRetentionPolicy>(DEFAULT_RETENTION_POLICY);
  const [permissions, setPermissions] = useState<MediaResourcePermission[]>([]);
  const [isPending, startTransition] = useTransition();

  // Audit Filters
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedResourceType, setSelectedResourceType] = useState<string>('ALL');
  const [selectedAuditLog, setSelectedAuditLog] = useState<MediaAuditLog | null>(null);

  // GDPR Tooling State
  const [gdprContactId, setGdprContactId] = useState('');
  const [isEraseModalOpen, setIsEraseModalOpen] = useState(false);
  const [eraseConfirmText, setEraseConfirmText] = useState('');

  // RBAC Modal State
  const [isAddPermissionOpen, setIsAddPermissionOpen] = useState(false);
  const [permResourceType, setPermResourceType] = useState<'EXPERIENCE' | 'PACKAGE' | 'COLLECTION' | 'ASSET'>('EXPERIENCE');
  const [permResourceId, setPermResourceId] = useState('');
  const [permPrincipalId, setPermPrincipalId] = useState('');
  const [permRole, setPermRole] = useState<MediaResourceRole>('VIEWER');

  // Load Initial Data
  const loadData = () => {
    if (!workspaceId) return;
    startTransition(async () => {
      const [auditRes, retRes, permRes] = await Promise.all([
        listMediaAuditLogsAction(workspaceId, { limitCount: 100 }),
        getMediaRetentionPolicyAction(workspaceId),
        listResourcePermissionsAction(workspaceId, 'workspace_default'),
      ]);

      if (auditRes.success && auditRes.logs) setAuditLogs(auditRes.logs);
      if (retRes.success && retRes.policy) setRetentionPolicy(retRes.policy);
      if (permRes.success && permRes.permissions) setPermissions(permRes.permissions);
    });
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  // Handle Export CSV
  const handleExportCsv = async () => {
    startTransition(async () => {
      const res = await exportMediaAuditLogsCsvAction(workspaceId);
      if (res.success && res.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `media_audit_trail_${workspaceId}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'Export Complete', description: 'Audit trail CSV downloaded.' });
      } else {
        toast({ title: 'Export Failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Handle Save Retention Policy
  const handleSaveRetention = async () => {
    startTransition(async () => {
      const res = await saveMediaRetentionPolicyAction(retentionPolicy);
      if (res.success) {
        toast({ title: 'Policy Updated', description: 'Retention horizons saved successfully.' });
        loadData();
      } else {
        toast({ title: 'Save Failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Handle Run Purge
  const handleRunPurge = async () => {
    if (!confirm('Run telemetry retention purge now? Raw events older than your configured horizon will be deleted.')) return;
    startTransition(async () => {
      const res = await purgeExpiredMediaTelemetryAction(workspaceId);
      if (res.success) {
        toast({
          title: 'Retention Purge Complete',
          description: `Purged ${res.purgedCount} expired raw telemetry events.`,
        });
        loadData();
      } else {
        toast({ title: 'Purge Failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Handle GDPR Export
  const handleGdprExport = async () => {
    if (!gdprContactId.trim()) return;
    startTransition(async () => {
      const res = await exportContactComplianceDataAction(workspaceId, gdprContactId.trim());
      if (res.success && res.dataBundle) {
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(res.dataBundle, null, 2))}`;
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', jsonString);
        downloadAnchor.setAttribute('download', `gdpr_export_${gdprContactId.trim()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        toast({ title: 'GDPR Export Ready', description: 'Subject data archive downloaded.' });
      } else {
        toast({ title: 'Export Failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Handle GDPR Erasure
  const handleGdprErasure = async () => {
    if (eraseConfirmText !== 'DELETE') return;
    startTransition(async () => {
      const res = await eraseContactComplianceDataAction(workspaceId, gdprContactId.trim());
      if (res.success) {
        toast({
          title: 'Contact Erased',
          description: `Anonymized ${res.anonymizedSessionsCount} sessions and erased profile.`,
        });
        setIsEraseModalOpen(false);
        setGdprContactId('');
        setEraseConfirmText('');
        loadData();
      } else {
        toast({ title: 'Erasure Failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Handle Grant Permission
  const handleGrantPermission = async () => {
    if (!permResourceId.trim() || !permPrincipalId.trim()) return;
    startTransition(async () => {
      const res = await saveResourcePermissionAction({
        workspaceId,
        resourceType: permResourceType,
        resourceId: permResourceId.trim(),
        principalType: 'USER',
        principalId: permPrincipalId.trim(),
        role: permRole,
        grantedBy: 'admin',
      });

      if (res.success) {
        toast({ title: 'Permission Granted', description: `Role ${permRole} assigned to ${permPrincipalId}.` });
        setIsAddPermissionOpen(false);
        setPermResourceId('');
        setPermPrincipalId('');
        loadData();
      } else {
        toast({ title: 'Grant Failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesSearch =
      auditSearch === '' ||
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.resourceTitle.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.actorEmail.toLowerCase().includes(auditSearch.toLowerCase());

    const matchesType = selectedResourceType === 'ALL' || log.resourceType === selectedResourceType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Enterprise Governance & Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure telemetry retention horizons, inspect immutable compliance logs, and govern resource permissions.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="rounded-xl font-bold text-xs min-h-[44px] gap-2 active:scale-[0.97]"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export CSV
          </Button>

          <Button
            onClick={handleRunPurge}
            variant="default"
            className="rounded-xl font-bold text-xs min-h-[44px] gap-2 active:scale-[0.97]"
          >
            <RefreshCw className="h-4 w-4" /> Run Purge Now
          </Button>
        </div>
      </div>

      {/* Hero KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Audit Log Entries</p>
              <h3 className="text-2xl font-black text-foreground mt-1">{auditLogs.length}</h3>
              <p className="text-[11px] text-emerald-500 font-semibold mt-0.5">Append-Only</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <History className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Raw Events Retention</p>
              <h3 className="text-2xl font-black text-foreground mt-1">{retentionPolicy.rawEventsRetentionDays}d</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Non-destructive purge</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">IP Anonymization</p>
              <h3 className="text-2xl font-black text-foreground mt-1">
                {retentionPolicy.anonymizeIpImmediately ? 'Active' : 'Off'}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">GDPR/CCPA Compliance</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Lock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Resource Permissions</p>
              <h3 className="text-2xl font-black text-foreground mt-1">{permissions.length}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Granular ACLs</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="w-full">
        <TabsList className="bg-muted/60 p-1 rounded-2xl w-full sm:w-auto grid grid-cols-3 min-h-[44px]">
          <TabsTrigger value="audit" className="rounded-xl font-bold text-xs min-h-[36px] gap-1.5 active:scale-[0.97]">
            <History className="h-3.5 w-3.5" /> Audit Trail
          </TabsTrigger>
          <TabsTrigger value="retention" className="rounded-xl font-bold text-xs min-h-[36px] gap-1.5 active:scale-[0.97]">
            <Calendar className="h-3.5 w-3.5" /> Retention & GDPR
          </TabsTrigger>
          <TabsTrigger value="rbac" className="rounded-xl font-bold text-xs min-h-[36px] gap-1.5 active:scale-[0.97]">
            <Lock className="h-3.5 w-3.5" /> Resource RBAC
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Audit Trail */}
        <TabsContent value="audit" className="space-y-4 mt-4">
          <Card className="rounded-2xl border-border">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">Immutable Compliance Audit Log</CardTitle>
                <CardDescription className="text-xs">
                  Cryptographic log of all asset changes, access grants, policy overrides, and key events.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="pl-8 h-9 text-xs rounded-xl min-h-[36px]"
                  />
                </div>

                <Select value={selectedResourceType} onValueChange={setSelectedResourceType}>
                  <SelectTrigger className="w-32 h-9 text-xs rounded-xl min-h-[36px] font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectItem value="ASSET">Assets</SelectItem>
                    <SelectItem value="EXPERIENCE">Experiences</SelectItem>
                    <SelectItem value="API_KEY">API Keys</SelectItem>
                    <SelectItem value="WEBHOOK">Webhooks</SelectItem>
                    <SelectItem value="RETENTION">Retention</SelectItem>
                    <SelectItem value="GOVERNANCE">Governance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredAuditLogs.length === 0 ? (
                <div className="p-8 text-center">
                  <History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-foreground">No Audit Records Found</p>
                  <p className="text-xs text-muted-foreground mt-1">Audit events are recorded automatically upon mutation.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredAuditLogs.map((log) => (
                    <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{log.action}</span>
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {log.resourceType}
                          </Badge>
                          <span className="text-xs font-semibold text-muted-foreground">{log.resourceTitle}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>Actor: {log.actorName} ({log.actorEmail})</span>
                          <span>•</span>
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                          {log.reason && <span>• Reason: {log.reason}</span>}
                        </div>
                      </div>

                      {(log.beforeState || log.afterState) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedAuditLog(log)}
                          className="rounded-xl text-xs font-bold min-h-[44px] gap-1 self-start sm:self-auto active:scale-[0.97]"
                        >
                          <Eye className="h-3.5 w-3.5" /> Inspect Diff
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Retention & GDPR */}
        <TabsContent value="retention" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Retention Horizon Form */}
            <Card className="rounded-2xl border-border">
              <CardHeader>
                <CardTitle className="text-base font-bold">Telemetry Retention Horizons</CardTitle>
                <CardDescription className="text-xs">
                  Set expiration horizons for granular viewer telemetry to ensure regulatory compliance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold">Raw Playback Events Retention</Label>
                  <Select
                    value={String(retentionPolicy.rawEventsRetentionDays)}
                    onValueChange={(val) => setRetentionPolicy({ ...retentionPolicy, rawEventsRetentionDays: parseInt(val, 10) })}
                  >
                    <SelectTrigger className="rounded-xl min-h-[44px] mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="30">30 Days</SelectItem>
                      <SelectItem value="60">60 Days</SelectItem>
                      <SelectItem value="90">90 Days (Recommended)</SelectItem>
                      <SelectItem value="180">180 Days (6 Months)</SelectItem>
                      <SelectItem value="365">365 Days (1 Year)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Raw progress pings older than this cutoff will be purged. Aggregated attribution reports are preserved.
                  </p>
                </div>

                <div className="pt-2 border-t border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold">Anonymize IP Addresses Immediately</Label>
                      <p className="text-[11px] text-muted-foreground">Replaces IP addresses with one-way SHA-256 hashes.</p>
                    </div>
                    <Switch
                      checked={retentionPolicy.anonymizeIpImmediately}
                      onCheckedChange={(val) => setRetentionPolicy({ ...retentionPolicy, anonymizeIpImmediately: val })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold">Mask Geolocation Details</Label>
                      <p className="text-[11px] text-muted-foreground">Truncates viewer city/suburb, recording country only.</p>
                    </div>
                    <Switch
                      checked={retentionPolicy.maskGeolocation}
                      onCheckedChange={(val) => setRetentionPolicy({ ...retentionPolicy, maskGeolocation: val })}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSaveRetention}
                  className="w-full rounded-xl font-bold text-xs min-h-[44px] mt-2 active:scale-[0.97]"
                >
                  Save Retention Policy
                </Button>
              </CardContent>
            </Card>

            {/* GDPR Subject Rights Toolbox */}
            <Card className="rounded-2xl border-border">
              <CardHeader>
                <CardTitle className="text-base font-bold">GDPR / CCPA Subject Rights Toolbox</CardTitle>
                <CardDescription className="text-xs">
                  Fulfill Article 15 (Data Portability) and Article 17 (Right to Erasure) requests.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold">CRM Contact ID / Email</Label>
                  <Input
                    placeholder="contact_123 or prospect@company.com"
                    value={gdprContactId}
                    onChange={(e) => setGdprContactId(e.target.value)}
                    className="rounded-xl min-h-[44px] mt-1"
                  />
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    onClick={handleGdprExport}
                    disabled={!gdprContactId.trim()}
                    variant="outline"
                    className="w-full rounded-xl font-bold text-xs min-h-[44px] gap-2 active:scale-[0.97]"
                  >
                    <Download className="h-4 w-4" /> Export Media Profile & Sessions (Art. 15)
                  </Button>

                  <Button
                    onClick={() => setIsEraseModalOpen(true)}
                    disabled={!gdprContactId.trim()}
                    variant="outline"
                    className="w-full rounded-xl font-bold text-xs min-h-[44px] gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 active:scale-[0.97]"
                  >
                    <Trash2 className="h-4 w-4" /> Erase & Anonymize Contact Data (Art. 17)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Resource RBAC */}
        <TabsContent value="rbac" className="space-y-4 mt-4">
          <Card className="rounded-2xl border-border">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">Resource-Level Access Controls (ACL)</CardTitle>
                <CardDescription className="text-xs">
                  Grant granular capabilities (Viewer, Contributor, Editor, Publisher, Admin) on specific media items.
                </CardDescription>
              </div>

              <Button
                onClick={() => setIsAddPermissionOpen(true)}
                className="rounded-xl font-bold text-xs min-h-[44px] gap-2 active:scale-[0.97]"
              >
                <Lock className="h-4 w-4" /> Grant Resource Permission
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {permissions.length === 0 ? (
                <div className="p-8 text-center">
                  <Lock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-foreground">No Explicit Resource ACLs</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    All workspace members inherit default role access. Grant explicit overrides for sensitive media assets.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {permissions.map((perm) => (
                    <div key={perm.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{perm.principalId}</span>
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {perm.resourceType}
                          </Badge>
                          <Badge variant="default" className="text-[10px] font-bold">
                            {perm.role}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Resource ID: {perm.resourceId}</p>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteResourcePermissionAction(perm.id, workspaceId).then(loadData)}
                        className="rounded-xl text-rose-500 hover:text-rose-600 min-h-[44px] min-w-[44px] p-0 active:scale-[0.97]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diff Inspector Modal */}
      <Dialog open={!!selectedAuditLog} onOpenChange={() => setSelectedAuditLog(null)}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Audit State Diff</DialogTitle>
            <DialogDescription className="text-xs">
              Comparing pre-mutation and post-mutation states for {selectedAuditLog?.resourceTitle}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 overflow-y-auto pr-1 py-2">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">State Before</Label>
              <pre className="p-3 bg-muted rounded-xl font-mono text-[11px] max-h-64 overflow-y-auto text-foreground border border-border">
                {JSON.stringify(selectedAuditLog?.beforeState || { status: 'None' }, null, 2)}
              </pre>
            </div>

            <div>
              <Label className="text-xs font-semibold text-emerald-500 mb-1 block">State After</Label>
              <pre className="p-3 bg-muted rounded-xl font-mono text-[11px] max-h-64 overflow-y-auto text-foreground border border-border">
                {JSON.stringify(selectedAuditLog?.afterState || { status: 'Updated' }, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* GDPR Erasure Modal */}
      <Dialog open={isEraseModalOpen} onOpenChange={setIsEraseModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confirm Contact Erasure
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will permanently delete the media profile and anonymize all viewing sessions for{' '}
              <strong>{gdprContactId}</strong>. Type <strong>DELETE</strong> below to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Input
              placeholder="Type DELETE to confirm"
              value={eraseConfirmText}
              onChange={(e) => setEraseConfirmText(e.target.value)}
              className="rounded-xl min-h-[44px]"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEraseModalOpen(false)} className="rounded-xl font-bold min-h-[44px]">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleGdprErasure}
              disabled={eraseConfirmText !== 'DELETE'}
              className="rounded-xl font-bold min-h-[44px]"
            >
              Permanently Erase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Permission Modal */}
      <Dialog open={isAddPermissionOpen} onOpenChange={setIsAddPermissionOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Grant Resource Permission</DialogTitle>
            <DialogDescription className="text-xs">
              Assign explicit roles to a user on a collection, package, experience, or asset.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Resource Type</Label>
              <Select value={permResourceType} onValueChange={(val) => setPermResourceType(val as typeof permResourceType)}>
                <SelectTrigger className="rounded-xl min-h-[44px] mt-1 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="EXPERIENCE">Experience</SelectItem>
                  <SelectItem value="PACKAGE">Package</SelectItem>
                  <SelectItem value="COLLECTION">Collection</SelectItem>
                  <SelectItem value="ASSET">Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Resource ID</Label>
              <Input
                placeholder="e.g. exp_123 or asset_456"
                value={permResourceId}
                onChange={(e) => setPermResourceId(e.target.value)}
                className="rounded-xl min-h-[44px] mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">User / Principal ID</Label>
              <Input
                placeholder="user_abc or member email"
                value={permPrincipalId}
                onChange={(e) => setPermPrincipalId(e.target.value)}
                className="rounded-xl min-h-[44px] mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Role</Label>
              <Select value={permRole} onValueChange={(val) => setPermRole(val as MediaResourceRole)}>
                <SelectTrigger className="rounded-xl min-h-[44px] mt-1 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="VIEWER">Viewer (Read Only)</SelectItem>
                  <SelectItem value="CONTRIBUTOR">Contributor (Upload Only)</SelectItem>
                  <SelectItem value="EDITOR">Editor (Edit & Version)</SelectItem>
                  <SelectItem value="PUBLISHER">Publisher (Publish & Gate)</SelectItem>
                  <SelectItem value="ANALYST">Analyst (View Metrics)</SelectItem>
                  <SelectItem value="ADMIN">Admin (Full Control)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPermissionOpen(false)} className="rounded-xl font-bold min-h-[44px]">
              Cancel
            </Button>
            <Button onClick={handleGrantPermission} disabled={!permResourceId.trim() || !permPrincipalId.trim()} className="rounded-xl font-bold min-h-[44px]">
              Save Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
