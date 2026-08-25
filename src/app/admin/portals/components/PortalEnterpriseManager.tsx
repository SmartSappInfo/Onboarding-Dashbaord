'use client';

/**
 * {{Org_name}} Experience Platform — Admin Enterprise Studio Manager
 *
 * Dedicated studio tab inside Portal Studio for Enterprise SSO,
 * Custom White-Labeling, System Terminology Dictionaries, Organization
 * Hierarchy Trees, and Compliance Audit Logging.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  getEnterpriseSsoAction,
  saveEnterpriseSsoAction,
  getWhiteLabelConfigAction,
  saveWhiteLabelConfigAction,
  listHierarchyNodesAction,
  createHierarchyNodeAction,
  listEnterpriseAuditLogsAction,
} from '@/app/actions/enterprise-actions';
import type {
  EnterpriseSsoConfig,
  EnterpriseWhiteLabelConfig,
  OrgHierarchyNode,
  EnterpriseAuditLog,
  SsoProvider,
  HierarchyNodeType,
} from '@/lib/types/enterprise';
import {
  Building2,
  Globe,
  Key,
  Network,
  ShieldAlert,
  Save,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Languages,
  Layers,
  Sparkles,
  Lock,
} from 'lucide-react';

interface PortalEnterpriseManagerProps {
  portalId: string;
  portalSlug: string;
  organizationId: string;
  workspaceIds?: string[];
}

export function PortalEnterpriseManager({
  portalId,
  portalSlug,
  organizationId,
}: PortalEnterpriseManagerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState('whitelabel');

  // White-Label State
  const [customDomain, setCustomDomain] = React.useState('');
  const [cnameTarget, setCnameTarget] = React.useState('cname.smartsapp.com');
  const [customLoginHeadline, setCustomLoginHeadline] = React.useState('');
  const [customSenderEmail, setCustomSenderEmail] = React.useState('');
  const [termCourse, setTermCourse] = React.useState('Course');
  const [termCourses, setTermCourses] = React.useState('Courses');
  const [termInstructor, setTermInstructor] = React.useState('Instructor');
  const [termStudent, setTermStudent] = React.useState('Student');
  const [isSavingWhiteLabel, setIsSavingWhiteLabel] = React.useState(false);

  // SSO State
  const [ssoProvider, setSsoProvider] = React.useState<SsoProvider>('saml');
  const [ssoDomain, setSsoDomain] = React.useState('');
  const [issuerUrl, setIssuerUrl] = React.useState('');
  const [ssoLoginUrl, setSsoLoginUrl] = React.useState('');
  const [enforceSsoOnly, setEnforceSsoOnly] = React.useState(false);
  const [isSavingSso, setIsSavingSso] = React.useState(false);

  // Hierarchy State
  const [nodes, setNodes] = React.useState<OrgHierarchyNode[]>([]);
  const [isCreateNodeOpen, setIsCreateNodeOpen] = React.useState(false);
  const [newNodeName, setNewNodeName] = React.useState('');
  const [newNodeType, setNewNodeType] = React.useState<HierarchyNodeType>('department');
  const [newNodeLead, setNewNodeLead] = React.useState('');
  const [isSavingNode, setIsSavingNode] = React.useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = React.useState<EnterpriseAuditLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // ── Load Data ──────────────────────────────────────────────────────────────

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [wlRes, ssoRes, nodesRes, logsRes] = await Promise.all([
        getWhiteLabelConfigAction(portalId),
        getEnterpriseSsoAction(portalId),
        listHierarchyNodesAction(organizationId),
        listEnterpriseAuditLogsAction(organizationId),
      ]);

      if (wlRes.success && wlRes.data) {
        setCustomDomain(wlRes.data.customDomain || '');
        setCnameTarget(wlRes.data.cnameTarget || 'cname.smartsapp.com');
        setCustomLoginHeadline(wlRes.data.customLoginHeadline || '');
        setCustomSenderEmail(wlRes.data.customSenderEmail || '');
        if (wlRes.data.systemTerminology) {
          setTermCourse(wlRes.data.systemTerminology.course || 'Course');
          setTermCourses(wlRes.data.systemTerminology.courses || 'Courses');
          setTermInstructor(wlRes.data.systemTerminology.instructor || 'Instructor');
          setTermStudent(wlRes.data.systemTerminology.student || 'Student');
        }
      }

      if (ssoRes.success && ssoRes.data) {
        setSsoProvider(ssoRes.data.provider);
        setSsoDomain(ssoRes.data.domain);
        setIssuerUrl(ssoRes.data.issuerUrl);
        setSsoLoginUrl(ssoRes.data.ssoLoginUrl);
        setEnforceSsoOnly(ssoRes.data.enforceSsoOnly);
      }

      if (nodesRes.success && nodesRes.data) setNodes(nodesRes.data);
      if (logsRes.success && logsRes.data) setAuditLogs(logsRes.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load enterprise settings.';
      toast({ title: 'Load Failed', description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [portalId, organizationId, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveWhiteLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWhiteLabel(true);
    try {
      const res = await saveWhiteLabelConfigAction(
        {
          organizationId,
          portalId,
          customDomain: customDomain.trim(),
          cnameTarget: cnameTarget.trim(),
          customLoginHeadline: customLoginHeadline.trim(),
          customSenderEmail: customSenderEmail.trim(),
          systemTerminology: {
            course: termCourse.trim(),
            courses: termCourses.trim(),
            instructor: termInstructor.trim(),
            student: termStudent.trim(),
          },
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'White-Label Config Saved! 🌐', description: 'Domain and terminology preferences updated.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration.';
      toast({ title: 'Save Failed', description: msg });
    } finally {
      setIsSavingWhiteLabel(false);
    }
  };

  const handleSaveSso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssoDomain.trim() || !issuerUrl.trim()) return;

    setIsSavingSso(true);
    try {
      const res = await saveEnterpriseSsoAction(
        {
          organizationId,
          portalId,
          provider: ssoProvider,
          domain: ssoDomain.trim(),
          issuerUrl: issuerUrl.trim(),
          ssoLoginUrl: ssoLoginUrl.trim() || issuerUrl.trim(),
          enforceSsoOnly,
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'SSO Identity Provider Saved! 🔐', description: 'Enterprise federation policy is active.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save SSO configuration.';
      toast({ title: 'SSO Save Failed', description: msg });
    } finally {
      setIsSavingSso(false);
    }
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;

    setIsSavingNode(true);
    try {
      const res = await createHierarchyNodeAction({
        organizationId,
        name: newNodeName.trim(),
        type: newNodeType,
        leadName: newNodeLead.trim(),
      });

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Organizational Unit Created! 🏢', description: `${newNodeName} added to enterprise tree.` });
      setIsCreateNodeOpen(false);
      setNewNodeName('');
      setNewNodeLead('');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create organizational unit.';
      toast({ title: 'Creation Failed', description: msg });
    } finally {
      setIsSavingNode(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/20 border border-border">
        <div>
          <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Enterprise Administration & Governance
          </h3>
          <p className="text-xs text-muted-foreground">
            Custom CNAME domains, terminology dictionaries, SAML/OIDC SSO, and organizational trees.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-bold py-1 bg-card">
            Enterprise Tier Active
          </Badge>
        </div>
      </div>

      {/* ── Tabs Navigation ─────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-11 p-1 bg-muted/60 rounded-2xl grid grid-cols-4">
          <TabsTrigger value="whitelabel" className="rounded-xl text-xs font-bold gap-1.5">
            <Globe className="w-3.5 h-3.5" /> White-Labeling
          </TabsTrigger>
          <TabsTrigger value="sso" className="rounded-xl text-xs font-bold gap-1.5">
            <Key className="w-3.5 h-3.5" /> Enterprise SSO
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="rounded-xl text-xs font-bold gap-1.5">
            <Network className="w-3.5 h-3.5" /> Org Hierarchy ({nodes.length})
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl text-xs font-bold gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Audit Logs ({auditLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: White-Labeling & Terminology ──────────────────────── */}
        <TabsContent value="whitelabel" className="space-y-6 mt-6">
          <form onSubmit={handleSaveWhiteLabel} className="space-y-6">
            <Card className="p-6 rounded-3xl border border-border bg-card shadow-2xs space-y-4">
              <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" /> Custom CNAME Domain Routing
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Custom Hostname (FQDN)</Label>
                  <Input
                    value={customDomain}
                    onChange={e => setCustomDomain(e.target.value)}
                    placeholder="e.g. academy.schoolbursar.org"
                    className="h-10 text-xs rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Point your DNS CNAME record to: <code className="font-mono text-primary font-bold">{cnameTarget}</code>
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Custom Sender Email Domain</Label>
                  <Input
                    value={customSenderEmail}
                    onChange={e => setCustomSenderEmail(e.target.value)}
                    placeholder="e.g. notifications@schoolbursar.org"
                    className="h-10 text-xs rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Requires DKIM & SPF verification in domain registrar.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 rounded-3xl border border-border bg-card shadow-2xs space-y-4">
              <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <Languages className="w-4 h-4 text-primary" /> Custom System Terminology Dictionary
              </h4>
              <p className="text-xs text-muted-foreground">
                Rename core application concepts to fit your institution's vocabulary.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Course Singular</Label>
                  <Input
                    value={termCourse}
                    onChange={e => setTermCourse(e.target.value)}
                    placeholder="e.g. Module, Course"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Course Plural</Label>
                  <Input
                    value={termCourses}
                    onChange={e => setTermCourses(e.target.value)}
                    placeholder="e.g. Modules, Courses"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Instructor</Label>
                  <Input
                    value={termInstructor}
                    onChange={e => setTermInstructor(e.target.value)}
                    placeholder="e.g. Dean, Facilitator"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Student / Learner</Label>
                  <Input
                    value={termStudent}
                    onChange={e => setTermStudent(e.target.value)}
                    placeholder="e.g. Scholar, Bursar"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              </div>
            </Card>

            <Button
              type="submit"
              disabled={isSavingWhiteLabel}
              className="h-10 px-6 rounded-xl font-bold text-xs bg-primary text-white gap-1.5 shadow-sm"
            >
              {isSavingWhiteLabel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Enterprise White-Label Settings
            </Button>
          </form>
        </TabsContent>

        {/* ── Tab 2: Enterprise SSO ───────────────────────────────────── */}
        <TabsContent value="sso" className="space-y-6 mt-6">
          <form onSubmit={handleSaveSso} className="space-y-6">
            <Card className="p-6 rounded-3xl border border-border bg-card shadow-2xs space-y-4">
              <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" /> Identity Provider (IdP) Federation
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">SSO Protocol Provider</Label>
                  <select
                    value={ssoProvider}
                    onChange={e => setSsoProvider(e.target.value as SsoProvider)}
                    className="w-full h-10 px-3 rounded-xl border border-border text-xs bg-background"
                  >
                    <option value="saml">SAML 2.0 (Okta, PingIdentity, OneLogin)</option>
                    <option value="oidc">OpenID Connect (OIDC)</option>
                    <option value="microsoft_entra">Microsoft Entra ID (Azure AD)</option>
                    <option value="google_workspace">Google Workspace SAML</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Corporate Email Domain</Label>
                  <Input
                    value={ssoDomain}
                    onChange={e => setSsoDomain(e.target.value)}
                    placeholder="e.g. schoolbursar.org"
                    className="h-10 text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-bold">IdP Issuer Metadata URL / Entity ID</Label>
                  <Input
                    value={issuerUrl}
                    onChange={e => setIssuerUrl(e.target.value)}
                    placeholder="https://login.microsoftonline.com/.../federationmetadata/2007-06/federationmetadata.xml"
                    className="h-10 text-xs rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enforceSso"
                  checked={enforceSsoOnly}
                  onChange={e => setEnforceSsoOnly(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="enforceSso" className="text-xs font-bold cursor-pointer">
                  Enforce SSO Only (Disable password login for this corporate domain)
                </Label>
              </div>
            </Card>

            <Button
              type="submit"
              disabled={isSavingSso}
              className="h-10 px-6 rounded-xl font-bold text-xs bg-primary text-white gap-1.5 shadow-sm"
            >
              {isSavingSso ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save SSO Configuration
            </Button>
          </form>
        </TabsContent>

        {/* ── Tab 3: Organization Hierarchy ───────────────────────────── */}
        <TabsContent value="hierarchy" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Define regional branches, departments, and executive cohorts for scoped administration.
            </p>
            <Button
              size="sm"
              onClick={() => setIsCreateNodeOpen(true)}
              className="rounded-xl text-xs font-bold gap-1.5 bg-primary text-white"
            >
              <Plus className="w-3.5 h-3.5" /> Add Unit
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {nodes.map(n => (
              <Card key={n.id} className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-foreground">{n.name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {n.type}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Lead: <span className="font-bold text-foreground">{n.leadName || 'Unassigned'}</span>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Tab 4: Compliance Audit Logs ────────────────────────────── */}
        <TabsContent value="audit" className="space-y-3 mt-6">
          {auditLogs.map((log, idx) => (
            <Card key={idx} className="p-3 rounded-2xl border border-border bg-card shadow-2xs text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-bold text-foreground">{log.actorEmail}</span>
                <Badge variant="outline" className="text-[9px] font-mono">
                  {log.action}
                </Badge>
                <span className="text-muted-foreground">{log.resourceType}</span>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* ── Create Unit Modal ────────────────────────────────────────── */}
      <Dialog open={isCreateNodeOpen} onOpenChange={setIsCreateNodeOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">New Organizational Unit</DialogTitle>
            <DialogDescription className="text-xs">
              Add a branch, regional division, or corporate department.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNode} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Unit Name</Label>
              <Input
                value={newNodeName}
                onChange={e => setNewNodeName(e.target.value)}
                placeholder="e.g. Greater Accra Regional Branch"
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Unit Type</Label>
              <select
                value={newNodeType}
                onChange={e => setNewNodeType(e.target.value as HierarchyNodeType)}
                className="w-full h-10 px-3 rounded-xl border border-border text-xs bg-background"
              >
                <option value="region">Region / Division</option>
                <option value="branch">Branch / Campus</option>
                <option value="department">Department</option>
                <option value="team">Team / Cohort</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Lead Administrator Name</Label>
              <Input
                value={newNodeLead}
                onChange={e => setNewNodeLead(e.target.value)}
                placeholder="e.g. Kofi Owusu-Ansah"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={isSavingNode}
              className="w-full h-10 rounded-xl font-bold text-xs bg-primary text-white"
            >
              {isSavingNode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Unit'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
