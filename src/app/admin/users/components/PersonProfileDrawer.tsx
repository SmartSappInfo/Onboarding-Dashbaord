'use client';

/**
 * @fileOverview Person Profile Detail Sheet (Identity & Access 2.0)
 *
 * Slide-over detail drawer for inspecting, managing, and auditing an individual team member.
 * Features 4 specialized tabs: Overview, Access & Workspaces, Security & Sessions, and Preferences.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Sheet and Emil Kowalski animation physics (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Mobile ergonomics: converts to a full-viewport sheet on `<768px` with clear touch targets.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  User,
  Shield,
  Building,
  Key,
  Bell,
  Sparkles,
  Mail,
  Phone,
  MessageSquare,
  Briefcase,
  CheckCircle2,
  Clock,
  Ban,
  Lock,
  Layers,
  Star,
  Loader2,
  Save,
  RotateCcw,
  Copy,
  HelpCircle,
  ArrowRightLeft,
} from 'lucide-react';
import type { UserProfile, Role, Workspace, PersonDetailView, MembershipStatus, CrmWorkloadSummary, MemberRiskScore } from '@/lib/types';
import {
  updatePersonProfileAction,
  updateMembershipStatusAction,
} from '@/app/actions/identity-actions';
import { adminResetUserPasswordAction } from '@/lib/user-invite-actions';
import { AccessExplainerModal } from '@/app/admin/users/roles/components/AccessExplainerModal';
import { getPersonCrmWorkloadAction } from '@/app/actions/crm-workforce-actions';
import { getPersonRiskScoreAction } from '@/app/actions/ai-workforce-actions';
import { OwnershipTransferModal } from '@/app/admin/workforce/crm/components/OwnershipTransferModal';

interface PersonProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  roles: Role[];
  workspaces: Workspace[];
  people?: PersonDetailView[];
  onManageWorkspaces: (user: UserProfile) => void;
  onProfileUpdated?: (updated: UserProfile) => void;
}

const getInitials = (name?: string) =>
  name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

export function PersonProfileDrawer({
  isOpen,
  onClose,
  user,
  roles,
  workspaces,
  people = [],
  onManageWorkspaces,
  onProfileUpdated,
}: PersonProfileDrawerProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [activeTab, setActiveTab] = React.useState('overview');
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [isResettingPassword, setIsResettingPassword] = React.useState(false);
  const [resetModalOpen, setResetModalOpen] = React.useState(false);
  const [resetChannels, setResetChannels] = React.useState<('email' | 'sms' | 'whatsapp')[]>(['email']);
  const [isExplainerOpen, setIsExplainerOpen] = React.useState(false);
  const [explainingPermission, setExplainingPermission] = React.useState('operations.pipeline.view');

  // Editable Profile Form State
  const [displayName, setDisplayName] = React.useState(user.name || '');
  const [phone, setPhone] = React.useState(user.phone || '');
  const [department, setDepartment] = React.useState(user.department || '');
  const [facilitatorRole, setFacilitatorRole] = React.useState(user.facilitatorRole || '');

  // CRM Workload State
  const [crmWorkload, setCrmWorkload] = React.useState<CrmWorkloadSummary | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = React.useState(false);
  const [isLoadingCrm, setIsLoadingCrm] = React.useState(false);

  // AI Risk Score State
  const [riskScore, setRiskScore] = React.useState<MemberRiskScore | null>(null);

  const loadCrmWorkload = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId || !user.id) return;
    setIsLoadingCrm(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await getPersonCrmWorkloadAction({
        idToken,
        organizationId: activeOrganizationId,
        personId: user.id,
      });
      if (res.success && res.workload) {
        setCrmWorkload(res.workload);
      }
    } catch (err: unknown) {
      console.warn('[PersonProfileDrawer] CRM workload load error:', err);
    } finally {
      setIsLoadingCrm(false);
    }
  }, [authUser, activeOrganizationId, user.id]);

  const loadRiskScore = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId || !user.id) return;
    try {
      const idToken = await authUser.getIdToken();
      const res = await getPersonRiskScoreAction({
        idToken,
        organizationId: activeOrganizationId,
        personId: user.id,
      });
      if (res.success && res.riskScore) {
        setRiskScore(res.riskScore);
      }
    } catch (err: unknown) {
      console.warn('[PersonProfileDrawer] Risk score load error:', err);
    }
  }, [authUser, activeOrganizationId, user.id]);

  React.useEffect(() => {
    if (isOpen && activeTab === 'crm') {
      loadCrmWorkload();
    }
  }, [isOpen, activeTab, loadCrmWorkload]);

  React.useEffect(() => {
    if (isOpen) {
      setDisplayName(user.name || '');
      setPhone(user.phone || '');
      setDepartment(user.department || '');
      setFacilitatorRole(user.facilitatorRole || '');
      setActiveTab('overview');
      loadRiskScore();
    }
  }, [user, isOpen, loadRiskScore]);

  // Status mapping
  const statusBadge = React.useMemo(() => {
    if (!user.isAuthorized) {
      if (user.approvalStatus === 'rejected') {
        return (
          <Badge variant="destructive" className="gap-1 text-xs">
            <Ban className="w-3 h-3" /> Suspended
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-xs">
          <Clock className="w-3 h-3" /> Pending Approval
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs">
        <CheckCircle2 className="w-3 h-3" /> Active Member
      </Badge>
    );
  }, [user.isAuthorized, user.approvalStatus]);

  // Workspaces list
  const userWorkspaces = React.useMemo(() => {
    const wsIds = user.workspaceIds || [];
    return workspaces.filter((w) => wsIds.includes(w.id));
  }, [user.workspaceIds, workspaces]);

  // Handle personal profile update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !activeOrganizationId) return;

    setIsSavingProfile(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await updatePersonProfileAction({
        idToken,
        organizationId: activeOrganizationId,
        personId: user.id,
        updates: {
          displayName,
          phone,
          departmentName: department,
          facilitatorRole,
        },
      });

      if (res.success && res.userProfile) {
        toast({
          title: 'Profile Updated',
          description: `Successfully updated profile details for ${displayName}.`,
        });
        if (onProfileUpdated) onProfileUpdated(res.userProfile);
      } else {
        throw new Error(res.error || 'Failed to update profile');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Update Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Open Reset Password Multi-Channel Modal
  const handleResetPassword = () => {
    const initialChannels: ('email' | 'sms' | 'whatsapp')[] = ['email'];
    if (user.phone && user.phone.trim().length > 5) {
      initialChannels.push('sms');
      initialChannels.push('whatsapp');
    }
    setResetChannels(initialChannels);
    setResetModalOpen(true);
  };

  // Execute Multi-Channel Password Reset
  const executePasswordReset = async () => {
    if (resetChannels.length === 0) return;
    setIsResettingPassword(true);
    try {
      const res = await adminResetUserPasswordAction({
        userId: user.id,
        channels: resetChannels,
      });

      if (res.success) {
        if (res.tempPassword) {
          try {
            await navigator.clipboard.writeText(res.tempPassword);
          } catch {
            // Non-fatal if clipboard write fails
          }
        }

        if (res.warnings && res.warnings.length > 0) {
          toast({
            variant: 'destructive',
            title: 'Password Reset with Delivery Alerts',
            description: `Password reset successfully and copied to clipboard. Delivery warnings: ${res.warnings.join('. ')}`,
          });
        } else {
          toast({
            title: 'Password Reset Dispatched',
            description: `Credentials sent via ${resetChannels.join(', ')} and temporary password copied to clipboard.`,
          });
        }
        setResetModalOpen(false);
      } else {
        throw new Error(res.error || res.message || 'Failed to reset password');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Copy UID
  const handleCopyUid = () => {
    navigator.clipboard.writeText(user.id);
    toast({
      title: 'Copied to Clipboard',
      description: `User UID copied: ${user.id}`,
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col justify-between bg-card border-l shadow-2xl overflow-x-hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{user.name || 'User Profile'}</SheetTitle>
          <SheetDescription>
            Inspect and manage team member access, profile attributes, and security permissions for {user.name || 'user'}.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          {/* Header Card */}
          <div className="p-5 pb-4 border-b bg-muted/20 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-13 h-13 border-2 border-primary/20 shadow-xs">
                  <AvatarImage src={user.photoURL} alt={user.name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-base">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-foreground line-clamp-1">{user.name}</h2>
                    {statusBadge}
                    {riskScore && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-wider',
                          riskScore.level === 'critical'
                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                            : riskScore.level === 'high'
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                            : riskScore.level === 'medium'
                            ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                            : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                        )}
                      >
                        <Sparkles className="w-3 h-3 mr-1 inline" /> Risk: {riskScore.score}/100
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5" /> {user.email}
                  </p>
                  {user.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-3.5 h-3.5" /> {user.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onManageWorkspaces(user);
                }}
                className="text-xs h-8 px-3 font-medium active:scale-[0.97]"
              >
                <Building className="w-3.5 h-3.5 mr-1.5 text-primary" /> Manage Workspaces
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetPassword}
                disabled={isResettingPassword}
                className="text-xs h-8 px-3 font-medium active:scale-[0.97]"
              >
                {isResettingPassword ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Key className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                )}
                Reset Password
              </Button>
            </div>
          </div>

          {/* Tabbed Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-w-0">
            <div className="px-3 sm:px-5 border-b bg-card sticky top-0 z-10">
              <TabsList className="grid grid-cols-5 w-full h-11 bg-transparent p-0 border-b border-transparent">
                <TabsTrigger
                  value="overview"
                  title="Overview"
                  className="min-w-0 h-full data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-1.5 -mb-px"
                >
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Overview</span>
                </TabsTrigger>
                <TabsTrigger
                  value="access"
                  title="Access & Workspaces"
                  className="min-w-0 h-full data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-1.5 -mb-px"
                >
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Access</span>
                </TabsTrigger>
                <TabsTrigger
                  value="security"
                  title="Security & Sessions"
                  className="min-w-0 h-full data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-1.5 -mb-px"
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Security</span>
                </TabsTrigger>
                <TabsTrigger
                  value="preferences"
                  title="Preferences & AI"
                  className="min-w-0 h-full data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-1.5 -mb-px"
                >
                  <Bell className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Preferences</span>
                </TabsTrigger>
                <TabsTrigger
                  value="crm"
                  title="CRM & Workload"
                  className="min-w-0 h-full data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-2 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-1.5 -mb-px"
                >
                  <Briefcase className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">CRM</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab 1: Overview */}
            <TabsContent value="overview" className="p-5 space-y-4 m-0 flex-1">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <Card className="border shadow-xs">
                  <CardHeader className="p-4 pb-3">
                    <CardTitle className="text-sm font-semibold">Personal Information</CardTitle>
                    <CardDescription className="text-xs">Update human profile attributes and contact points</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Full Display Name</Label>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Phone Number</Label>
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+233..."
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Department</Label>
                        <Input
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="e.g. Admissions, Sales"
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Facilitator / Meeting Title</Label>
                      <Input
                        value={facilitatorRole}
                        onChange={(e) => setFacilitatorRole(e.target.value)}
                        placeholder="e.g. Lead Admissions Director"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button type="submit" size="sm" disabled={isSavingProfile} className="text-xs h-8 px-3.5 active:scale-[0.97]">
                        {isSavingProfile ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                        Save Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Account Metadata */}
                <Card className="border shadow-xs bg-muted/20">
                  <CardContent className="p-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Member Since</span>
                      <span className="font-medium text-foreground">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Last Profile Sync</span>
                      <span className="font-medium text-foreground">
                        {user.updatedAt ? new Date(user.updatedAt).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </TabsContent>

            {/* Tab 2: Access & Workspaces */}
            <TabsContent value="access" className="p-5 space-y-4 m-0 flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Assigned Workspaces</h3>
                  <p className="text-xs text-muted-foreground">Workspaces and roles authorized for this member</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExplainingPermission('operations.pipeline.view');
                      setIsExplainerOpen(true);
                    }}
                    className="text-xs h-8 px-2.5 font-medium active:scale-[0.97]"
                  >
                    <HelpCircle className="w-3.5 h-3.5 mr-1 text-primary" /> Explain Access
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onManageWorkspaces(user);
                    }}
                    className="text-xs h-8 px-3 font-medium active:scale-[0.97]"
                  >
                    <Building className="w-3.5 h-3.5 mr-1.5 text-primary" /> Modify Workspaces
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5">
                {userWorkspaces.length === 0 ? (
                  <div className="p-8 text-center border rounded-xl bg-muted/20 text-xs text-muted-foreground">
                    No active workspace assignments. Click &quot;Modify Workspaces&quot; to grant access.
                  </div>
                ) : (
                  userWorkspaces.map((ws) => {
                    const assignedRoleIds = user.workspaceRoles?.[ws.id] || user.roles || [];
                    const assignedRoles = assignedRoleIds
                      .map((id) => roles.find((r) => r.id === id)?.name)
                      .filter((n): n is string => Boolean(n));
                    const isPrimary = ws.id === user.lastActiveWorkspaceId || ws.id === user.defaultWorkspaceId;

                    return (
                      <div key={ws.id} className="p-3.5 rounded-xl border bg-card shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{ws.name}</span>
                            {isPrimary && (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
                                <Star className="w-3 h-3 mr-0.5 fill-amber-500" /> Primary
                              </Badge>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-[10px]">
                            {assignedRoles.length} {assignedRoles.length === 1 ? 'Role' : 'Roles'}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {assignedRoles.map((rName, i) => (
                            <Badge key={i} variant="outline" className="text-xs py-0.5 bg-muted/30">
                              <Shield className="w-3 h-3 mr-1 text-primary" /> {rName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* Tab 3: Security & Sessions */}
            <TabsContent value="security" className="p-5 space-y-4 m-0 flex-1">
              <Card className="border shadow-xs">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Account Security Identifier</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border text-xs">
                    <span className="font-mono text-muted-foreground truncate mr-2">{user.id}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={handleCopyUid} className="h-7 px-2 text-xs">
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy UID
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-xs">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Authentication State</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Authorization Status</span>
                    <span className="font-medium text-foreground">{user.isAuthorized ? 'Authorized' : 'Pending / Disabled'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Password Reset Required</span>
                    <span className="font-medium text-foreground">{user.requiresPasswordReset ? 'Yes (Enforced)' : 'No'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Email Address</span>
                    <span className="font-medium text-foreground">{user.email}</span>
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <div>
                      <span className="font-semibold block text-foreground">Password Credentials</span>
                      <span className="text-[11px] text-muted-foreground block">Generate temporary password and dispatch notifications</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetPassword}
                      className="h-8 px-3 text-xs font-semibold active:scale-[0.97]"
                    >
                      <Key className="w-3.5 h-3.5 mr-1 text-amber-500" /> Reset Password
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 4: Preferences & AI */}
            <TabsContent value="preferences" className="p-5 space-y-4 m-0 flex-1">
              <Card className="border shadow-xs">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Notification Channels</CardTitle>
                  <CardDescription className="text-xs">User configured alert preferences</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span>Email Notifications</span>
                    <Badge variant={user.notificationPreferences?.email ? 'default' : 'outline'}>
                      {user.notificationPreferences?.email ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span>SMS Alerts</span>
                    <Badge variant={user.notificationPreferences?.sms ? 'default' : 'outline'}>
                      {user.notificationPreferences?.sms ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span>In-App Notifications</span>
                    <Badge variant={user.notificationPreferences?.inApp ? 'default' : 'outline'}>
                      {user.notificationPreferences?.inApp ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-xs">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" /> AI Copilot Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Preferred AI Model</span>
                    <span className="font-medium text-foreground">{user.preferredAiModel || 'gemini-2.0-flash (Default)'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">Provider Gateway</span>
                    <span className="font-medium text-foreground">{user.preferredAiProvider || 'Google AI'}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 5: CRM & Workload */}
            <TabsContent value="crm" className="p-5 space-y-4 m-0 flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Operational CRM Portfolio</h3>
                  <p className="text-xs text-muted-foreground">Active deals pipeline, assigned contacts, and tasks</p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTransferModalOpen(true)}
                  disabled={!crmWorkload || crmWorkload.totalActiveEntities === 0}
                  className="text-xs h-8 px-3 font-semibold active:scale-[0.97]"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5 text-primary" /> Transfer Portfolio
                </Button>
              </div>

              {isLoadingCrm ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4 border rounded-lg bg-muted/20 animate-pulse h-20" />
                  ))}
                </div>
              ) : crmWorkload ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Card className="p-3 border shadow-xs space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Pipeline Value</span>
                      <span className="text-base font-black text-foreground">
                        ${crmWorkload.totalPipelineValue.toLocaleString()}
                      </span>
                      <p className="text-[10px] text-muted-foreground">{crmWorkload.dealCount} active deals</p>
                    </Card>

                    <Card className="p-3 border shadow-xs space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Managed Contacts</span>
                      <span className="text-base font-black text-foreground">{crmWorkload.contactCount}</span>
                      <p className="text-[10px] text-muted-foreground">{crmWorkload.leadCount} prospective leads</p>
                    </Card>

                    <Card className="p-3 border shadow-xs space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Open Tasks</span>
                      <span className="text-base font-black text-foreground">{crmWorkload.openTaskCount}</span>
                      <p className="text-[10px] text-muted-foreground">Pending action items</p>
                    </Card>

                    <Card className="p-3 border shadow-xs space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Automations Owned</span>
                      <span className="text-base font-black text-foreground">{crmWorkload.automationCount}</span>
                      <p className="text-[10px] text-muted-foreground">Active business workflows</p>
                    </Card>
                  </div>

                  {crmWorkload.hasOrphanRisk ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-1">
                      <span className="font-bold text-amber-700 dark:text-amber-400 block">
                        Active Operational Assets Held
                      </span>
                      <p className="text-muted-foreground text-[11px]">
                        This member holds {crmWorkload.totalActiveEntities} active CRM assets. Before deactivating or suspending this user, re-assign their portfolio using the Transfer button above.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-muted-foreground text-[11px]">
                        Zero orphaned assets held. Safe for offboarding or role realignment.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Failed to load CRM workload summary.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>

      {/* Reset Password Multi-Channel Dialog */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border">
          <DialogHeader className="p-5 pb-3 border-b bg-muted/10">
            <div className="flex items-center gap-2 text-primary">
              <Key className="w-5 h-5 text-amber-500" />
              <DialogTitle className="text-base font-bold">Reset Password</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Generate a new temporary password and dispatch credentials for{' '}
              <strong className="text-foreground">{user.name || user.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            {/* Recipient Information Summary */}
            <div className="p-3.5 rounded-xl bg-muted/20 border text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Account Email:</span>
                <span className="font-semibold text-foreground">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Phone Number:</span>
                <span className={cn('font-semibold', user.phone ? 'text-foreground' : 'text-muted-foreground italic')}>
                  {user.phone || 'None configured'}
                </span>
              </div>
            </div>

            {/* Delivery Channels Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Delivery Channels
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetChannels((prev) =>
                      prev.includes('email')
                        ? prev.length > 1
                          ? prev.filter((c) => c !== 'email')
                          : prev
                        : [...prev, 'email']
                    );
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-center transition-all cursor-pointer',
                    resetChannels.includes('email')
                      ? 'bg-primary/10 border-primary text-primary font-semibold shadow-xs'
                      : 'bg-muted/20 border-border text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">Email</span>
                </button>

                <button
                  type="button"
                  disabled={!user.phone}
                  onClick={() => {
                    if (!user.phone) return;
                    setResetChannels((prev) =>
                      prev.includes('sms') ? prev.filter((c) => c !== 'sms') : [...prev, 'sms']
                    );
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-center transition-all',
                    !user.phone ? 'opacity-40 cursor-not-allowed bg-muted/10' : 'cursor-pointer hover:bg-muted/40',
                    resetChannels.includes('sms')
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 font-semibold shadow-xs'
                      : 'bg-muted/20 border-border text-muted-foreground'
                  )}
                  title={!user.phone ? 'Requires phone number on profile' : undefined}
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">SMS</span>
                </button>

                <button
                  type="button"
                  disabled={!user.phone}
                  onClick={() => {
                    if (!user.phone) return;
                    setResetChannels((prev) =>
                      prev.includes('whatsapp') ? prev.filter((c) => c !== 'whatsapp') : [...prev, 'whatsapp']
                    );
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-center transition-all',
                    !user.phone ? 'opacity-40 cursor-not-allowed bg-muted/10' : 'cursor-pointer hover:bg-muted/40',
                    resetChannels.includes('whatsapp')
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 font-semibold shadow-xs'
                      : 'bg-muted/20 border-border text-muted-foreground'
                  )}
                  title={!user.phone ? 'Requires phone number on profile' : undefined}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">WhatsApp</span>
                </button>
              </div>

              {!user.phone && (
                <p className="text-[11px] text-muted-foreground italic mt-1">
                  * Add a phone number in Personal Information to enable SMS and WhatsApp delivery.
                </p>
              )}
            </div>

            {/* Security Warning Notice */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                Resetting password generates a temporary credential and invalidates the previous password. The user will be required to create a new password upon login.
              </span>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/10 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetModalOpen(false)}
              disabled={isResettingPassword}
              className="text-xs h-9 px-4 active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={executePasswordReset}
              disabled={isResettingPassword || resetChannels.length === 0}
              className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
            >
              {isResettingPassword ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Resetting...
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5 mr-1.5" /> Reset & Dispatch
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isExplainerOpen && (
        <AccessExplainerModal
          isOpen={isExplainerOpen}
          onClose={() => setIsExplainerOpen(false)}
          personId={user.id}
          personName={user.name || 'User'}
          permissionId={explainingPermission}
          workspaceId={user.lastActiveWorkspaceId || user.defaultWorkspaceId || user.workspaceIds?.[0]}
        />
      )}

      {isTransferModalOpen && crmWorkload && people && (
        <OwnershipTransferModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          sourceWorkload={crmWorkload}
          people={people}
          onTransferred={() => {
            loadCrmWorkload();
            if (onProfileUpdated) onProfileUpdated(user);
          }}
        />
      )}
    </Sheet>
  );
}

export default PersonProfileDrawer;
