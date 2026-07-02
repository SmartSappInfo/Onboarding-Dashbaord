'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Building2,
  Search,
  MoreHorizontal,
  Eye,
  Pause,
  Play,
  AlertTriangle,
  Plus,
  Users,
  Layers,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  listAllOrganizations, 
  suspendOrganization, 
  restoreOrganization,
  createOrganizationFromBackofficeAction 
} from '@/lib/backoffice/backoffice-org-actions';
import { useBackoffice } from '../../context/BackofficeProvider';
import ShareOrgInvite from './ShareOrgInvite';
import { APP_FEATURES, type AppFeatureId, type Organization } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

// ─────────────────────────────────────────────────
// Organization List Client
// Data table with filtering, sorting, and row actions.
// ─────────────────────────────────────────────────

type OrgWithStats = Organization & {
  workspaceCount: number;
  userCount: number;
  activeUsers: number;
};

/** Short, customer-facing blurbs for each platform feature entitlement. */
const FEATURE_DESCRIPTIONS: Record<AppFeatureId, string> = {
  entities: 'Manage contacts, accounts, and records.',
  pipeline: 'Track deals through customizable stages.',
  tasks: 'Assign tasks, set reminders, and follow up.',
  meetings: 'Schedule and coordinate virtual/in-person meetings.',
  automations: 'Design automated, event-triggered workflows.',
  reports: 'Dashboards, analytics, and intelligence reports.',
  quick_notes: 'Consolidated rich notes with linking and AI insights.',
  portals: 'Public-facing portals and landing pages.',
  media: 'Upload and manage images, files, and assets.',
  surveys: 'Create satisfaction, NPS, and intake surveys.',
  pdfs: 'Prepare documents and collect e-signatures.',
  messaging: 'Run bulk SMS/email campaigns and conversations.',
  tags: 'Segment records with tags and labels.',
  forms: 'Build dynamic intake and data-collection forms.',
  qr_studio: 'Generate and brand QR codes.',
  verify_studio: 'Verify identities and submitted documents.',
  agreements: 'Create and manage contracts and agreements.',
  invoices: 'Issue and track invoices.',
  packages: 'Define pricing tiers and packages.',
  billing_periods: 'Manage billing cycles and periods.',
  billing_setup: 'Configure billing and payment settings.',
  social_intelligence: 'Manage social media channels, composer, inbox, and analytics.',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  trial: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/20',
  archived: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
};

export default function OrgListClient() {
  const { can, profile } = useBackoffice();
  const { toast } = useToast();
  const [orgs, setOrgs] = React.useState<OrgWithStats[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  // New Organization Creation States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [newOrgName, setNewOrgName] = React.useState('');
  const [newOrgEmail, setNewOrgEmail] = React.useState('');
  const [features, setFeatures] = React.useState<any[]>([]);
  const [selectedFeatures, setSelectedFeatures] = React.useState<Record<string, boolean>>({});
  const [createResult, setCreateResult] = React.useState<{ organizationId: string; joinToken: string; link: string } | null>(null);
  const [copiedToken, setCopiedToken] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);

  React.useEffect(() => {
    loadOrgs();
    loadFeatures();
  }, []);

  async function loadOrgs() {
    setIsLoading(true);
    const result = await listAllOrganizations();
    if (result.success && result.data) {
      setOrgs(result.data);
    }
    setIsLoading(false);
  }

  function loadFeatures() {
    // Entitlements are keyed by AppFeatureId — the SAME canonical registry the
    // admin Feature Manager uses to turn features on/off (org.enabledFeatures).
    // Sourcing the modal from APP_FEATURES guarantees the full list is shown and
    // that the keys actually gate features post-creation.
    const list = APP_FEATURES.map(f => ({
      id: f.id,
      key: f.id,
      label: f.label,
      category: f.category,
      description: FEATURE_DESCRIPTIONS[f.id],
      defaultState: f.defaultEnabled,
    }));
    setFeatures(list);
    const defaults: Record<string, boolean> = {};
    list.forEach(f => { defaults[f.key] = Boolean(f.defaultState); });
    setSelectedFeatures(defaults);
  }

  // Filter orgs by search and status
  const filteredOrgs = React.useMemo(() => {
    return orgs.filter((org) => {
      const matchesSearch =
        !search ||
        org.name.toLowerCase().includes(search.toLowerCase()) ||
        org.slug?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || (org.status || 'active') === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orgs, search, statusFilter]);

  async function handleSuspend(orgId: string) {
    if (!profile) return;
    const reason = prompt('Enter suspension reason:');
    if (!reason) return;

    const result = await suspendOrganization(orgId, reason, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });

    if (result.success) loadOrgs();
  }

  async function handleRestore(orgId: string) {
    if (!profile) return;
    const result = await restoreOrganization(orgId, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });

    if (result.success) loadOrgs();
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Organization name is required.' });
      return;
    }
    if (!profile) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Action requires logged-in super admin actor.' });
      return;
    }

    setIsCreating(true);
    try {
      const result = await createOrganizationFromBackofficeAction({
        name: newOrgName,
        email: newOrgEmail,
        enabledFeatures: selectedFeatures
      }, {
        userId: profile.id,
        name: profile.name,
        email: profile.email,
        role: 'super_admin'
      });

      if (result.success && result.data) {
        const inviteLink = `${window.location.origin}/profile-setup?code=${result.data.joinToken}`;
        setCreateResult({
          organizationId: result.data.organizationId,
          joinToken: result.data.joinToken,
          link: inviteLink
        });
        toast({ title: 'Success', description: 'Organization pre-created successfully.' });
        loadOrgs();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to create organization.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'System Error', description: err.message || 'Server error occurred.' });
    } finally {
      setIsCreating(false);
    }
  }

  function handleCloseCreate(open: boolean) {
    if (!open) {
      setIsCreateOpen(false);
      setNewOrgName('');
      setNewOrgEmail('');
      setCreateResult(null);
      setCopiedToken(false);
      setCopiedLink(false);
    } else {
      setIsCreateOpen(true);
    }
  }

  const copyToClipboard = async (text: string, type: 'token' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'token') {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
      toast({ title: 'Copied', description: `${type === 'token' ? 'Join token' : 'Invitation link'} copied to clipboard.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Copy Failed', description: 'Failed to copy to clipboard.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Organizations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all platform organizations and their configurations.
          </p>
        </div>
        {can('organizations', 'create') ? (
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 px-4 cursor-pointer"
            aria-label="Create new organization"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Organization
          </Button>
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl focus:border-emerald-500/50 focus:ring-emerald-500/20"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-10 bg-muted/50 border-border text-foreground rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Badge
          variant="outline"
          className="text-xs text-muted-foreground border-border px-3 h-10 flex items-center"
        >
          {filteredOrgs.length} organization{filteredOrgs.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Data Table */}
      <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Organization
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Status
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">
                <Layers className="h-3.5 w-3.5 inline mr-1" />
                Workspaces
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">
                <Users className="h-3.5 w-3.5 inline mr-1" />
                Users
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Created
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-accent animate-pulse" />
                      <div>
                        <div className="h-4 w-32 bg-accent rounded animate-pulse" />
                        <div className="h-3 w-20 bg-accent/60 rounded animate-pulse mt-1" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><div className="h-5 w-16 bg-accent rounded-full animate-pulse" /></TableCell>
                  <TableCell className="text-center"><div className="h-4 w-6 bg-accent rounded animate-pulse mx-auto" /></TableCell>
                  <TableCell className="text-center"><div className="h-4 w-6 bg-accent rounded animate-pulse mx-auto" /></TableCell>
                  <TableCell><div className="h-4 w-20 bg-accent rounded animate-pulse" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : filteredOrgs.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="text-center py-12">
                  <Building2 className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No organizations found.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrgs.map((org) => (
                <TableRow
                  key={org.id}
                  className="border-border hover:bg-accent/20 transition-colors cursor-pointer"
                >
                  <TableCell>
                    <Link
                      href={`/backoffice/organizations/${org.id}`}
                      className="flex items-center gap-3"
                    >
                      <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{org.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{org.slug}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[9px] uppercase font-bold px-2 h-5 ${STATUS_COLORS[org.status || 'active']}`}
                    >
                      {org.status || 'active'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm text-foreground/80 font-semibold">
                    {org.workspaceCount}
                  </TableCell>
                  <TableCell className="text-center text-sm text-foreground/80 font-semibold">
                    {org.activeUsers}/{org.userCount}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {org.createdAt
                      ? new Date(org.createdAt).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label={`Actions for ${org.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 bg-muted border-border rounded-xl"
                      >
                        <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                          <Link href={`/backoffice/organizations/${org.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {can('organizations', 'edit') ? (
                          <>
                            <DropdownMenuSeparator className="bg-accent" />
                            {org.status === 'suspended' ? (
                              <DropdownMenuItem
                                onClick={() => handleRestore(org.id)}
                                className="cursor-pointer rounded-lg text-emerald-400 focus:text-emerald-400"
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Restore
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleSuspend(org.id)}
                                className="cursor-pointer rounded-lg text-red-400 focus:text-red-400"
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={handleCloseCreate}>
        <DialogContent className="sm:max-w-[550px] bg-background border-border rounded-2xl shadow-xl text-foreground">
          {createResult ? (
            <div className="space-y-6 py-4">
              <DialogHeader>
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2 animate-bounce">
                  <Check className="h-6 w-6 text-emerald-400" />
                </div>
                <DialogTitle className="text-xl font-bold text-center">Organization Pre-Created!</DialogTitle>
                <DialogDescription className="text-center text-sm text-muted-foreground">
                  The organization has been provisioned as unconfigured. Share the credentials below to allow the administrator to complete setup.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Join Token</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 p-2 bg-muted border border-border rounded-lg text-sm font-mono text-emerald-400 font-bold select-all">
                        {createResult.joinToken}
                      </code>
                      <Button
                        size="icon"
                        type="button"
                        variant="outline"
                        onClick={() => copyToClipboard(createResult.joinToken, 'token')}
                        className="h-9 w-9 rounded-lg border-border cursor-pointer hover:bg-muted"
                        aria-label="Copy token"
                      >
                        {copiedToken ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Invitation Link</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        readOnly
                        value={createResult.link}
                        className="flex-1 h-9 bg-muted border border-border rounded-lg text-xs font-mono select-all text-muted-foreground"
                      />
                      <Button
                        size="icon"
                        type="button"
                        variant="outline"
                        onClick={() => copyToClipboard(createResult.link, 'link')}
                        className="h-9 w-9 rounded-lg border-border cursor-pointer hover:bg-muted"
                        aria-label="Copy link"
                      >
                        {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border border-border rounded-xl p-4 bg-muted/10">
                  <ShareOrgInvite
                    organizationId={createResult.organizationId}
                    defaultEmail={newOrgEmail}
                    onShared={({ joinToken, link }) => {
                      if (joinToken && link) {
                        setCreateResult((prev) => prev ? { ...prev, joinToken, link } : prev);
                      }
                    }}
                  />
                </div>

                <div className="text-xs text-muted-foreground bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">💡 Note:</span>
                  <span>
                    When the user visits this link, they will complete their profile, customize the organization's branding/preferences, create the first workspace, and automatically become the organization's <strong>Administrator</strong>.
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => handleCloseCreate(false)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 cursor-pointer"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateOrg} className="space-y-6 py-2">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Create New Organization</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Pre-register an organization with custom feature entitlements. A join code will be generated to complete setup.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name" className="text-sm font-semibold">Organization Name *</Label>
                  <Input
                    id="org-name"
                    required
                    placeholder="e.g. Acme Corp"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    className="h-10 bg-muted/30 border-border rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-email" className="text-sm font-semibold">Primary Contact Email (Optional)</Label>
                  <Input
                    id="org-email"
                    type="email"
                    placeholder="e.g. admin@acme.com"
                    value={newOrgEmail}
                    onChange={(e) => setNewOrgEmail(e.target.value)}
                    className="h-10 bg-muted/30 border-border rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Feature Entitlements</Label>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {Object.values(selectedFeatures).filter(Boolean).length} of {features.length} selected
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Select the platform features that this organization is allowed to access.</p>
                  <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1 mt-2">
                    {[...new Set(features.map((f) => f.category))].map((category) => {
                      const groupFeatures = features.filter((f) => f.category === category);
                      const allOn = groupFeatures.every((f) => selectedFeatures[f.key]);
                      return (
                        <div key={category} className="space-y-2">
                          <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-10">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{category}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedFeatures((prev) => {
                                  const next = { ...prev };
                                  groupFeatures.forEach((f) => { next[f.key] = !allOn; });
                                  return next;
                                })
                              }
                              className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                              {allOn ? 'Clear all' : 'Select all'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {groupFeatures.map((feature) => (
                              <div
                                key={feature.id}
                                className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                              >
                                <Checkbox
                                  id={`feature-${feature.key}`}
                                  checked={!!selectedFeatures[feature.key]}
                                  onCheckedChange={(checked) =>
                                    setSelectedFeatures((prev) => ({
                                      ...prev,
                                      [feature.key]: !!checked,
                                    }))
                                  }
                                  className="mt-1 border-border data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                />
                                <label
                                  htmlFor={`feature-${feature.key}`}
                                  className="text-xs text-foreground cursor-pointer select-none space-y-0.5"
                                >
                                  <span className="font-semibold block">{feature.label || feature.key}</span>
                                  {feature.description && (
                                    <span className="text-[10px] text-muted-foreground block leading-normal">
                                      {feature.description}
                                    </span>
                                  )}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCloseCreate(false)}
                  className="rounded-xl h-10 border-border cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 px-6 cursor-pointer"
                >
                  {isCreating ? 'Creating...' : 'Create Organization'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
